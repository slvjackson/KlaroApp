import type { SegmentProfile } from "../types";

export interface OcrPromptContext {
  businessName?: string;
  segment?: SegmentProfile;
  mainProducts?: string;
  salesChannel?: string;
}

/**
 * Builds the OCR extraction prompt with robust, pattern-based rules that
 * generalize across business types and input structures (handwritten
 * notebooks, receipts, bank statements, budget lists, etc.).
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
- ENTRADA (tipo=entrada): ${seg.terminologia.receita} — dinheiro recebido
- SAÍDA (tipo=saida): ${seg.terminologia.despesa} — dinheiro pago
- Documentos comuns neste segmento: ${seg.exemplosDocumentos.join(", ")}
`
    : "\n- tipo=entrada para receitas/recebimentos, tipo=saida para despesas/pagamentos\n";

  return `Você é um assistente especializado em extração de dados financeiros de imagens manuscritas ou impressas.
Analise esta imagem (pode ser ${seg ? seg.exemplosDocumentos.slice(0, 3).join(", ") : "caderno de anotações, extrato bancário, nota fiscal, recibo, lista de orçamento"}, etc.).
Extraia as transações financeiras e retorne SOMENTE um CSV com as colunas:
data,descricao,valor,tipo
${businessSection}${segmentHints}

════════════════════════════════════════
PASSO 1 — PREPARAÇÃO (leia antes de extrair)
════════════════════════════════════════

Mapeie a estrutura da imagem antes de extrair qualquer linha:
a) Existe cabeçalho? (linha com APENAS rótulos como "Data | Movimento | Crédito | Débito", sem valores nem itens reais). Muitas anotações NÃO têm cabeçalho — não presuma.
b) Quantas colunas de valor existem? (só "Valor"; ou "Crédito" + "Débito"; ou "Entrada" + "Saída"; ou sinais +/−).
c) A foto está inclinada/mal enquadrada? Se sim, alinhe mentalmente ao pautado do caderno, NÃO à horizontal da foto.
d) Há notas de rodapé/legendas (ex.: "cartão = não soma")? Registre — elas afetam conferência, não a existência da transação.
e) Há saldo inicial e/ou final anotados? Guarde os valores só para a verificação do PASSO 2.

CONTAGEM PRÉVIA: conte N = nº de linhas de transação reais, EXCLUINDO cabeçalho, saldos, totais/subtotais e anotações/legendas. Seu CSV final deve ter EXATAMENTE N linhas.

════════════════════════════════════════
PASSO 2 — ALINHAMENTO DE VALORES (erro mais comum)
════════════════════════════════════════

NÃO leia a coluna de valores como uma lista vertical de números de cima para baixo e depois associe às linhas "de cima pra baixo" — isso desalinha tudo quando alguma linha não tem valor naquela coluna.

FAÇA linha por linha, seguindo o pautado:
1. Escolha uma linha de transação.
2. Siga HORIZONTALMENTE a linha de escrita dela (acompanhe a inclinação do caderno, não a horizontal da foto).
3. O valor é o número na MESMA linha de escrita. Pode haver VÁRIAS colunas de valor (Crédito/Débito, Entrada/Saída, +/−): o valor da linha está em UMA delas; célula vazia na outra é normal. NUNCA empreste/desloque o valor de outra linha para preencher uma célula vazia.
4. Repita para cada linha individualmente.

CASAMENTO POR CONTAGEM: somando os valores de TODAS as colunas, o total de células preenchidas deve bater com N (pode ser menor se houver linhas sem valor). Mais valores que N = você incluiu saldo/total. Menos = revise o alinhamento.

CONFERÊNCIA POR SALDO (apenas dica de sanidade, quando saldo inicial SI e final SF estiverem visíveis e for um livro-caixa):
Idealmente Σentradas − Σsaídas ≈ SF − SI. Se não fechar, PODE haver valor deslocado — revise o alinhamento.
ATENÇÃO: pode legitimamente NÃO fechar (ex.: vendas no cartão com nota "não soma" não entram no saldo de caixa; lista de orçamento não tem saldo). NUNCA exclua, altere ou invente uma transação real só para fazer essa conta fechar.

════════════════════════════════════════
PASSO 3 — PADRÕES DE DESCRIÇÃO (genéricos)
════════════════════════════════════════

NOMES PRÓPRIOS: se a descrição contém um nome próprio (ex.: "João pagamento compra Natura", "Maria pagou"), PRESERVE o nome na descrição — identifica o cliente/fornecedor e é usado depois para categorizar. NÃO use o nome para decidir o tipo: quem decide entrada/saída é a coluna do valor (ver PASSO 4). Só como último recurso, sem coluna/sinal, "[Nome] pagou/pagamento" sugere dinheiro recebido (entrada).

FORMA DE PAGAMENTO: marcações como (D), (C), (PIX), (débito), (crédito), (2xCC), (2×cc) indicam o MEIO de pagamento, não a direção. Não as extraia como transação separada e não as use para definir tipo. Mesmo que haja nota "cartão = não soma": a transação É real e DEVE ser extraída normalmente (a nota afeta só a conferência de saldo de caixa, não a existência da venda).

QUANTIDADES/UNIDADES: manuscrito é ambíguo — transcreva fielmente, não invente nem "arredonde" quantidades. Se houver quantidade + valor total (ex.: "5 sabonetes: 99,00"), use o valor total (99.00). Frações ("½ colônia", "¼ colônia") são parte do item, extraia como está.

RETIRADAS/TRANSFERÊNCIAS: "Retirada p/ [algo]" e "Transferência para [conta]" são saída por padrão — salvo se a coluna do valor indicar entrada. Cor da escrita, quando visível (vermelho/rosa costuma ser débito em cadernos), é pista subordinada à coluna.

════════════════════════════════════════
PASSO 4 — TIPO (ordem de precedência; pare na 1ª que se aplicar)
════════════════════════════════════════

1. COLUNA DO VALOR (máxima prioridade): valor em coluna crédito/entrada/+ → entrada; em débito/saída/− → saida. Supera qualquer interpretação da descrição.
2. SINAL OU COR EXPLÍCITOS: prefixo + ou verde → entrada; prefixo − ou vermelho/rosa → saida.
3. PADRÃO ESTRUTURAL: "Retirada p/ ..." → saida; "[Nome] pagou/pagamento" (sem coluna) → entrada.
4. SEMÂNTICA (mínima prioridade): venda/recebimento → entrada; compra/pagamento a fornecedor/despesa → saida.

════════════════════════════════════════
PASSO 5 — LINHAS A IGNORAR (nunca incluir no CSV)
════════════════════════════════════════

SALDOS: "Saldo", "Saldo inicial/final/anterior/atual/do dia/em caixa". PISTA VISUAL: linha com seta (→, ▷, ►, ↦) apontando para um valor isolado — especialmente a PRIMEIRA e a ÚLTIMA do bloco — é quase sempre saldo. Ignore mesmo que o manuscrito cursivo pareça outra coisa (ex.: "Saldo inicial" mal escrito parecendo uma venda).
TOTAIS/SUBTOTAIS: "Total", "Total do dia", "Subtotal", "Soma".
ANOTAÇÕES/LEGENDAS: "cartão = não soma", legendas de coluna, marcações soltas "(D)"/"(2×cc)" sem transação associada.
CABEÇALHOS: linha com APENAS rótulos de coluna e nenhum valor/item. Se a 1ª linha após o cabeçalho já tem item + valor, é transação — não pule.

════════════════════════════════════════
PASSO 6 — FORMATO DE SAÍDA
════════════════════════════════════════

- Valores SEMPRE positivos; a direção vai na coluna "tipo".
- Ponto como separador decimal (13.00, não 13,00). Vírgula APENAS separa colunas do CSV.
- descricao: SEMPRE o texto real do item, preservando nomes. NUNCA escreva apenas "entrada"/"saida" como descrição, nem deixe vazia.
- tipo: exatamente "entrada" ou "saida" (sem acento).
- Se a linha é claramente uma transação (tem descrição de item) mas o valor está ilegível/ausente/desalinhado, NÃO descarte: extraia com valor 0 para o usuário corrigir na revisão. Só omita o que claramente não é transação.
- Sem cabeçalho CSV, sem explicações nem comentários — apenas as linhas de dados.
- Se a imagem não contiver dados financeiros, retorne somente: SEM_DADOS

════════════════════════════════════════
REGRAS DE DATA — hoje é ${hojeBR} (ano=${anoAtual}, mês=${mesAtual})
════════════════════════════════════════

- Saída sempre DD/MM/YYYY com ano completo. Padrão brasileiro DD/MM/YYYY; só use MM/DD/YYYY se o dia > 12 estiver na 2ª posição.
- Sem ano na anotação (ex.: "01/05", "10/3") → use o ano atual ${anoAtual}. NUNCA ${anoAtual - 1} nem outro ano.
- Só dia (ex.: "10") → dia 10, mês ${mesAtual}, ano ${anoAtual}.
- Cabeçalho com data geral (ex.: "05/04/${anoAtual}") → use para todas as linhas do grupo.
- Sem nenhuma data → use hoje (${hojeBR}).

════════════════════════════════════════
VERIFICAÇÃO FINAL OBRIGATÓRIA (mental, não escreva)
════════════════════════════════════════

□ O CSV tem exatamente N linhas (contadas no PASSO 1)?
□ A primeira linha de transação (logo após o cabeçalho, se houver) está incluída?
□ Nenhuma linha de saldo (inclusive 1ª/última com seta), total ou anotação entrou?
□ Para cada linha, descrição e valor estão na MESMA linha física do manuscrito (não deslocados)?
□ O tipo de cada linha foi definido pela coluna do valor (PASSO 4), não pela descrição?
□ Descrições preservam o texto real do item e nomes de clientes?
□ (Se aplicável) a conferência por saldo é coerente — sem ter alterado transação real para forçá-la?

Somente após confirmar todos os itens, retorne o CSV.`;
}
