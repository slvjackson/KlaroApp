import type { SegmentProfile } from "../types";

export interface OcrPromptContext {
  businessName?: string;
  segment?: SegmentProfile;
  mainProducts?: string;
  salesChannel?: string;
}

/**
 * Builds the OCR extraction prompt, injecting segment-specific
 * terminology and document examples for better accuracy.
 */
export function buildOcrPrompt(ctx: OcrPromptContext): string {
  const seg = ctx.segment;

  const businessLines: string[] = [];
  if (ctx.businessName) businessLines.push(`- Nome do negócio: ${ctx.businessName}`);
  if (seg) businessLines.push(`- Segmento: ${seg.label}`);
  if (ctx.mainProducts) businessLines.push(`- Principais produtos/serviços: ${ctx.mainProducts}`);
  if (ctx.salesChannel) businessLines.push(`- Canal de vendas: ${ctx.salesChannel}`);

  const businessSection = businessLines.length > 0
    ? `\nContexto do negócio (use para interpretar melhor os dados):\n${businessLines.join("\n")}\n`
    : "";

  const segmentHints = seg
    ? `\nContexto de classificação para o segmento ${seg.label}:
- ENTRADA (tipo=entrada): ${seg.terminologia.receita} — dinheiro recebido (serviços prestados, vendas, contratos fechados)
- SAÍDA (tipo=saida): ${seg.terminologia.despesa} — dinheiro pago (custos, compras, despesas operacionais)
- Use seu conhecimento sobre ${seg.label} para identificar o tipo: ex. "Ensaio fotográfico" = entrada, "Compra lente" = saida
- Documentos comuns neste segmento: ${seg.exemplosDocumentos.join(", ")}
`
    : "\n- tipo=entrada para receitas/recebimentos, tipo=saida para despesas/pagamentos\n";

  return `Você é um assistente especializado em extração de dados financeiros de imagens.
Analise esta imagem (pode ser ${seg ? seg.exemplosDocumentos.slice(0, 3).join(", ") : "extrato bancário, caderno de anotações, nota fiscal, recibo"}, etc.).
Extraia as transações financeiras individuais e retorne SOMENTE um CSV com as colunas:
data,descricao,valor,tipo
${businessSection}${segmentHints}
Regras importantes:
- Extraia CADA linha de item individualmente. Se o mesmo produto aparece duas vezes, gere duas linhas separadas.
- NÃO inclua linhas de total, subtotal ou resumo (ex: "Total Dia", "Total", "Saldo").
- Se um item tiver quantidade entre parênteses (ex: "Água (3): 9,00"), use o valor total indicado (9.00). A quantidade é só informativa.
- Uma linha que começa com parênteses é um item SEPARADO, não uma anotação do item anterior.
- Valores SEMPRE positivos — use a coluna "tipo" para indicar entrada/saida.
- tipo: "entrada" para ${seg ? seg.terminologia.receita + "s" : "vendas/receitas/recebimentos"}, "saida" para ${seg ? seg.terminologia.despesa + "s" : "despesas/pagamentos"}.
- Itens sem valor especificado: omita.
- Use ponto como separador decimal (ex: 13.00, não 13,00).
- Use vírgula apenas para separar as colunas do CSV.
- Não inclua cabeçalho nem explicações — retorne apenas as linhas CSV.
- Se a imagem não contiver dados financeiros, retorne somente: SEM_DADOS

Regras de data (IMPORTANTE):
- Formato de saída sempre DD/MM/YYYY com o ano completo.
- Prefira sempre o padrão brasileiro DD/MM/YYYY. Só use MM/DD/YYYY se o dia for > 12 e estiver na segunda posição (ex: 01/13/2026 → mês=01, dia=13).
- Se houver apenas o dia (ex: "10") → use o dia 10, mês atual, ano atual.
- Se houver apenas dia e mês (ex: "10/01") → use dia 10, mês 01, ano atual.
- Se houver uma data geral para o grupo (ex: cabeçalho "05/04/2026") use-a para todos os itens daquele grupo.
- Nunca invente datas; se não houver nenhuma informação de data, use a data de hoje.`;
}