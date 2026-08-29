import "dotenv/config";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const env = {
  // Server
  PORT: parseInt(optionalEnv("PORT", "4000"), 10),

  // Database
  DATABASE_URL: requireEnv("DATABASE_URL"),

  // Redis
  REDIS_HOST: optionalEnv("REDIS_HOST", "localhost"),
  REDIS_PORT: parseInt(optionalEnv("REDIS_PORT", "6379"), 10),

  // Google OAuth
  GOOGLE_CLIENT_ID: requireEnv("GOOGLE_CLIENT_ID"),
  GOOGLE_CLIENT_SECRET: requireEnv("GOOGLE_CLIENT_SECRET"),
  GOOGLE_CALLBACK_URL: requireEnv("GOOGLE_CALLBACK_URL"),

  // JWT
  JWT_SECRET: requireEnv("JWT_SECRET"),

  // Frontend
  FRONTEND_URL: requireEnv("FRONTEND_URL"),

  // Ethereal SMTP
  ETHEREAL_USER: requireEnv("ETHEREAL_USER"),
  ETHEREAL_PASS: requireEnv("ETHEREAL_PASS"),

  // Worker / rate limit settings
  MAX_EMAILS_PER_HOUR: parseInt(optionalEnv("MAX_EMAILS_PER_HOUR", "20"), 10),
  MIN_DELAY_BETWEEN_EMAILS_MS: parseInt(
    optionalEnv("MIN_DELAY_BETWEEN_EMAILS_MS", "2000"),
    10
  ),
  WORKER_CONCURRENCY: parseInt(optionalEnv("WORKER_CONCURRENCY", "5"), 10),
  // Retry config: how many times BullMQ retries a failed job before giving up
  WORKER_MAX_ATTEMPTS: parseInt(optionalEnv("WORKER_MAX_ATTEMPTS", "3"), 10),
  // Exponential backoff base delay in ms (doubles each retry)
  WORKER_BACKOFF_MS: parseInt(optionalEnv("WORKER_BACKOFF_MS", "5000"), 10),

  // Elasticsearch
  ELASTICSEARCH_URL: optionalEnv("ELASTICSEARCH_URL", "http://localhost:9200"),

  // Admin dashboard (bull-board) basic auth
  ADMIN_USER:     optionalEnv("ADMIN_USER",     "admin"),
  ADMIN_PASSWORD: optionalEnv("ADMIN_PASSWORD", "admin"),

  // Slack OAuth
  SLACK_CLIENT_ID:     requireEnv("SLACK_CLIENT_ID"),
  SLACK_CLIENT_SECRET: requireEnv("SLACK_CLIENT_SECRET"),
  // The URL Slack redirects to after the user approves the app
  SLACK_CALLBACK_URL:  requireEnv("SLACK_CALLBACK_URL"),
};
