import type { SegmentProfile } from "../types";

export const servicos: SegmentProfile = {
  label: "Serviços",
  terminologia: {
    receita: "honorário",
    despesa: "custo operacional",
    cliente: "cliente",
    produto: "serviço",
  },
  categoriasComuns: [
    "Honorários", "Impostos (ISS)", "Ferramentas e Softwares", "Marketing",
    "Folha de Pagamento", "Deslocamento", "Escritório", "Treinamentos",
  ],
  focoInsights: "recorrência de clientes, margem por tipo de serviço, inadimplência, ociosidade da equipe",
  tom: "consultivo e estratégico, como um consultor de gestão — fale sobre recorrência, inadimplência e capacidade produtiva",
  exemplosDocumentos: [
    "nota fiscal de serviço (NFS-e)", "boleto bancário", "proposta/contrato",
    "recibo de pagamento", "fatura de ferramentas (SaaS)",
  ],
  desafiosComuns: [
    "inadimplência de clientes atrasando o fluxo de caixa",
    "concentração de receita em poucos clientes",
    "horas improdutivas não faturadas",
    "precificação abaixo do custo real do serviço",
  ],
};