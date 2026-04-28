import type { SegmentProfile } from "../types";

export interface InsightsPromptContext {
  businessName?: string;
  segment?: SegmentProfile;
  segmentCustomLabel?: string;
  city?: string;
  state?: string;
  employeeCount?: number;
  monthlyRevenueGoal?: number;
  profitMarginGoal?: number;
  mainProducts?: string;
  salesChannel?: string;
  biggestChallenge?: string;
  periodLabel: string;
}

/**
 * Builds the system + user prompt for insight generation,
 * injecting segment-specific focus, tone and challenge flags.
 */
export function buildInsightsPrompt(financialSummary: string, ctx: InsightsPromptContext): string {
  const seg = ctx.segment;

  const profileLines: string[] = [];
  if (ctx.businessName) profileLines.push(`Nome do negócio: ${ctx.businessName}`);
  if (seg) profileLines.push(`Segmento: ${seg.label}`);
  if (ctx.city || ctx.state) profileLines.push(`Localização: ${[ctx.city, ctx.state].filter(Boolean).join(", ")}`);
  if (ctx.employeeCount !== undefined) profileLines.push(`Funcionários: ${ctx.employeeCount}`);
  if (ctx.mainProducts) profileLines.push(`Principais ${seg?.terminologia.produto ?? "produtos/serviços"}: ${ctx.mainProducts}`);
  if (ctx.salesChannel) profileLines.push(`Canal de vendas: ${ctx.salesChannel}`);
  if (ctx.monthlyRevenueGoal !== undefined) profileLines.push(`Meta de ${seg?.terminologia.receita ?? "receita"} mensal: R$${ctx.monthlyRevenueGoal.toFixed(2)}`);
  if (ctx.profitMarginGoal !== undefined) profileLines.push(`Meta de margem de lucro: ${ctx.profitMarginGoal}%`);
  if (ctx.biggestChallenge) profileLines.push(`Maior desafio declarado: ${ctx.biggestChallenge}`);

  const profileSection = profileLines.length > 0
    ? `\nPERFIL DO NEGÓCIO:\n${profileLines.map((l) => `  ${l}`).join("\n")}\n`
    : "";

  const customLabelNote = ctx.segmentCustomLabel
    ? `\nATENÇÃO: O usuário declarou que seu segmento é "${ctx.segmentCustomLabel}". Todos os insights devem ser gerados com o conhecimento e a perspectiva de um especialista em negócios de ${ctx.segmentCustomLabel}. Não aplique exemplos, terminologia ou desafios de outros segmentos.\n`
    : "";

  const segmentGuidelines = seg
    ? `\nDIRETRIZES PARA ${seg.label.toUpperCase()}:
- Foco de análise: ${seg.focoInsights}
- Tom: ${seg.tom}
- Terminologia correta: use "${seg.terminologia.receita}" para receitas, "${seg.terminologia.despesa}" para despesas, "${seg.terminologia.cliente}" para clientes
- Desafios típicos para ficar de olho: ${seg.desafiosComuns.join("; ")}
`
    : "";

  return `Você é um consultor financeiro especialista em pequenos e médios negócios brasileiros.
Analise os dados financeiros abaixo e gere entre 3 e 5 insights práticos e acionáveis para o dono do negócio.
${profileSection}${segmentGuidelines}${customLabelNote}
${financialSummary}

Retorne SOMENTE um JSON válido com este formato (sem markdown, sem explicações):
[
  {
    "title": "Título curto do insight (máx 8 palavras)",
    "description": "Análise em 2-3 frases, com números concretos do resumo acima. Tom direto como um consultor falando com o dono.",
    "recommendation": "1 ação concreta e específica que o dono pode fazer agora. Máx 2 frases.",
    "periodLabel": "${ctx.periodLabel}"
  }
]

Diretrizes gerais:
- SEMPRE gere ao menos 3 insights, independente do volume de dados — com poucos dados, foque no que está disponível e aponte o que falta para análises mais completas
- Nunca retorne um array vazio; se os dados forem limitados, comente isso dentro do insight
- Use linguagem simples e direta, como conversa entre amigos
- Cite números reais do resumo (R$, %, meses)
- Cada insight deve abordar um ângulo diferente: tendência, produto/serviço, despesa, oportunidade, alerta
- Seja específico ao negócio — se um produto ou categoria aparece nos dados, mencione pelo nome
- Se houver metas definidas (receita ou margem), compare o desempenho real vs. meta
- Use a terminologia correta para o segmento (conforme diretrizes acima)`;
}