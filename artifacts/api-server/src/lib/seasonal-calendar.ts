/**
 * Calendário sazonal brasileiro — eventos comerciais relevantes por segmento.
 *
 * Cada evento tem uma janela (-N dias até +M dias) onde a IA do Today Card
 * recebe contexto sobre o evento. O `getActiveEvents()` retorna eventos
 * cobrindo a data atual filtrados pelo segmento do negócio.
 *
 * Atualizar anualmente (datas móveis tipo Páscoa, Carnaval, Dia das Mães mudam).
 */

export interface SeasonalEvent {
  id: string;
  name: string;
  date: string;             // YYYY-MM-DD
  windowStart: number;      // dias antes da data em que a janela abre
  windowEnd: number;        // dias após a data em que a janela fecha
  segments: string[];       // chaves de segmento (ver profile.tsx) ou ["*"] pra todos
  impact: string;           // descrição factual usada no prompt
}

// Datas para 2026. Atualizar anualmente em janeiro.
const EVENTS_2026: SeasonalEvent[] = [
  {
    id: "carnaval-2026",
    name: "Carnaval",
    date: "2026-02-17",
    windowStart: 7, windowEnd: 1,
    segments: ["alimentacao", "varejo", "servicos"],
    impact: "muda padrão de consumo: bares e restaurantes em alta, comércio tradicional em queda em capitais; varejo de fantasia/decoração em boost",
  },
  {
    id: "dia-mulher-2026",
    name: "Dia Internacional da Mulher",
    date: "2026-03-08",
    windowStart: 7, windowEnd: 0,
    segments: ["varejo", "alimentacao", "saude", "servicos"],
    impact: "boost histórico em floricultura, confeitaria, presentes, salão de beleza, restaurantes (10-20%)",
  },
  {
    id: "pascoa-2026",
    name: "Páscoa",
    date: "2026-04-05",
    windowStart: 21, windowEnd: 1,
    segments: ["alimentacao", "varejo"],
    impact: "boost histórico forte em confeitaria, chocolaterias, supermercados (30-50% acima da média mensal); janela longa de antecipação",
  },
  {
    id: "dia-maes-2026",
    name: "Dia das Mães",
    date: "2026-05-10",
    windowStart: 14, windowEnd: 1,
    segments: ["alimentacao", "varejo", "saude", "servicos"],
    impact: "2ª data comercial mais forte do ano. Boost histórico de 25-40% em confeitaria, floricultura, joalheria, restaurantes, salão de beleza, perfumaria",
  },
  {
    id: "dia-namorados-2026",
    name: "Dia dos Namorados",
    date: "2026-06-12",
    windowStart: 10, windowEnd: 1,
    segments: ["alimentacao", "varejo", "saude", "servicos"],
    impact: "boost de 15-30% em restaurantes, confeitaria, joalheria, floricultura, lingerie, hotéis",
  },
  {
    id: "festa-junina-2026",
    name: "Festas Juninas (pico)",
    date: "2026-06-24",
    windowStart: 14, windowEnd: 7,
    segments: ["alimentacao", "varejo"],
    impact: "boost regional em alimentação típica (pamonha, milho, doces), bebidas e decoração junina; mais forte no Nordeste",
  },
  {
    id: "dia-paes-2026",
    name: "Dia dos Pais",
    date: "2026-08-09",
    windowStart: 14, windowEnd: 1,
    segments: ["varejo", "alimentacao", "servicos"],
    impact: "boost de 10-20% em vestuário masculino, eletrônicos, restaurantes, bebidas (cerveja artesanal)",
  },
  {
    id: "independencia-2026",
    name: "7 de Setembro",
    date: "2026-09-07",
    windowStart: 3, windowEnd: 1,
    segments: ["alimentacao"],
    impact: "feriado prolongado historicamente boost em restaurantes em destinos turísticos; queda em comércio de bairro",
  },
  {
    id: "dia-criancas-2026",
    name: "Dia das Crianças",
    date: "2026-10-12",
    windowStart: 21, windowEnd: 1,
    segments: ["varejo", "alimentacao", "educacao"],
    impact: "boost forte em brinquedos, vestuário infantil, confeitaria (festas), parques; janela longa de planejamento",
  },
  {
    id: "black-friday-2026",
    name: "Black Friday",
    date: "2026-11-27",
    windowStart: 14, windowEnd: 3,
    segments: ["varejo", "tecnologia", "servicos"],
    impact: "concentra vendas do mês em ~5 dias. Margem geralmente comprime por desconto; volume sobe muito; risco de estoque mal dimensionado",
  },
  {
    id: "natal-2026",
    name: "Natal",
    date: "2026-12-25",
    windowStart: 30, windowEnd: 1,
    segments: ["*"],
    impact: "data comercial mais forte do ano para a maioria dos segmentos. Boost histórico 30-80% em confeitaria, varejo, restaurantes, presentes; janela longa de antecipação",
  },
  {
    id: "ano-novo-2026",
    name: "Réveillon / Ano Novo",
    date: "2026-12-31",
    windowStart: 7, windowEnd: 2,
    segments: ["alimentacao", "varejo"],
    impact: "boost em bebidas, supermercados, restaurantes em destinos turísticos; queda em comércio de bairro nos dias 30-31",
  },
];

const ALL_EVENTS = [...EVENTS_2026];

function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((db - da) / 86_400_000);
}

export interface ActiveEvent extends SeasonalEvent {
  daysUntil: number;        // negativo se já passou (dentro da janela posterior)
  positionLabel: string;    // ex: "em 5 dias", "amanhã", "hoje", "há 2 dias"
}

export function getActiveEvents(today: string, segment?: string | null): ActiveEvent[] {
  const out: ActiveEvent[] = [];
  for (const e of ALL_EVENTS) {
    const diff = daysBetween(today, e.date); // +N if event in future
    if (diff > e.windowStart || diff < -e.windowEnd) continue;
    const segmentMatch = e.segments.includes("*") || (segment && e.segments.includes(segment));
    if (!segmentMatch) continue;
    out.push({
      ...e,
      daysUntil: diff,
      positionLabel: formatPosition(diff),
    });
  }
  return out.sort((a, b) => Math.abs(a.daysUntil) - Math.abs(b.daysUntil));
}

function formatPosition(daysUntil: number): string {
  if (daysUntil === 0) return "hoje";
  if (daysUntil === 1) return "amanhã";
  if (daysUntil === -1) return "ontem";
  if (daysUntil > 1) return `em ${daysUntil} dias`;
  return `há ${Math.abs(daysUntil)} dias`;
}

/**
 * Retorna um identificador estável do conjunto de eventos ativos. Usado pra
 * detectar mudança de janela sazonal entre o momento da geração do batch e
 * a leitura atual — se o ID mudou, o batch deve ser regenerado.
 */
export function getActiveWindowSignature(today: string, segment?: string | null): string {
  const events = getActiveEvents(today, segment);
  return events.map((e) => e.id).sort().join(",");
}
