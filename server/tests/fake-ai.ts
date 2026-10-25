import type { z } from 'zod';
import { AiError, type AiProvider, type AiRequest, type AiResult } from '../src/modules/ai/ai.provider';

/** One scripted reply: a raw value (validated like a real provider would), an error, or a gate to await first. */
type Step = { value: unknown } | { error: AiError } | { wait: Promise<void>; then: Step };

/**
 * Scripted stand-in for Groq. Queue replies per purpose; an empty queue throws
 * (`upstream`) so a test never silently hits a default.
 */
export class FakeAiProvider implements AiProvider {
  readonly name = 'fake';
  readonly calls: AiRequest[] = [];
  private readonly queues: Record<AiRequest['purpose'], Step[]> = { classify: [], draft: [] };

  reply(purpose: AiRequest['purpose'], value: unknown): this {
    this.queues[purpose].push({ value });
    return this;
  }

  fail(purpose: AiRequest['purpose'], kind: AiError['kind']): this {
    this.queues[purpose].push({ error: new AiError(kind, `fake ${kind}`) });
    return this;
  }

  /** The next `purpose` call blocks until the returned function is called, then replies `value`. */
  hold(purpose: AiRequest['purpose'], value: unknown): () => void {
    let release!: () => void;
    const wait = new Promise<void>((resolve) => (release = resolve));
    this.queues[purpose].push({ wait, then: { value } });
    return release;
  }

  callsFor(purpose: AiRequest['purpose']): AiRequest[] {
    return this.calls.filter((c) => c.purpose === purpose);
  }

  async completeJson<T>(req: AiRequest, schema: z.ZodType<T>): Promise<AiResult<T>> {
    const raw = await this.next(req);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) throw new AiError('invalid_output', 'fake output failed validation');
    return { value: parsed.data, model: `fake-${req.model}`, usage: { promptTokens: 1, completionTokens: 1 } };
  }

  async completeText(req: AiRequest): Promise<AiResult<string>> {
    const raw = await this.next(req);
    return { value: String(raw), model: `fake-${req.model}`, usage: { promptTokens: 1, completionTokens: 1 } };
  }

  private async next(req: AiRequest): Promise<unknown> {
    this.calls.push(req);
    let step = this.queues[req.purpose].shift();
    if (!step) throw new AiError('upstream', `no scripted ${req.purpose} reply`);
    while ('wait' in step) {
      await step.wait;
      step = step.then;
    }
    if ('error' in step) throw step.error;
    return step.value;
  }
}
