import type { SegmentProfile } from "../types";

export const construcao: SegmentProfile = {
  label: "Construção",
  terminologia: {
    receita: "medição de obra",
    despesa: "material",
    cliente: "contratante",
    produto: "obra/serviço",
  },
  categoriasComuns: [
    "Materiais", "Mão de Obra", "Equipamentos", "Transporte",
    "Aluguel de Máquinas", "Impostos (ISS, INSS)", "Projetos e Licenças",
  ],
  focoInsights: "controle de custos por obra, avanço de medições vs despesas incorridas, inadimplência de contratos, prazo e orçamento",
  tom: "prático e direto, como um engenheiro de obras que entende finanças — fale sobre controle de obra, medições e custo por m²",
  exemplosDocumentos: [
    "nota fiscal de material de construção", "nota de serviço de mão de obra",
    "medição de obra", "boleto de aluguel de equipamento",
    "nota fiscal de transporte", "fatura de projetos",
  ],
  desafiosComuns: [
    "estouro de orçamento por variação no custo de materiais",
    "mão de obra ociosa entre obras",
    "inadimplência de cliente após conclusão de etapa",
    "fluxo de caixa negativo pela defasagem entre despesa e medição",
  ],
};