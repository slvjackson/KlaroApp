import type { SegmentProfile } from "../types";

export const varejo: SegmentProfile = {
  label: "Varejo / Loja",
  terminologia: {
    receita: "venda",
    despesa: "custo de mercadoria",
    cliente: "cliente",
    produto: "produto",
  },
  categoriasComuns: [
    "Estoque", "CMV", "Fornecedores", "Aluguel", "Folha de Pagamento",
    "Marketing", "Utilidades", "Embalagens", "Impostos",
  ],
  focoInsights: "giro de estoque, margem por produto, sazonalidade de vendas e ruptura de estoque",
  tom: "direto e objetivo, como um consultor de varejo falando com o dono da loja — cite produtos e categorias pelo nome, compare períodos",
  exemplosDocumentos: [
    "nota fiscal de produto (NF-e)", "DANFE", "boleto de fornecedor",
    "cupom fiscal (SAT/NFC-e)", "planilha de estoque",
  ],
  desafiosComuns: [
    "alto custo de mercadoria reduzindo margem",
    "estoque parado ou ruptura",
    "sazonalidade impactando fluxo de caixa",
    "concentração em poucos fornecedores",
  ],
};
