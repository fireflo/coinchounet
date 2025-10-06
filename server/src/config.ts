import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

const parsePort = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: parsePort(process.env.PORT, 3001),
  devToken: process.env.DEV_TOKEN ?? 'dev-token',
  logLevel: process.env.LOG_LEVEL ?? 'info',
};
