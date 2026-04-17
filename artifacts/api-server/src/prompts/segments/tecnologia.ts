import type { SegmentProfile } from "../types";

export const tecnologia: SegmentProfile = {
  label: "Tecnologia",
  terminologia: {
    receita: "receita recorrente",
    despesa: "infraestrutura",
    cliente: "cliente",
    produto: "solução/software",
  },
  categoriasComuns: [
    "Infraestrutura (Cloud)", "Licenças de Software", "Folha de Pagamento",
    "Marketing e CAC", "Impostos", "Ferramentas SaaS", "Coworking/Escritório",
  ],
  focoInsights: "MRR (receita mensal recorrente), churn de clientes, CAC vs LTV, crescimento mês a mês e burn rate",
  tom: "analítico e orientado a dados, como um investidor ou consultor de startups — use termos como MRR, churn, CAC, LTV e burn rate quando pertinente",
  exemplosDocumentos: [
    "nota fiscal de software (NF-e serviço)", "fatura AWS/GCP/Azure",
    "fatura de ferramentas SaaS", "contrato de licença", "recibo de assinatura",
  ],
  desafiosComuns: [
    "churn elevado comprometendo o crescimento de MRR",
    "infraestrutura crescendo mais rápido que a receita",
    "CAC alto com LTV baixo tornando a aquisição insustentável",
    "burn rate acelerado sem previsão de break-even",
  ],
};