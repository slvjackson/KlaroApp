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
  focoInsights: "equilíbrio entre receitas e despesas, margem de lucro, fluxo de caixa e sazonalidade",
  tom: "direto e prático, como um consultor financeiro generalista — fale sobre fluxo de caixa, margem e planejamento",
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
