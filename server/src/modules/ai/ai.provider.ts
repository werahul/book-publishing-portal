import type { z } from 'zod';

/**
 * Provider-agnostic LLM interface. Prompts are built in classify.ts / draft.ts; the
 * provider only transports them. Tests swap in a fake via `setAiProvider`.
 */

export type AiPurpose = 'classify' | 'draft';

export interface AiRequest {
  /** Used for logging and cost attribution only. */
  purpose: AiPurpose;
  model: string;
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
}

export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface AiResult<T> {
  value: T;
  /** The model that actually answered (as reported by the provider). */
  model: string;
  usage: AiUsage | null;
}

export interface AiProvider {
  readonly name: string;
  /** JSON-mode completion, validated against `schema`. Throws AiError('invalid_output') if it can't be. */
  completeJson<T>(req: AiRequest, schema: z.ZodType<T>): Promise<AiResult<T>>;
  completeText(req: AiRequest): Promise<AiResult<string>>;
}

export type AiErrorKind = 'disabled' | 'timeout' | 'rate_limited' | 'upstream' | 'invalid_output';

/** An expected AI failure. Callers degrade gracefully (keyword triage, manual reply) instead of erroring. */
export class AiError extends Error {
  constructor(
    public readonly kind: AiErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

const KIND_MESSAGES: Record<AiErrorKind, string> = {
  disabled: 'AI is not configured on this server',
  timeout: 'The AI service timed out',
  rate_limited: 'The AI service is rate-limited right now',
  upstream: 'The AI service returned an error',
  invalid_output: 'The AI returned an unusable answer',
};

/** A short, admin-readable reason, safe to store on the ticket and show in the console. */
export function describeAiFailure(err: unknown): string {
  return err instanceof AiError ? KIND_MESSAGES[err.kind] : 'Unexpected error while calling the AI service';
}
