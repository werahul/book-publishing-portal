import { z } from 'zod';
import { APIConnectionTimeoutError, BadRequestError, InternalServerError, RateLimitError } from 'groq-sdk';
import { AiError, type AiRequest } from '../src/modules/ai/ai.provider';
import { GroqProvider, reasoningParams } from '../src/modules/ai/groq.provider';

const mockCreate = jest.fn();
jest.mock('groq-sdk', () => {
  const actual = jest.requireActual('groq-sdk');
  return {
    __esModule: true,
    ...actual,
    default: jest.fn().mockImplementation(() => ({ chat: { completions: { create: mockCreate } } })),
  };
});

const REQ: AiRequest = { purpose: 'classify', model: 'openai/gpt-oss-20b', system: 'sys', user: 'usr', temperature: 0, maxTokens: 150 };
const schema = z.object({ ok: z.literal(true) });

const completion = (content: string) => ({
  model: 'openai/gpt-oss-20b',
  choices: [{ message: { content } }],
  usage: { prompt_tokens: 120, completion_tokens: 20 },
});

beforeEach(() => mockCreate.mockReset());

describe('GroqProvider', () => {
  it('sends JSON mode with capped tokens and returns validated output with usage', async () => {
    mockCreate.mockResolvedValueOnce(completion('{"ok": true}'));
    const res = await new GroqProvider('key').completeJson(REQ, schema);

    expect(res).toEqual({ value: { ok: true }, model: 'openai/gpt-oss-20b', usage: { promptTokens: 120, completionTokens: 20 } });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ response_format: { type: 'json_object' }, max_completion_tokens: 150, temperature: 0 }),
    );
  });

  it('keeps reasoning effort low so hidden reasoning cannot eat the token budget', async () => {
    mockCreate.mockResolvedValueOnce(completion('{"ok": true}'));
    await new GroqProvider('key').completeJson(REQ, schema);
    expect(mockCreate.mock.calls[0][0]).toMatchObject({ reasoning_effort: 'low' });

    expect(reasoningParams('qwen/qwen3.8-27b')).toEqual({ reasoning_effort: 'none' });
    expect(reasoningParams('some-non-reasoning-model')).toEqual({});
  });

  it('repairs invalid output once, showing the model its mistake', async () => {
    mockCreate.mockResolvedValueOnce(completion('{"ok": false}')).mockResolvedValueOnce(completion('{"ok": true}'));
    const res = await new GroqProvider('key').completeJson(REQ, schema);

    expect(res.value).toEqual({ ok: true });
    expect(res.usage).toEqual({ promptTokens: 240, completionTokens: 40 });
    const retryMessages = mockCreate.mock.calls[1][0].messages;
    expect(retryMessages.at(-2)).toEqual({ role: 'assistant', content: '{"ok": false}' });
    expect(retryMessages.at(-1).content).toMatch(/invalid/);
  });

  it('gives up after one repair attempt', async () => {
    mockCreate.mockResolvedValue(completion('not json at all'));
    await expect(new GroqProvider('key').completeJson(REQ, schema)).rejects.toMatchObject({ kind: 'invalid_output' });
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("treats Groq's json_validate_failed 400 as invalid output and retries", async () => {
    mockCreate
      .mockRejectedValueOnce(
        // Shape of Groq's real response body when JSON mode can't produce valid JSON.
        new BadRequestError(400, { error: { code: 'json_validate_failed', message: 'Failed to generate JSON' } }, undefined, new Headers()),
      )
      .mockResolvedValueOnce(completion('{"ok": true}'));
    expect((await new GroqProvider('key').completeJson(REQ, schema)).value).toEqual({ ok: true });
  });

  it.each([
    [new APIConnectionTimeoutError(), 'timeout'],
    [new RateLimitError(429, {}, 'slow down', new Headers()), 'rate_limited'],
    [new InternalServerError(503, {}, 'down', new Headers()), 'upstream'],
  ])('maps %p to AiError(%s) without retrying in our code', async (err, kind) => {
    mockCreate.mockRejectedValueOnce(err);
    const call = new GroqProvider('key').completeJson(REQ, schema);
    await expect(call).rejects.toBeInstanceOf(AiError);
    await expect(call).rejects.toMatchObject({ kind });
    // The SDK's own maxRetries handles transport retries; we don't double up.
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('rejects empty text completions', async () => {
    mockCreate.mockResolvedValueOnce(completion('   '));
    await expect(new GroqProvider('key').completeText({ ...REQ, purpose: 'draft' })).rejects.toMatchObject({ kind: 'invalid_output' });
  });
});
