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

  const now = new Date();
  const anoAtual = now.getFullYear();
  const mesAtual = now.getMonth() + 1;
  const hojeBR = now.toLocaleDateString("pt-BR");

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
- MUITAS ANOTAÇÕES NÃO TÊM CABEÇALHO. NÃO presuma que a primeira linha é cabeçalho. Uma linha só é cabeçalho se contiver APENAS rótulos de coluna (ex.: "Categoria | Orçamento", "Descrição | Valor", "Data | Movimento | Crédito | Débito") e NENHUM valor monetário nem item real. Se a primeira linha já tem um item + valor (ex.: "Água 100", "Moradia 1200", "Venda 1 kit 18,00"), ela É uma transação e DEVE ser extraída — não a descarte como título. Na dúvida, trate como transação.
- EXTRAIA TODAS AS LINHAS DE DADOS. Quando houver cabeçalho, a primeira linha de dados logo após ele também é transação e NÃO pode ser pulada — não confunda o valor da primeira linha com o cabeçalho, mesmo que estejam visualmente próximos ou quase na mesma altura. Conte as linhas: o número de transações extraídas deve bater com o número de itens escritos.
- LEIA LINHA A LINHA (na horizontal), NUNCA coluna a coluna. Para cada transação, percorra a MESMA linha horizontal da descrição até a(s) coluna(s) de valor e pegue o valor que está na altura daquela linha. NÃO leia a coluna de valores como uma lista solta de números de cima para baixo — isso desalinha tudo quando uma linha não tem valor naquela coluna.
- PODE HAVER VÁRIAS COLUNAS DE VALOR (ex.: Crédito e Débito; Entrada e Saída; Valor único; +/−). Cada transação tem normalmente UM valor, que pode estar em QUALQUER uma dessas colunas. Uma célula vazia numa coluna é normal — o valor daquela linha está na outra coluna, na MESMA linha. NUNCA "empreste" ou desloque o valor da linha de cima ou de baixo para preencher uma célula vazia.
- Para casar a contagem, some os valores de TODAS as colunas de valor: o total de valores (Crédito + Débito + ...) deve bater com o número de linhas de transação. Se você só contar uma coluna, vai faltar valor e você vai (erradamente) deslocar as linhas.
- A COLUNA em que o valor aparece (e/ou a cor da escrita, ex.: vermelho para débito) é indicador de tipo: valor na coluna de débito/saída = "saida"; na coluna de crédito/entrada = "entrada" — isso vale mesmo que a descrição sugira o contrário.
- NUNCA inclua linhas de SALDO, em QUALQUER forma: "Saldo", "Saldo inicial", "Saldo final", "Saldo anterior", "Saldo do dia", "Saldo atual", "Saldo em caixa", etc. Linhas de saldo são posição acumulada, não movimentação — ignore-as completamente, mesmo que tenham valor e pareçam uma transação.
- NÃO inclua linhas de total, subtotal ou resumo (ex: "Total Dia", "Total", "Soma", "Subtotal").
- Ignore anotações/observações que não são transações (ex.: "Cartão = não soma", legendas, marcações como "(D)", "(2x cartão)"). Use-as apenas como contexto se ajudarem a entender o tipo.
- descricao: use SEMPRE o texto real do item (ex.: "Moradia", "Água", "Internet", "Aluguel", "Compras", "Venda 1 kit"). NUNCA escreva apenas "entrada"/"saida"/"saída" nem deixe a descrição vazia — a descrição é usada depois para categorizar, então preserve-a fielmente.
- Se um item tiver quantidade entre parênteses (ex: "Água (3): 9,00"), use o valor total indicado (9.00). A quantidade é só informativa.
- Uma linha que começa com parênteses é um item SEPARADO, não uma anotação do item anterior.
- Valores SEMPRE positivos — use a coluna "tipo" para indicar entrada/saida.
- tipo: "entrada" para ${seg ? seg.terminologia.receita + "s" : "vendas/receitas/recebimentos"}, "saida" para ${seg ? seg.terminologia.despesa + "s" : "despesas/pagamentos"}.
- PRIORIDADE: se a imagem tiver QUALQUER coluna/campo indicando a direção da transação (ex.: Tipo, Natureza, D/C, Entrada/Saída, Receita/Despesa, Crédito/Débito, sinal +/-), essa indicação é AUTORITATIVA para cada linha — respeite-a INDEPENDENTEMENTE do que a descrição sugira. Interprete o rótulo de forma semântica e dinâmica, sem depender de uma lista fixa de palavras. Só classifique pela descrição quando não houver nenhuma indicação explícita.
- Considere TODA a informação visível em cada linha/registro (todas as colunas e campos) como contexto de análise ao classificar.
- Se a linha é claramente uma transação (tem descrição de item) mas o valor está ilegível, ausente ou desalinhado, NÃO descarte a linha: extraia com valor 0 para o usuário corrigir na revisão. Só omita o que claramente não é transação (títulos, saldos, totais, anotações).
- Use ponto como separador decimal (ex: 13.00, não 13,00).
- Use vírgula apenas para separar as colunas do CSV.
- Não inclua cabeçalho nem explicações — retorne apenas as linhas CSV.
- Se a imagem não contiver dados financeiros, retorne somente: SEM_DADOS

VERIFICAÇÃO OBRIGATÓRIA antes de responder (faça mentalmente, não escreva):
1. Volte ao TOPO da lista. A PRIMEIRA linha de transação (logo após título/cabeçalho, se houver) está na sua resposta? Ela é a mais esquecida — confirme que não pulou.
2. Conte as linhas de transação escritas na imagem (excluindo título, saldos, totais e anotações). O número de linhas no seu CSV deve ser EXATAMENTE igual. Se for menor, você pulou alguma — releia da primeira à última.
3. Para CADA linha, confira percorrendo a HORIZONTAL: a descrição e o valor estão na MESMA linha física? Some os valores de todas as colunas (crédito + débito + ...) — o total de valores deve bater com o nº de linhas. Se um valor "sobrou" ou "faltou", você leu a coluna como lista vertical e desalinhou — refaça linha a linha.
4. Para CADA linha, o tipo (entrada/saida) foi definido pela COLUNA onde o valor está (crédito=entrada, débito=saída), e não pela descrição? Corrija os que classificou pela descrição (ex.: "pagamento compra X" recebido na coluna crédito é ENTRADA, não saída).

Regras de data (IMPORTANTE) — hoje é ${hojeBR} (ano atual = ${anoAtual}, mês atual = ${mesAtual}):
- Formato de saída sempre DD/MM/YYYY com o ano completo.
- Prefira sempre o padrão brasileiro DD/MM/YYYY. Só use MM/DD/YYYY se o dia for > 12 e estiver na segunda posição (ex: 01/13/${anoAtual} → mês=01, dia=13).
- Quando a anotação NÃO tiver ano (ex.: "01/05", "10/3"), use SEMPRE o ano atual ${anoAtual}. NUNCA use ${anoAtual - 1} nem outro ano — não invente o ano.
- Se houver apenas o dia (ex: "10") → use o dia 10, mês atual (${mesAtual}), ano atual (${anoAtual}).
- Se houver apenas dia e mês (ex: "10/01") → use dia 10, mês 01, ano atual (${anoAtual}).
- Se houver uma data geral/ano explícito para o grupo (ex: cabeçalho "05/04/${anoAtual}") use-a para todos os itens daquele grupo.
- Nunca invente datas; se não houver nenhuma informação de data, use a data de hoje (${hojeBR}).`;
}