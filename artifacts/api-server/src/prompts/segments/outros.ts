import type { SegmentProfile } from "../types";

export const outro: SegmentProfile = {
  label: "Outros",
  terminologia: {
    receita: "receita",
    despesa: "despesa",
    cliente: "cliente",
    produto: "produto ou serviço",
  },
  categoriasComuns: [
    "Receitas diversas", "Despesas operacionais", "Folha de Pagamento",
    "Impostos", "Marketing", "Equipamentos", "Aluguel", "Outros",
  ],
  focoInsights: "equilíbrio entre receitas e despesas, margem de lucro, fluxo de caixa e sazonalidade. Use seu conhecimento geral sobre o segmento informado pelo usuário para contextualizar as análises e sugerir benchmarks típicos daquele mercado",
  tom: "direto e prático, como um consultor financeiro generalista. Use conhecimento geral do mercado para o segmento específico do usuário — mencione práticas, benchmarks e desafios típicos daquele setor quando relevante",
  exemplosDocumentos: [
    "nota fiscal", "recibo", "boleto bancário", "extrato bancário",
    "comprovante de pagamento", "planilha de controle",
  ],
  desafiosComuns: [
    "falta de controle sobre entradas e saídas",
    "mistura de finanças pessoais e empresariais",
    "ausência de reserva financeira para emergências",
    "precificação inadequada dos produtos ou serviços",
  ],
};
