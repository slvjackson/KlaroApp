import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

pool.query("ALTER TABLE insights ADD COLUMN IF NOT EXISTS tone TEXT").catch((e) =>
  logger.warn({ err: e }, "Could not add tone column to insights")
);
pool.query("ALTER TABLE insights ADD COLUMN IF NOT EXISTS steps JSON").catch((e) =>
  logger.warn({ err: e }, "Could not add steps column to insights")
);
pool.query("ALTER TABLE insights ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ").catch((e) =>
  logger.warn({ err: e }, "Could not add pinned_at column to insights")
);
pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ").catch((e) =>
  logger.warn({ err: e }, "Could not add email_verified_at column to users")
);
pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token TEXT").catch((e) =>
  logger.warn({ err: e }, "Could not add email_verification_token column to users")
);
pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ").catch((e) =>
  logger.warn({ err: e }, "Could not add email_verification_expires_at column to users")
);
pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT").catch((e) =>
  logger.warn({ err: e }, "Could not add password_reset_token column to users")
);
pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ").catch((e) =>
  logger.warn({ err: e }, "Could not add password_reset_expires_at column to users")
);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  logger.info({
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasSessionSecret: !!process.env.SESSION_SECRET,
  }, "Environment check");
});
