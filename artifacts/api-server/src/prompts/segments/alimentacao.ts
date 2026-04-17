import type { SegmentProfile } from "../types";

export const alimentacao: SegmentProfile = {
  label: "Alimentação",
  terminologia: {
    receita: "faturamento",
    despesa: "insumo",
    cliente: "cliente",
    produto: "prato/item",
  },
  categoriasComuns: [
    "Insumos", "CMV (food cost)", "Mão de Obra", "Aluguel", "Delivery",
    "Embalagens", "Gás", "Utilidades", "Equipamentos", "Impostos",
  ],
  focoInsights: "food cost (custo de alimentos sobre faturamento), ticket médio por atendimento, performance de delivery vs salão, desperdício",
  tom: "prático e direto, como um consultor de restaurante — fale sobre food cost em percentual, ticket médio e dias da semana",
  exemplosDocumentos: [
    "nota fiscal de insumos", "fatura de plataforma de delivery (iFood, Rappi)",
    "relatório de caixa diário", "nota de compra de hortifrúti",
    "fatura de gás", "nota de embalagens",
  ],
  desafiosComuns: [
    "food cost elevado acima de 35% do faturamento",
    "desperdício de insumos perecíveis",
    "ticket médio baixo em horários de pico",
    "alta dependência de plataformas de delivery com comissão alta",
  ],
};