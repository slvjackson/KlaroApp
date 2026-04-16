import type { SegmentProfile } from "../types";

export const educacao: SegmentProfile = {
  label: "Educação",
  terminologia: {
    receita: "mensalidade",
    despesa: "material didático",
    cliente: "aluno/responsável",
    produto: "curso/aula",
  },
  categoriasComuns: [
    "Mensalidades", "Matrículas", "Material Didático", "Folha de Pagamento",
    "Aluguel", "Plataformas EAD", "Marketing", "Impostos",
  ],
  focoInsights: "inadimplência de mensalidades, taxa de evasão, renovação de matrículas, custo por aluno",
  tom: "organizado e atento, como um gestor escolar — fale sobre inadimplência em percentual, evasão e custo por aluno",
  exemplosDocumentos: [
    "boleto de mensalidade", "recibo de matrícula", "nota fiscal de serviço educacional",
    "planilha de inadimplência", "fatura de plataforma EAD",
  ],
  desafiosComuns: [
    "inadimplência acima de 10% da receita esperada",
    "evasão de alunos no meio do curso",
    "sazonalidade de matrículas concentrada em janeiro e julho",
    "custo de plataforma crescendo mais rápido que a receita",
  ],
};