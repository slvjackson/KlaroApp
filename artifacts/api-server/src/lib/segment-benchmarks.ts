/**
 * Benchmarks agregados anônimos por segmento.
 *
 * Computa estatísticas medianas (margem %, receita, despesa) entre todos os
 * usuários do mesmo segmento, pra um mês de referência. Privacy-preserving:
 * - Nunca expõe valores individuais
 * - Mínimo de MIN_USERS_PER_SEGMENT antes de retornar dados (senão null)
 * - Mediana é menos sensível a outliers do que média
 *
 * Cache em memória com TTL de 1h. Para multi-instance ou volume alto, mover
 * pra tabela `segment_benchmarks` com cron (ver BACKLOG.md).
 */

import { db, transactionsTable, usersTable } from "@workspace/db";
import { eq, and, like, sql } from "drizzle-orm";
import { logger } from "./logger";

const MIN_USERS_PER_SEGMENT = 5;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

export interface SegmentBenchmark {
  segment: string;
  monthRef: string;          // YYYY-MM
  userCount: number;         // quantos usuários contribuíram
  medianIncome: number;
  medianExpense: number;
  medianMargin: number;
  medianMarginPct: number;   // margem como % da receita
}

interface CacheEntry {
  data: SegmentBenchmark | null;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export async function getSegmentBenchmark(segment: string, monthRef: string): Promise<SegmentBenchmark | null> {
  if (!segment || segment === "outro") return null;

  const cacheKey = `${segment}:${monthRef}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  try {
    // Usuários no segmento — businessProfile é JSONB, filtramos por igualdade no campo `segment`
    const usersInSegment = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(sql`${usersTable.businessProfile}->>'segment' = ${segment}`);

    if (usersInSegment.length < MIN_USERS_PER_SEGMENT) {
      const result = null;
      cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
      return result;
    }

    const userIds = usersInSegment.map((u) => u.id);

    // Agregados por usuário pro mês de referência
    const rows = await db
      .select({
        userId: transactionsTable.userId,
        type: transactionsTable.type,
        total: sql<string>`SUM(${transactionsTable.amount})`,
      })
      .from(transactionsTable)
      .where(and(
        sql`${transactionsTable.userId} = ANY(${userIds})`,
        like(transactionsTable.date, `${monthRef}%`),
      ))
      .groupBy(transactionsTable.userId, transactionsTable.type);

    // Reduzir pra { userId: { income, expense } }
    const perUser = new Map<number, { income: number; expense: number }>();
    for (const r of rows) {
      const uid = Number(r.userId);
      if (!perUser.has(uid)) perUser.set(uid, { income: 0, expense: 0 });
      const slot = perUser.get(uid)!;
      const total = Number(r.total) || 0;
      if (r.type === "income") slot.income = total; else slot.expense = total;
    }

    // Filtrar usuários com algum movimento no mês
    const active = [...perUser.values()].filter((u) => u.income > 0 || u.expense > 0);

    if (active.length < MIN_USERS_PER_SEGMENT) {
      cache.set(cacheKey, { data: null, expiresAt: Date.now() + CACHE_TTL_MS });
      return null;
    }

    const incomes = active.map((u) => u.income);
    const expenses = active.map((u) => u.expense);
    const margins = active.map((u) => u.income - u.expense);
    const marginPcts = active.map((u) => u.income > 0 ? ((u.income - u.expense) / u.income) * 100 : 0);

    const data: SegmentBenchmark = {
      segment,
      monthRef,
      userCount: active.length,
      medianIncome: Math.round(median(incomes)),
      medianExpense: Math.round(median(expenses)),
      medianMargin: Math.round(median(margins)),
      medianMarginPct: Math.round(median(marginPcts)),
    };

    cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  } catch (e) {
    logger.warn({ err: e, segment, monthRef }, "segment benchmark computation failed");
    return null;
  }
}
