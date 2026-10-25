import { logger } from './logger';

/**
 * Fire-and-forget work that must never block or fail the request that started it
 * (e.g. LLM classification after a ticket is created). Failures are logged, not thrown.
 */
const pending = new Set<Promise<void>>();

export function runInBackground(label: string, job: () => Promise<unknown>): void {
  const task: Promise<void> = Promise.resolve()
    .then(job)
    .then(
      () => undefined,
      (err: unknown) => logger.error(`[background] ${label} failed`, err),
    )
    .finally(() => pending.delete(task));
  pending.add(task);
}

/** Resolves once every background job (including ones started meanwhile) has finished. Used by tests and shutdown. */
export async function settleBackgroundJobs(): Promise<void> {
  while (pending.size > 0) await Promise.allSettled([...pending]);
}
