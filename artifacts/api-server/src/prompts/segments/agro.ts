import type { SegmentProfile } from "../types";

export const agro: SegmentProfile = {
  label: "Agronegócio",
  terminologia: {
    receita: "venda de safra",
    despesa: "insumo agrícola",
    cliente: "cooperativa/comprador",
    produto: "cultura/commodity",
  },
  categoriasComuns: [
    "Insumos Agrícolas (sementes, defensivos, fertilizantes)",
    "Maquinário e Implementos", "Mão de Obra Rural", "Armazenagem",
    "Combustível", "Irrigação", "Frete", "Impostos rurais",
  ],
  focoInsights: "custo de produção por hectare, rentabilidade por cultura, sazonalidade de colheita e preço de commodity, capital de giro para o próximo plantio",
  tom: "técnico mas acessível, como um consultor agrícola — fale sobre custo por hectare, rentabilidade por cultura e janela de venda da safra",
  exemplosDocumentos: [
    "nota fiscal de insumos agrícolas", "nota de venda de grãos",
    "contrato de arrendamento", "fatura de maquinário",
    "nota de combustível", "CDA (Certificado de Depósito Agropecuário)",
  ],
  desafiosComuns: [
    "custo de insumos crescendo acima do preço da commodity",
    "dependência de poucos compradores ou cooperativas",
    "fluxo de caixa negativo entre plantio e colheita",
    "variação cambial impactando preço de venda e custo de insumos importados",
  ],
};