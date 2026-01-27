import { z } from 'zod';

/**
 * Environment variables schema
 *
 * Uses Zod for runtime validation of environment variables.
 * Ensures all required environment variables are present and correctly typed.
 *
 * Note: NEXT_PUBLIC_* variables are exposed to the browser.
 */
const envSchema = z.object({
  // API URL - defaults to localhost in development
  NEXT_PUBLIC_API_URL: z
    .string()
    .url()
    .default('http://localhost:4000'),

  // Node environment
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
});

/**
 * Parsed and validated environment variables
 *
 * Access environment variables through this object for type safety.
 *
 * @example
 * import { env } from '@/lib/env';
 * console.log(env.NEXT_PUBLIC_API_URL);
 */
function getEnv() {
  // Only run on the server or during build
  // Client-side: NEXT_PUBLIC_* vars are inlined by Next.js at build time
  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NODE_ENV: process.env.NODE_ENV,
  });

  if (!parsed.success) {
    console.error(
      '❌ Invalid environment variables:',
      parsed.error.flatten().fieldErrors
    );
    // In development, throw to catch config issues early
    // In production, use defaults to prevent crashes
    if (process.env.NODE_ENV === 'development') {
      throw new Error('Invalid environment variables');
    }
  }

  return parsed.data ?? envSchema.parse({});
}

export const env = getEnv();

/**
 * Type for environment variables
 */
export type Env = z.infer<typeof envSchema>;
