// Mock data for Klaro prototype — pt-BR
const BRL = (n) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n);
const BRL0 = (n) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0}).format(n);

const SUMMARY = {
  netBalance: 8427.55,
  totalIncome: 12850.00,
  totalExpenses: 4422.45,
  txCount: 47,
  deltaBalance: +12.4,  // % vs prev month
  deltaIncome: +4.1,
  deltaExpenses: -8.2,
  deltaTx: +6,
};

// last 7 months, most recent last
const MONTHLY = [
  { m:"Out/25", income: 9800,  expense: 5210 },
  { m:"Nov/25", income: 10100, expense: 6280 },
  { m:"Dez/25", income: 13500, expense: 7800 },
  { m:"Jan/26", income: 9500,  expense: 4900 },
  { m:"Fev/26", income: 11200, expense: 5100 },
  { m:"Mar/26", income: 12050, expense: 4810 },
  { m:"Abr/26", income: 12850, expense: 4422 },
];

const CATEGORIES = [
  { name:"Alimentação",  total: 1284.30, color:"#7c5cff", icon:"utensils" },
  { name:"Moradia",      total:  980.00, color:"#5b8cff", icon:"home" },
  { name:"Transporte",   total:  612.80, color:"#22d3ee", icon:"car" },
  { name:"Lazer",        total:  488.10, color:"#f59e0b", icon:"clapperboard" },
  { name:"Saúde",        total:  420.00, color:"#f472b6", icon:"heart-pulse" },
  { name:"Mercado",      total:  389.25, color:"#34d399", icon:"shopping-cart" },
  { name:"Assinaturas",  total:  248.00, color:"#fb923c", icon:"repeat" },
];

const TRANSACTIONS = [
  { id:1, desc:"Salário — Acme S.A.",         cat:"Receita",     date:"22 abr", time:"08:02", amount:  8500.00, type:"income",  icon:"briefcase" },
  { id:2, desc:"iFood — Almoço",              cat:"Alimentação", date:"22 abr", time:"12:41", amount:   -42.90, type:"expense", icon:"utensils" },
  { id:3, desc:"Uber — Vila Madalena",        cat:"Transporte",  date:"21 abr", time:"19:08", amount:   -28.40, type:"expense", icon:"car" },
  { id:4, desc:"Freela — Estúdio Boreal",     cat:"Receita",     date:"21 abr", time:"15:22", amount:  4350.00, type:"income",  icon:"briefcase" },
  { id:5, desc:"Netflix",                     cat:"Assinaturas", date:"20 abr", time:"06:00", amount:   -55.90, type:"expense", icon:"tv" },
  { id:6, desc:"Pão de Açúcar",               cat:"Mercado",     date:"20 abr", time:"18:34", amount:  -289.15, type:"expense", icon:"shopping-cart" },
  { id:7, desc:"Farmácia São Paulo",          cat:"Saúde",       date:"19 abr", time:"10:11", amount:   -78.40, type:"expense", icon:"heart-pulse" },
  { id:8, desc:"Aluguel — Abril",             cat:"Moradia",     date:"18 abr", time:"09:00", amount:  -980.00, type:"expense", icon:"home" },
  { id:9, desc:"Spotify Família",             cat:"Assinaturas", date:"18 abr", time:"06:00", amount:   -26.90, type:"expense", icon:"music" },
  { id:10,desc:"Cinema — Cinépolis",          cat:"Lazer",       date:"17 abr", time:"21:15", amount:   -64.00, type:"expense", icon:"clapperboard" },
];

const INSIGHTS = [
  { id:1, title:"Gasto com Alimentação caiu 14%", body:"Você economizou R$ 210 em comparação a Março. Continue assim.", tone:"good" },
  { id:2, title:"Assinaturas somam R$ 248/mês",   body:"3 delas não foram usadas nos últimos 30 dias. Revise e cancele.", tone:"warn" },
  { id:3, title:"Receita acima da média",         body:"Abril está 6,6% acima do ticket médio dos últimos 6 meses.",     tone:"good" },
];

const SUGGESTIONS = [
  "Qual foi minha receita este mês?",
  "Quais são minhas maiores despesas?",
  "Como está meu fluxo de caixa?",
  "Resumo financeiro de hoje",
];

// Canned assistant replies (keyword-matched, pt-BR)
const REPLIES = [
  {
    match: /receita|entradas|ganhei/i,
    reply:
`Em **Abril/26** você recebeu **${BRL(SUMMARY.totalIncome)}** em **12 entradas**.

• Salário Acme — R$ 8.500,00
• Freelas — R$ 4.350,00

Isso é **+4,1%** em relação a Março.`
  },
  {
    match: /despesa|gastos|saída|saida/i,
    reply:
`Suas **5 maiores categorias de saída** em Abril:

1. Alimentação — R$ 1.284,30
2. Moradia — R$ 980,00
3. Transporte — R$ 612,80
4. Lazer — R$ 488,10
5. Saúde — R$ 420,00

Juntas representam **85%** dos gastos do mês.`
  },
  {
    match: /fluxo|caixa|saldo/i,
    reply:
`Seu **fluxo de caixa** está positivo: **${BRL(SUMMARY.netBalance)}** de sobra em Abril.

Nos últimos 3 meses a média sobra foi de R$ 6.710 — você está **25,6% acima** da média. 🟢`
  },
  {
    match: /resumo|hoje|agora/i,
    reply:
`**Hoje — 22/04**
• 2 transações registradas
• Entradas: R$ 8.500,00 (salário Acme)
• Saídas: R$ 42,90 (iFood)

Saldo do dia: **+ R$ 8.457,10**.`
  },
  {
    match: /assinatura/i,
    reply:
`Você tem **7 assinaturas ativas** somando **R$ 248,00/mês**.

3 não tiveram uso nos últimos 30 dias:
• Revista+ — R$ 19,90
• CloudSync Pro — R$ 39,00
• AudioBooks — R$ 24,90

Cancelando essas 3, você economiza **R$ 1.006,80/ano**.`
  },
];

const DEFAULT_REPLY =
`Posso te ajudar com seu fluxo de caixa, categorias de gastos, tendências e comparações mês a mês.

Tente perguntar: _"quais são minhas maiores despesas?"_ ou _"como está meu fluxo de caixa?"_`;

Object.assign(window, { BRL, BRL0, SUMMARY, MONTHLY, CATEGORIES, TRANSACTIONS, INSIGHTS, SUGGESTIONS, REPLIES, DEFAULT_REPLY });
