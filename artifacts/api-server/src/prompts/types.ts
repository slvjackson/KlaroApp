export interface SegmentProfile {
  /** Display name of the segment */
  label: string;

  /** Terminology used in this segment — replaces generic financial words in prompts */
  terminologia: {
    receita: string;   // e.g. "venda", "honorário", "mensalidade"
    despesa: string;   // e.g. "custo de mercadoria", "insumo", "material"
    cliente: string;   // e.g. "cliente", "paciente", "aluno"
    produto: string;   // e.g. "produto", "tratamento", "aula"
  };

  /** Typical income/expense categories for this segment */
  categoriasComuns: string[];

  /** What angle the AI should focus on when generating insights */
  focoInsights: string;

  /** Tone and style the AI should use */
  tom: string;

  /** Common financial documents in this segment (for better OCR context) */
  exemplosDocumentos: string[];

  /** Common pain points to look out for in insights */
  desafiosComuns: string[];
}
