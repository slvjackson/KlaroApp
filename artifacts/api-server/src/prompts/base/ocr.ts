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
Sua resposta tem DUAS partes obrigatórias, nesta ordem exata:

PARTE 1 — TRANSCRIÇÃO LINHA A LINHA (faça ANTES de qualquer classificação):
Transcreva TODA linha física de escrita visível, de cima para baixo, SEM PULAR NENHUMA, numerando a partir de 1. Inclua também título, linha riscada, saldo e total — você NÃO vai descartar nada aqui, só transcrever. Marque cada linha com um rótulo entre colchetes no início:
- [TITULO] título/rótulo solto sem valor de item (ex.: "Data", "Vendas")
- [RISCADO] linha riscada/rasurada/cancelada (traço por cima, rabiscada)
- [SALDO] linha de saldo (inicial/final/anterior/do dia), normalmente com seta
- [TOTAL] total/subtotal/soma
- [NOTA] anotação/observação que não é transação
- [ITEM] transação real (tem item + valor) — TUDO que não se encaixa acima é [ITEM]
Formato: \`N. [ROTULO] texto exato como está escrito\`. A primeira linha de escrita é a nº 1, mesmo que seja título ou riscada.

PARTE 2 — CSV:
Depois da transcrição, escreva uma linha contendo apenas \`CSV:\` e então o CSV com as colunas:
data,descricao,valor,tipo
Gere UMA linha de CSV para CADA linha marcada [ITEM] na PARTE 1, na mesma ordem — nem mais, nem menos. Linhas [TITULO]/[RISCADO]/[SALDO]/[TOTAL]/[NOTA] NÃO geram CSV. A primeira linha [ITEM] da transcrição (mesmo logo após um [TITULO] ou [RISCADO]) É a primeira linha do CSV e NUNCA pode faltar.
${businessSection}${segmentHints}
Regras importantes:
- Extraia CADA linha de item individualmente. Se o mesmo produto aparece duas vezes, gere duas linhas separadas.
- MUITAS ANOTAÇÕES NÃO TÊM CABEÇALHO. NÃO presuma que a primeira linha é cabeçalho. Uma linha só é cabeçalho se contiver APENAS rótulos de coluna (ex.: "Categoria | Orçamento", "Descrição | Valor", "Data | Movimento | Crédito | Débito") e NENHUM valor monetário nem item real. Se a primeira linha já tem um item + valor (ex.: "Água 100", "Moradia 1200", "Venda 1 kit 18,00"), ela É uma transação e DEVE ser extraída — não a descarte como título. Na dúvida, trate como transação.
- LINHAS RISCADAS/RASURADAS/TACHADAS/CANCELADAS (texto com um traço por cima, rabiscado ou riscado fora) são correções de quem escreveu: NÃO as extraia como transação. Mas uma linha riscada também NÃO é cabeçalho e NÃO "consome" nem empurra a linha seguinte — a próxima linha escrita normalmente (sem risco), com item + valor, é uma transação real e DEVE ser extraída. Comece a contagem na PRIMEIRA linha NÃO riscada com item + valor, mesmo que logo acima existam um título solto (ex.: "Data") e/ou uma linha riscada parecida. Exemplo: título "Data", depois "18/05 Venda" RISCADO, depois "18/05 4 cookie kinder 60" — só a terceira conta, e ela é a primeira transação; NÃO pode ser pulada.
- EXTRAIA TODAS AS LINHAS DE DADOS. Quando houver cabeçalho, a primeira linha de dados logo após ele também é transação e NÃO pode ser pulada — não confunda o valor da primeira linha com o cabeçalho, mesmo que estejam visualmente próximos ou quase na mesma altura. Conte as linhas: o número de transações extraídas deve bater com o número de itens escritos.
- A FOTO PODE ESTAR TORTA, INCLINADA OU MAL ENQUADRADA (caderno fotografado de qualquer ângulo). Mentalmente "endireite" a imagem: siga a linha de escrita do caderno (o pautado/baseline de cada item), que pode estar inclinada e NÃO ser horizontal na foto. O valor de um item é o que está na MESMA linha de escrita dele, acompanhando a inclinação — não o que está na mesma altura vertical da foto.
- LEIA LINHA A LINHA (seguindo o pautado do caderno), NUNCA coluna a coluna. Para cada transação, percorra a MESMA linha de escrita da descrição até a(s) coluna(s) de valor e pegue o valor que está naquela linha. NÃO leia a coluna de valores como uma lista solta de números de cima para baixo — isso desalinha tudo quando uma linha não tem valor naquela coluna ou a foto está torta.
- PISTA DE SALDO: uma linha com uma SETA (▷, →, ►, ↦) apontando para um valor isolado — em especial a PRIMEIRA linha e a ÚLTIMA linha do bloco — é quase sempre "Saldo inicial" / "Saldo final". IGNORE-A mesmo que você não consiga ler a palavra "Saldo" ou que o manuscrito pareça outra coisa. Saldo inicial costuma abrir o bloco e saldo final costuma fechá-lo, com valor apontado por seta e sem ser uma venda/compra real.
- PODE HAVER VÁRIAS COLUNAS DE VALOR (ex.: Crédito e Débito; Entrada e Saída; Valor único; +/−). Cada transação tem normalmente UM valor, que pode estar em QUALQUER uma dessas colunas. Uma célula vazia numa coluna é normal — o valor daquela linha está na outra coluna, na MESMA linha. NUNCA "empreste" ou desloque o valor da linha de cima ou de baixo para preencher uma célula vazia.
- Para casar a contagem, some os valores de TODAS as colunas de valor: o total de valores (Crédito + Débito + ...) deve bater com o número de linhas de transação. Se você só contar uma coluna, vai faltar valor e você vai (erradamente) deslocar as linhas.
- A COLUNA em que o valor aparece (e/ou a cor da escrita, ex.: vermelho para débito) é indicador de tipo: valor na coluna de débito/saída = "saida"; na coluna de crédito/entrada = "entrada" — isso vale mesmo que a descrição sugira o contrário.
- NUNCA inclua linhas de SALDO, em QUALQUER forma: "Saldo", "Saldo inicial", "Saldo final", "Saldo anterior", "Saldo do dia", "Saldo atual", "Saldo em caixa", etc. Linhas de saldo são posição acumulada, não movimentação — ignore-as completamente, mesmo que tenham valor e pareçam uma transação.
- NÃO inclua linhas de total, subtotal ou resumo (ex: "Total Dia", "Total", "Soma", "Subtotal").
- Ignore anotações/observações que não são transações (ex.: "Cartão = não soma", legendas, marcações como "(D)", "(2x cartão)"). Use-as apenas como contexto se ajudarem a entender o tipo.
- descricao: use SEMPRE o texto real do item (ex.: "Moradia", "Água", "Internet", "Aluguel", "Compras", "Venda 1 kit"). NUNCA escreva apenas "entrada"/"saida"/"saída", NUNCA coloque o valor ou o tipo dentro da descrição, e nunca deixe a descrição vazia — a descrição é usada depois para categorizar, então preserve só o texto do item.
- Se um item tiver quantidade entre parênteses (ex: "Água (3): 9,00"), use o valor total indicado (9.00). A quantidade é só informativa e NÃO vai na coluna valor.
- Uma linha que começa com parênteses é um item SEPARADO, não uma anotação do item anterior.
- Valores SEMPRE positivos — use a coluna "tipo" para indicar entrada/saida.
- tipo: "entrada" para ${seg ? seg.terminologia.receita + "s" : "vendas/receitas/recebimentos"}, "saida" para ${seg ? seg.terminologia.despesa + "s" : "despesas/pagamentos"}.
- PRIORIDADE: se a imagem tiver QUALQUER coluna/campo indicando a direção da transação (ex.: Tipo, Natureza, D/C, Entrada/Saída, Receita/Despesa, Crédito/Débito, sinal +/-), essa indicação é AUTORITATIVA para cada linha — respeite-a INDEPENDENTEMENTE do que a descrição sugira. Interprete o rótulo de forma semântica e dinâmica, sem depender de uma lista fixa de palavras. Só classifique pela descrição quando não houver nenhuma indicação explícita.
- Considere TODA a informação visível em cada linha/registro (todas as colunas e campos) como contexto de análise ao classificar.
- Se a linha é claramente uma transação (tem descrição de item) mas o valor está ilegível, ausente ou desalinhado, NÃO descarte a linha: extraia com valor 0 para o usuário corrigir na revisão. Só omita o que claramente não é transação (títulos, saldos, totais, anotações).
- Use ponto como separador decimal (ex: 13.00, não 13,00).
- Na PARTE 2, cada linha do CSV tem EXATAMENTE 4 campos nesta ordem: data,descricao,valor,tipo. A vírgula só separa esses 4 campos. Não repita a numeração nem os rótulos [ITEM]/[TITULO] no CSV — eles pertencem só à PARTE 1.
- Se a imagem não contiver NENHUMA linha [ITEM] (sem dados financeiros), retorne apenas a PARTE 1 e, no lugar do CSV, a linha: CSV:\nSEM_DADOS

VERIFICAÇÃO OBRIGATÓRIA entre a PARTE 1 e a PARTE 2 (releia sua própria transcrição):
1. A linha nº 1 da sua transcrição corresponde à PRIMEIRA linha física de escrita da imagem (o topo absoluto, geralmente um [TITULO] como "Data")? Se a sua nº 1 já é um [ITEM], você provavelmente pulou linhas acima — recomece a transcrição do topo.
2. Liste mentalmente os números das linhas [ITEM]. A PARTE 2 tem EXATAMENTE uma linha de CSV para cada um desses números, na mesma ordem. Conte: nº de linhas [ITEM] == nº de linhas no CSV. Se faltar, a vítima quase sempre é a primeira [ITEM] (logo após [TITULO]/[RISCADO]) — inclua-a.
3. Nenhuma linha [RISCADO], [SALDO], [TOTAL], [NOTA] ou [TITULO] virou linha de CSV. Se virou, remova.
4. Para CADA [ITEM], a descrição e o valor estão na MESMA linha física da transcrição? Some os valores de todas as colunas (crédito + débito + ...) — o total deve bater com o nº de [ITEM]. Se um valor "sobrou"/"faltou", você desalinhou colunas — refaça.
5. Para CADA [ITEM], o tipo (entrada/saida) foi definido pela COLUNA/sinal onde o valor está (crédito/+=entrada, débito/−=saída), e não pela descrição? Corrija (ex.: "pagamento compra X" recebido na coluna crédito é ENTRADA).
6. Cada linha de CSV tem exatamente 4 campos? A descrição tem só o texto do item (sem valor, sem "entrada/saida")? O valor é número com ponto decimal? Corrija antes de responder.

Regras de data (IMPORTANTE) — hoje é ${hojeBR} (ano atual = ${anoAtual}, mês atual = ${mesAtual}):
- Formato de saída sempre DD/MM/YYYY com o ano completo.
- Prefira sempre o padrão brasileiro DD/MM/YYYY. Só use MM/DD/YYYY se o dia for > 12 e estiver na segunda posição (ex: 01/13/${anoAtual} → mês=01, dia=13).
- Quando a anotação NÃO tiver ano (ex.: "01/05", "10/3"), use SEMPRE o ano atual ${anoAtual}. NUNCA use ${anoAtual - 1} nem outro ano — não invente o ano.
- Se houver apenas o dia (ex: "10") → use o dia 10, mês atual (${mesAtual}), ano atual (${anoAtual}).
- Se houver apenas dia e mês (ex: "10/01") → use dia 10, mês 01, ano atual (${anoAtual}).
- Se houver uma data geral/ano explícito para o grupo (ex: cabeçalho "05/04/${anoAtual}") use-a para todos os itens daquele grupo.
- Nunca invente datas; se não houver nenhuma informação de data, use a data de hoje (${hojeBR}).`;
}
