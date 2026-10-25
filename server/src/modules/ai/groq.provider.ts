import Groq, { APIConnectionTimeoutError, APIError, RateLimitError } from 'groq-sdk';
import type { z } from 'zod';
import { logger } from '../../lib/logger';
import { AiError, type AiProvider, type AiRequest, type AiResult, type AiUsage } from './ai.provider';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/** Per attempt. With one retry, a hung upstream costs the caller at most ~30 s. */
const TIMEOUT_MS = 15_000;

export class GroqProvider implements AiProvider {
  readonly name = 'groq';
  private readonly client: Groq;

  constructor(apiKey: string) {
    // The SDK retries 408/409/429/5xx and connection errors with exponential backoff.
    this.client = new Groq({ apiKey, timeout: TIMEOUT_MS, maxRetries: 1 });
  }

  async completeText(req: AiRequest): Promise<AiResult<string>> {
    const res = await this.chat(req, initialMessages(req), false);
    const value = res.content.trim();
    if (!value) throw new AiError('invalid_output', 'Empty completion');
    return { value, model: res.model, usage: res.usage };
  }

  async completeJson<T>(req: AiRequest, schema: z.ZodType<T>): Promise<AiResult<T>> {
    let messages = initialMessages(req);
    let usage: AiUsage | null = null;

    // One repair attempt: show the model its own output and what was wrong with it.
    for (let attempt = 1; attempt <= 2; attempt++) {
      let problem: string;
      let content = '';
      try {
        const res = await this.chat(req, messages, true);
        usage = addUsage(usage, res.usage);
        content = res.content;
        const parsed = schema.safeParse(JSON.parse(content));
        if (parsed.success) return { value: parsed.data, model: res.model, usage };
        problem = parsed.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`).join('; ');
      } catch (err) {
        if (err instanceof AiError && err.kind !== 'invalid_output') throw err;
        problem = 'the reply was not valid JSON';
      }

      logger.warn(`[ai] ${req.purpose}: invalid JSON output (attempt ${attempt}): ${problem}`);
      messages = [
        ...messages,
        ...(content ? [{ role: 'assistant' as const, content }] : []),
        {
          role: 'user',
          content: `That answer was invalid (${problem}). Reply again with only a JSON object in exactly the format the system prompt specifies.`,
        },
      ];
    }
    throw new AiError('invalid_output', 'Output failed validation after one repair attempt');
  }

  private async chat(req: AiRequest, messages: ChatMessage[], json: boolean) {
    const started = Date.now();
    try {
      const completion = await this.client.chat.completions.create({
        model: req.model,
        messages,
        temperature: req.temperature,
        max_completion_tokens: req.maxTokens,
        ...(json && { response_format: { type: 'json_object' as const } }),
        ...reasoningParams(req.model),
      });
      const usage: AiUsage | null = completion.usage
        ? { promptTokens: completion.usage.prompt_tokens, completionTokens: completion.usage.completion_tokens }
        : null;
      // Token logging for cost tracking (never logs prompt contents or the key).
      const reasoningTokens = completion.usage?.completion_tokens_details?.reasoning_tokens;
      logger.info(
        `[ai] ${req.purpose} model=${completion.model} prompt_tokens=${usage?.promptTokens ?? '?'} ` +
          `completion_tokens=${usage?.completionTokens ?? '?'}` +
          (reasoningTokens ? ` (reasoning ${reasoningTokens})` : '') +
          ` ms=${Date.now() - started}`,
      );
      return { content: completion.choices[0]?.message?.content ?? '', model: completion.model || req.model, usage };
    } catch (err) {
      throw toAiError(err);
    }
  }
}

/**
 * Reasoning models spend hidden "thinking" tokens out of max_completion_tokens.
 * Our tasks (labelling, a short reply grounded in given facts) need little of it,
 * so keep it minimal: at the default effort gpt-oss-20b exhausts a 150-token
 * classification budget and Groq rejects the truncated JSON.
 */
export function reasoningParams(model: string): { reasoning_effort?: 'none' | 'low' } {
  if (model.includes('gpt-oss')) return { reasoning_effort: 'low' }; // gpt-oss can't disable reasoning entirely
  if (model.includes('qwen3')) return { reasoning_effort: 'none' };
  return {};
}

function initialMessages(req: AiRequest): ChatMessage[] {
  return [
    { role: 'system', content: req.system },
    { role: 'user', content: req.user },
  ];
}

function addUsage(a: AiUsage | null, b: AiUsage | null): AiUsage | null {
  if (!a || !b) return b ?? a;
  return { promptTokens: a.promptTokens + b.promptTokens, completionTokens: a.completionTokens + b.completionTokens };
}

function toAiError(err: unknown): AiError {
  if (err instanceof APIConnectionTimeoutError) return new AiError('timeout', 'Groq request timed out');
  if (err instanceof RateLimitError) return new AiError('rate_limited', 'Groq rate limit reached');
  // JSON mode: Groq rejects completions that aren't valid JSON with a 400 "json_validate_failed".
  if (err instanceof APIError && err.status === 400 && /json_validate_failed/.test(`${err.message} ${JSON.stringify(err.error ?? {})}`)) {
    return new AiError('invalid_output', 'Groq could not produce valid JSON');
  }
  if (err instanceof APIError) return new AiError('upstream', `Groq error ${err.status ?? 'network'}`);
  return new AiError('upstream', 'Unexpected Groq client error');
}
