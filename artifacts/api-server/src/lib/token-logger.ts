import { db, tokenUsagesTable } from "@workspace/db";
import type { TokenSource } from "@workspace/db";
import { logger } from "./logger";

// USD cost per 1M tokens (as of 2025)
const INPUT_COST_PER_M: Record<string, number> = {
  "claude-sonnet-4-6": 3.0,
  "claude-haiku-4-5-20251001": 0.8,
};
const OUTPUT_COST_PER_M: Record<string, number> = {
  "claude-sonnet-4-6": 15.0,
  "claude-haiku-4-5-20251001": 4.0,
};

export function tokenCostUSD(model: string, inputTokens: number, outputTokens: number): number {
  const inRate = INPUT_COST_PER_M[model] ?? 3.0;
  const outRate = OUTPUT_COST_PER_M[model] ?? 15.0;
  return (inputTokens / 1_000_000) * inRate + (outputTokens / 1_000_000) * outRate;
}

export function logTokenUsage(
  userId: number,
  source: TokenSource,
  model: string,
  inputTokens: number,
  outputTokens: number,
): void {
  db.insert(tokenUsagesTable)
    .values({ userId, source, model, inputTokens, outputTokens })
    .catch((e) => logger.warn({ err: e, userId, source }, "Failed to log token usage"));
}
