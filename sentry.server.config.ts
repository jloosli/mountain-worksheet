import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? "https://a0e585a5294467f3fdf3dbdad0f7fdff@o147153.ingest.us.sentry.io/4512325405376512",
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,

  // 100% in dev, 10% in production
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Attach local variable values to stack frames
  includeLocalVariables: true,
});
