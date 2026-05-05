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
pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false").catch((e) =>
  logger.warn({ err: e }, "Could not add is_admin column to users")
);
pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'").catch((e) =>
  logger.warn({ err: e }, "Could not add status column to users")
);
pool.query("UPDATE subscriptions SET status='expired' WHERE status='cancelled'").catch((e) =>
  logger.warn({ err: e }, "Could not migrate cancelled subscriptions to expired")
);
pool.query(`CREATE TABLE IF NOT EXISTS operational_costs (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  amount_monthly NUMERIC(12,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`).catch((e) =>
  logger.warn({ err: e }, "Could not create operational_costs table")
);
pool.query("ALTER TABLE insights ADD COLUMN IF NOT EXISTS steps_progress JSON").catch((e) =>
  logger.warn({ err: e }, "Could not add steps_progress column to insights")
);
pool.query(`CREATE TABLE IF NOT EXISTS token_usages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  source TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`).catch((e) =>
  logger.warn({ err: e }, "Could not create token_usages table")
);
pool.query(`CREATE TABLE IF NOT EXISTS user_activities (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  activity_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`)
  .then(() =>
    pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS user_activities_user_date_unique ON user_activities(user_id, activity_date)`)
  )
  .catch((e) =>
    logger.warn({ err: e }, "Could not create user_activities table/index")
  );
pool.query(`CREATE TABLE IF NOT EXISTS daily_tasks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  task_date DATE NOT NULL,
  task_key TEXT NOT NULL,
  params JSONB,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`)
  .then(() =>
    pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS daily_tasks_user_date_key_unique ON daily_tasks(user_id, task_date, task_key)`)
  )
  .catch((e) =>
    logger.warn({ err: e }, "Could not create daily_tasks table/index")
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
