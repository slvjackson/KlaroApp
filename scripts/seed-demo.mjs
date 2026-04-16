/**
 * Demo seed script — creates tables via drizzle-kit push, then inserts
 * one demo user + ~80 realistic transactions across Jan–Apr 2026.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node scripts/seed-demo.mjs
 */

import { execSync } from "node:child_process";
import pg from "pg";
import bcryptjs from "bcryptjs";

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌  Set DATABASE_URL before running this script.");
  process.exit(1);
}

// ── 1. Push schema ──────────────────────────────────────────────────────────
console.log("📦  Pushing schema to database...");
try {
  execSync("pnpm --filter @workspace/db push", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL },
  });
  console.log("✅  Schema ready.\n");
} catch {
  console.error("❌  drizzle-kit push failed. Aborting.");
  process.exit(1);
}

// ── 2. Connect ──────────────────────────────────────────────────────────────
const pool = new Pool({ connectionString: DATABASE_URL });

// ── 3. Demo user ────────────────────────────────────────────────────────────
const DEMO_EMAIL = "demo@klaro.app";
const DEMO_PASSWORD = "klaro123";
const DEMO_NAME = "Demo User";

async function ensureUser(client) {
  const existing = await client.query(
    "SELECT id FROM users WHERE email = $1",
    [DEMO_EMAIL]
  );
  if (existing.rows.length > 0) {
    console.log(`👤  User already exists (id=${existing.rows[0].id})`);
    return existing.rows[0].id;
  }
  const hash = await bcryptjs.hash(DEMO_PASSWORD, 10);
  const res = await client.query(
    "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
    [DEMO_NAME, DEMO_EMAIL, hash]
  );
  console.log(`👤  Created user id=${res.rows[0].id} (${DEMO_EMAIL} / ${DEMO_PASSWORD})`);
  return res.rows[0].id;
}

// ── 4. Transaction data ──────────────────────────────────────────────────────
const MONTHS = ["2026-01", "2026-02", "2026-03", "2026-04"];

const incomes = [
  { description: "Salário", amount: 8500, category: "Renda" },
  { description: "Freelance design", amount: 1200, category: "Freelance" },
  { description: "Reembolso empresa", amount: 350, category: "Outros" },
  { description: "Rendimento CDB", amount: 180, category: "Investimentos" },
  { description: "Consultoria extra", amount: 900, category: "Freelance" },
];

const expenses = [
  // Moradia
  { description: "Aluguel", amount: 2200, category: "Moradia" },
  { description: "Condomínio", amount: 480, category: "Moradia" },
  { description: "Conta de luz", amount: 190, category: "Moradia" },
  { description: "Conta de água", amount: 85, category: "Moradia" },
  { description: "Internet", amount: 120, category: "Moradia" },
  // Alimentação
  { description: "Supermercado Pão de Açúcar", amount: 620, category: "Alimentação" },
  { description: "Feira livre", amount: 130, category: "Alimentação" },
  { description: "iFood", amount: 85, category: "Alimentação" },
  { description: "Padaria", amount: 45, category: "Alimentação" },
  { description: "Restaurante", amount: 95, category: "Alimentação" },
  { description: "Cafeteria", amount: 38, category: "Alimentação" },
  // Transporte
  { description: "Gasolina", amount: 280, category: "Transporte" },
  { description: "Uber", amount: 65, category: "Transporte" },
  { description: "Manutenção carro", amount: 340, category: "Transporte" },
  { description: "Pedágio", amount: 42, category: "Transporte" },
  // Saúde
  { description: "Plano de saúde", amount: 520, category: "Saúde" },
  { description: "Farmácia", amount: 95, category: "Saúde" },
  { description: "Consulta médica", amount: 250, category: "Saúde" },
  // Lazer
  { description: "Netflix", amount: 45, category: "Lazer" },
  { description: "Spotify", amount: 22, category: "Lazer" },
  { description: "Cinema", amount: 68, category: "Lazer" },
  { description: "Academia", amount: 110, category: "Lazer" },
  // Educação
  { description: "Curso online Udemy", amount: 89, category: "Educação" },
  { description: "Livros", amount: 75, category: "Educação" },
  // Vestuário
  { description: "Roupa Renner", amount: 220, category: "Vestuário" },
  // Serviços
  { description: "Celular Tim", amount: 98, category: "Serviços" },
];

function randomDay(month) {
  const [year, m] = month.split("-").map(Number);
  const maxDay = new Date(year, m, 0).getDate();
  const day = Math.floor(Math.random() * maxDay) + 1;
  return `${month}-${String(day).padStart(2, "0")}`;
}

function jitter(amount) {
  // ±10% variance
  const factor = 0.9 + Math.random() * 0.2;
  return Math.round(amount * factor * 100) / 100;
}

function buildTransactions(userId) {
  const rows = [];

  for (const month of MONTHS) {
    // 1-2 income entries per month
    const monthIncomes = [incomes[0]]; // always salary
    if (Math.random() > 0.4) monthIncomes.push(incomes[Math.floor(Math.random() * (incomes.length - 1)) + 1]);

    for (const t of monthIncomes) {
      rows.push({
        userId,
        date: randomDay(month),
        description: t.description,
        amount: jitter(t.amount),
        type: "income",
        category: t.category,
      });
    }

    // Most expenses every month, a few random ones
    for (const t of expenses) {
      // Skip a few random expenses to make data feel natural
      if (Math.random() < 0.12) continue;
      rows.push({
        userId,
        date: randomDay(month),
        description: t.description,
        amount: jitter(t.amount),
        type: "expense",
        category: t.category,
      });
    }
  }

  return rows;
}

// ── 5. Insert ────────────────────────────────────────────────────────────────
async function main() {
  const client = await pool.connect();
  try {
    const userId = await ensureUser(client);

    // Clear existing transactions for this user to avoid duplicates on re-run
    await client.query("DELETE FROM transactions WHERE user_id = $1", [userId]);

    const transactions = buildTransactions(userId);

    console.log(`\n📊  Inserting ${transactions.length} transactions for user_id=${userId}...`);

    for (const t of transactions) {
      await client.query(
        `INSERT INTO transactions (user_id, date, description, amount, type, category)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [t.userId, t.date, t.description, t.amount, t.type, t.category]
      );
    }

    // Summary
    const incomeTotal = transactions
      .filter(t => t.type === "income")
      .reduce((s, t) => s + t.amount, 0);
    const expenseTotal = transactions
      .filter(t => t.type === "expense")
      .reduce((s, t) => s + t.amount, 0);

    console.log(`\n✅  Done!`);
    console.log(`   Income:   R$ ${incomeTotal.toFixed(2)}`);
    console.log(`   Expenses: R$ ${expenseTotal.toFixed(2)}`);
    console.log(`   Balance:  R$ ${(incomeTotal - expenseTotal).toFixed(2)}`);
    console.log(`\n🔑  Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
