import type { SegmentProfile } from "../types";

export const saude: SegmentProfile = {
  label: "Saúde / Beleza",
  terminologia: {
    receita: "atendimento",
    despesa: "material",
    cliente: "paciente/cliente",
    produto: "procedimento/tratamento",
  },
  categoriasComuns: [
    "Materiais e Insumos", "Equipamentos", "Aluguel Consultório/Espaço",
    "Folha de Pagamento", "Plano de Saúde Equipe", "Impostos",
    "Marketing", "Cursos e Capacitação",
  ],
  focoInsights: "taxa de retorno de pacientes/clientes, ticket médio por procedimento, ocupação da agenda, custo de material por atendimento",
  tom: "cuidadoso e profissional, como um consultor da área de saúde e beleza — fale sobre taxa de retorno, ticket por procedimento e ocupação de agenda",
  exemplosDocumentos: [
    "nota fiscal de serviço (NFS-e)", "nota fiscal de material",
    "recibo de atendimento", "fatura de equipamentos",
    "nota de compra de produtos para revenda",
  ],
  desafiosComuns: [
    "baixa taxa de retorno de clientes/pacientes",
    "agenda ociosa em horários específicos",
    "alto custo de material reduzindo margem por procedimento",
    "dependência de convênios com repasse baixo",
  ],
};