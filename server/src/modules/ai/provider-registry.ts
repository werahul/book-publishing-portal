import { env } from '../../config/env';
import { AiError, type AiProvider } from './ai.provider';
import { GroqProvider } from './groq.provider';

let defaultProvider: AiProvider | undefined;
/** `undefined` = use the env-configured provider; `null` = force "AI disabled". */
let override: AiProvider | null | undefined;

/** The active provider. Throws AiError('disabled') when no GROQ_API_KEY is configured. */
export function getAiProvider(): AiProvider {
  if (override !== undefined) {
    if (override === null) throw new AiError('disabled', 'AI disabled');
    return override;
  }
  if (!env.GROQ_API_KEY) throw new AiError('disabled', 'GROQ_API_KEY is not set');
  defaultProvider ??= new GroqProvider(env.GROQ_API_KEY);
  return defaultProvider;
}

/** Test seam: install a fake (or `null` to simulate a missing key). Pass `undefined` to reset. */
export function setAiProvider(provider: AiProvider | null | undefined): void {
  override = provider;
}
