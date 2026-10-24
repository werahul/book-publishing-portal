import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

// Load server/.env for local development. Tests configure process.env themselves
// (tests/setup-env.ts) and must never pick up a real database URI.
if (process.env.NODE_ENV !== 'test') {
  const envFile = path.resolve(process.cwd(), '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.url().default('http://localhost:3000'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  /** Optional comma-separated DNS servers for Node's resolver (fixes mongodb+srv lookups on some networks). */
  DNS_SERVERS: z
    .string()
    .optional()
    .transform((v) => v?.split(',').map((s) => s.trim()).filter(Boolean) ?? []),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  // AI is optional at boot: without a key the app runs and falls back to manual handling.
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL_CLASSIFY: z.string().default('llama-3.1-8b-instant'),
  GROQ_MODEL_DRAFT: z.string().default('llama-3.3-70b-versatile'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  // Fail fast: a misconfigured server should never start half-working.
  throw new Error(`Invalid environment configuration:\n${problems}`);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
