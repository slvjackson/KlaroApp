import type { SegmentProfile } from "../types";

export const transporte: SegmentProfile = {
  label: "Transporte",
  terminologia: {
    receita: "frete",
    despesa: "combustível",
    cliente: "embarcador/passageiro",
    produto: "frete/viagem",
  },
  categoriasComuns: [
    "Combustível", "Manutenção Preventiva", "Manutenção Corretiva",
    "Seguro", "Pedágio", "IPVA e Licenciamento", "Impostos (ICMS frete)",
    "Pneus", "Motoristas (CLT/MEI)",
  ],
  focoInsights: "custo por km rodado, rentabilidade por rota, índice de manutenção sobre faturamento, ociosidade de frota",
  tom: "objetivo e operacional, como um gestor de frota — cite custo por km, rentabilidade por rota e índice de manutenção",
  exemplosDocumentos: [
    "CT-e (Conhecimento de Transporte Eletrônico)", "manifesto de carga",
    "nota fiscal de combustível", "nota de manutenção mecânica",
    "fatura de pedágio (sem parar)", "apólice de seguro",
  ],
  desafiosComuns: [
    "custo de combustível consumindo mais de 30% da receita de frete",
    "manutenção corretiva elevada por falta de preventivo",
    "frota ociosa em rotas de baixa demanda",
    "aumento de pedágio e seguro comprimindo margem",
  ],
};