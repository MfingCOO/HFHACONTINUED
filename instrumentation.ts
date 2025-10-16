// instrumentation.ts
import { loadEnvConfig } from '@next/env';

export async function register() {
  loadEnvConfig(process.cwd());
}
