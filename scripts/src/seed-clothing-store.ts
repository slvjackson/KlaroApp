/**
 * Seed script: 6 months of transactions for a fictional clothing store
 * Usage: DATABASE_URL=... npx tsx scripts/src/seed-clothing-store.ts
 */

import { eq } from "drizzle-orm";
import { db, pool } from "../../lib/db/src/index";
import * as schema from "../../lib/db/src/schema";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function rand(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Data model ───────────────────────────────────────────────────────────────

const INCOME_ITEMS = [
  { desc: "Venda camiseta básica", min: 49, max: 79 },
  { desc: "Venda calça jeans feminina", min: 129, max: 189 },
  { desc: "Venda calça jeans masculina", min: 119, max: 179 },
  { desc: "Venda vestido floral", min: 89, max: 149 },
  { desc: "Venda blusa feminina", min: 59, max: 99 },
  { desc: "Venda shorts jeans", min: 69, max: 109 },
  { desc: "Venda moletom", min: 99, max: 159 },
  { desc: "Venda conjunto esportivo", min: 149, max: 229 },
  { desc: "Venda saia midi", min: 79, max: 129 },
  { desc: "Venda blazer feminino", min: 189, max: 289 },
  { desc: "Venda camisa social masculina", min: 99, max: 149 },
  { desc: "Venda legging", min: 59, max: 89 },
  { desc: "Venda cropped", min: 39, max: 69 },
  { desc: "Venda macacão", min: 139, max: 199 },
  { desc: "Venda casaco inverno", min: 199, max: 349 },
];

const EXPENSE_ITEMS: { desc: string; category: string; min: number; max: number; monthly?: boolean }[] = [
  // Fixed monthly
  { desc: "Aluguel loja shopping", category: "Aluguel", min: 3500, max: 3500, monthly: true },
  { desc: "Salário vendedora Ana", category: "Folha de Pagamento", min: 1800, max: 1800, monthly: true },
  { desc: "Salário vendedora Paula", category: "Folha de Pagamento", min: 1800, max: 1800, monthly: true },
  { desc: "Conta de energia", category: "Utilidades", min: 380, max: 520, monthly: true },
  { desc: "Internet e telefone", category: "Utilidades", min: 180, max: 180, monthly: true },
  { desc: "Simples Nacional", category: "Impostos", min: 420, max: 680, monthly: true },
  { desc: "Sistema PDV mensal", category: "Equipamentos", min: 89, max: 89, monthly: true },
  // Variable
  { desc: "Compra roupas fornecedor Moda Sul", category: "Fornecedores", min: 1800, max: 3200 },
  { desc: "Compra roupas fornecedor StyleBR", category: "Fornecedores", min: 1200, max: 2800 },
  { desc: "Sacolas e embalagens", category: "Fornecedores", min: 120, max: 280 },
  { desc: "Cabide e display vitrine", category: "Equipamentos", min: 80, max: 250 },
  { desc: "Anúncio Instagram/Facebook", category: "Marketing", min: 200, max: 600 },
  { desc: "Impressão cartaz promoção", category: "Marketing", min: 60, max: 150 },
  { desc: "Frete entrega fornecedor", category: "Fornecedores", min: 80, max: 180 },
];

// ─── Generate transactions ────────────────────────────────────────────────────

interface TxSeed {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
}

function generateTransactions(): TxSeed[] {
  const txs: TxSeed[] = [];

  for (let monthsBack = 0; monthsBack < 6; monthsBack++) {
    const monthStart = monthsBack * 30;
    const monthEnd = monthStart + 29;

    // Monthly fixed expenses (1st of month approx)
    for (const item of EXPENSE_ITEMS.filter((e) => e.monthly)) {
      txs.push({
        date: daysAgo(monthEnd - 1),
        description: item.desc,
        amount: rand(item.min, item.max),
        type: "expense",
        category: item.category,
      });
    }

    // Daily sales — weekdays busier
    for (let d = monthStart; d <= monthEnd; d++) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat

      // Quieter on Sundays (closed), moderate Mon-Thu, busy Fri-Sat
      const salesCount =
        dayOfWeek === 0 ? 0 :
        dayOfWeek === 6 ? rand(8, 14) :
        dayOfWeek === 5 ? rand(6, 10) :
        rand(2, 6);

      for (let s = 0; s < salesCount; s++) {
        const item = pick(INCOME_ITEMS);
        const qty = Math.random() < 0.3 ? 2 : 1;
        txs.push({
          date: daysAgo(d),
          description: qty > 1 ? `${item.desc} (${qty} un)` : item.desc,
          amount: rand(item.min, item.max) * qty,
          type: "income",
          category: "Vendas",
        });
      }

      // Variable expenses ~2x per week
      if (Math.random() < 0.28) {
        const exp = pick(EXPENSE_ITEMS.filter((e) => !e.monthly));
        txs.push({
          date: daysAgo(d),
          description: exp.desc,
          amount: rand(exp.min, exp.max),
          type: "expense",
          category: exp.category,
        });
      }
    }

    // Black Friday boost (month 5 = ~5 months ago, simulate Nov)
    if (monthsBack === 4) {
      for (let bf = 0; bf < 3; bf++) {
        const item = pick(INCOME_ITEMS);
        txs.push({
          date: daysAgo(monthEnd - bf),
          description: `[Black Friday] ${item.desc}`,
          amount: rand(item.min * 0.7, item.max * 1.2),
          type: "income",
          category: "Vendas",
        });
      }
    }
  }

  return txs;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Find demo user
  const users = await db.select().from(schema.usersTable).limit(1);
  if (users.length === 0) {
    throw new Error("No users found. Run the demo user seed first.");
  }
  const userId = users[0].id;
  console.log(`Seeding for user: ${users[0].email}`);

  // Remove existing seeded transactions to avoid duplicates
  const existing = await db
    .select({ id: schema.transactionsTable.id })
    .from(schema.transactionsTable)
    .where(eq(schema.transactionsTable.userId, userId));

  if (existing.length > 0) {
    await db.delete(schema.transactionsTable)
      .where(eq(schema.transactionsTable.userId, userId));
    console.log(`Removed ${existing.length} existing transactions`);
  }

  const txs = generateTransactions();
  console.log(`Inserting ${txs.length} transactions...`);

  // Insert in batches of 100
  for (let i = 0; i < txs.length; i += 100) {
    const batch = txs.slice(i, i + 100);
    await db.insert(schema.transactionsTable).values(
      batch.map((tx) => ({
        userId,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        category: tx.category,
        sourceRawInputId: null,
      }))
    );
  }

  const income = txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  console.log(`✅ Done!`);
  console.log(`   Total income:   R$ ${income.toFixed(2)}`);
  console.log(`   Total expenses: R$ ${expenses.toFixed(2)}`);
  console.log(`   Net balance:    R$ ${(income - expenses).toFixed(2)}`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
