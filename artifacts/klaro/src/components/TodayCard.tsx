import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Loader2, ArrowRight, TrendingUp, TrendingDown, Minus,
  Sparkles, AlertCircle, Trophy, BarChart3,
} from "lucide-react";

// ─── Types (mirror backend block schema) ─────────────────────────────────────

type BlockTone = "insight" | "comparison" | "warning" | "celebration";
type Trend = "up" | "down" | "flat";

type BarColor = "income" | "expense" | "accent" | "warning" | undefined;

type CardBlock =
  | { type: "callout";    tone: BlockTone; headline: string; body: string; ctaLabel?: string; ctaHref?: string; icon?: string }
  | { type: "bigNumber";  label: string; value: string; delta?: string; trend?: Trend; sublabel?: string }
  | { type: "text";       tone: BlockTone; content: string }
  | { type: "barChart";   title: string; data: Array<{ label: string; value: number; color?: BarColor }>; unit?: string }
  | { type: "lineChart";  title: string; data: Array<{ x: string; y: number }>; unit?: string }
  | { type: "comparison"; title: string; left: { label: string; value: string; trend?: Trend }; right: { label: string; value: string; trend?: Trend } }
  | { type: "list";       title: string; items: Array<{ label: string; value: string; subtitle?: string }> };

interface DailyCardResponse {
  id: string;
  narrativeAngle?: string;
  blocks: CardBlock[];
  generatedBy?: "ai" | "fallback";
}

// ─── Visual tokens ────────────────────────────────────────────────────────────

const TONE_META: Record<BlockTone, { color: string; bg: string; ring: string; pill: string }> = {
  insight: {
    color: "#6af82f",
    bg: "linear-gradient(135deg, rgba(106,248,47,0.06) 0%, rgba(106,248,47,0.01) 100%)",
    ring: "rgba(106,248,47,0.18)",
    pill: "rgba(106,248,47,0.12)",
  },
  comparison: {
    color: "#a855f7",
    bg: "linear-gradient(135deg, rgba(168,85,247,0.06) 0%, rgba(168,85,247,0.01) 100%)",
    ring: "rgba(168,85,247,0.18)",
    pill: "rgba(168,85,247,0.12)",
  },
  warning: {
    color: "#f97316",
    bg: "linear-gradient(135deg, rgba(249,115,22,0.06) 0%, rgba(249,115,22,0.01) 100%)",
    ring: "rgba(249,115,22,0.18)",
    pill: "rgba(249,115,22,0.12)",
  },
  celebration: {
    color: "#22c55e",
    bg: "linear-gradient(135deg, rgba(34,197,94,0.06) 0%, rgba(34,197,94,0.01) 100%)",
    ring: "rgba(34,197,94,0.18)",
    pill: "rgba(34,197,94,0.12)",
  },
};

const BAR_COLOR_MAP: Record<NonNullable<BarColor>, string> = {
  income:  "#22c55e",
  expense: "#f43f5e",
  accent:  "#6af82f",
  warning: "#f97316",
};

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>> = {
  TrendingUp, TrendingDown, Sparkles, AlertCircle, Trophy, BarChart3,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchTodayCard(): Promise<DailyCardResponse> {
  const res = await fetch("/api/dashboard/today-card", { credentials: "include" });
  if (!res.ok) throw new Error("today-card fetch failed");
  return res.json() as Promise<DailyCardResponse>;
}

function todayLabel(): string {
  const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const d = new Date();
  return `Hoje · ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function trendIcon(trend?: Trend, color?: string) {
  if (trend === "up")   return <TrendingUp   size={13} style={{ color }} />;
  if (trend === "down") return <TrendingDown size={13} style={{ color }} />;
  if (trend === "flat") return <Minus        size={13} style={{ color }} />;
  return null;
}

function pickPrimaryTone(blocks: CardBlock[]): BlockTone {
  for (const b of blocks) {
    if (b.type === "callout") return b.tone;
    if (b.type === "text") return b.tone;
  }
  return "insight";
}

function fmtCompact(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return String(Math.round(v));
}

// ─── Block renderers ──────────────────────────────────────────────────────────

function CalloutBlock({ b }: { b: Extract<CardBlock, { type: "callout" }> }) {
  const meta = TONE_META[b.tone];
  const Icon = b.icon ? ICON_MAP[b.icon] ?? Sparkles : null;
  const [, setLocation] = useLocation();

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-2.5">
        {Icon && (
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: meta.pill }}>
            <Icon size={14} style={{ color: meta.color }} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-white leading-snug">{b.headline}</div>
          <p className="text-[12.5px] text-[var(--muted)] leading-relaxed mt-1">{b.body}</p>
        </div>
      </div>
      {b.ctaLabel && b.ctaHref && (
        <button
          onClick={() => setLocation(b.ctaHref!)}
          className="inline-flex self-start items-center gap-1.5 text-[12px] font-semibold transition-all hover:gap-2 mt-1"
          style={{ color: meta.color }}
        >
          {b.ctaLabel}
          <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}

function BigNumberBlock({ b, accent }: { b: Extract<CardBlock, { type: "bigNumber" }>; accent: string }) {
  return (
    <div className="flex flex-col">
      <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[var(--muted)]">{b.label}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-[26px] font-bold tnum text-white leading-none">{b.value}</span>
        {b.delta && (
          <span className="flex items-center gap-1 text-[12px] font-semibold tnum" style={{ color: accent }}>
            {trendIcon(b.trend, accent)}
            {b.delta}
          </span>
        )}
      </div>
      {b.sublabel && <div className="text-[11px] text-[var(--muted)] mt-1">{b.sublabel}</div>}
    </div>
  );
}

function TextBlock({ b }: { b: Extract<CardBlock, { type: "text" }> }) {
  return <p className="text-[12.5px] text-white/85 leading-relaxed">{b.content}</p>;
}

function BarChartBlock({ b, accent }: { b: Extract<CardBlock, { type: "barChart" }>; accent: string }) {
  const max = Math.max(...b.data.map((d) => d.value), 1);
  return (
    <div>
      <div className="text-[11px] font-semibold text-white mb-2">{b.title}</div>
      <div className="space-y-1.5">
        {b.data.map((d, i) => {
          const pct = (d.value / max) * 100;
          const color = d.color ? BAR_COLOR_MAP[d.color] : accent;
          return (
            <div key={i} className="flex items-center gap-2">
              <div className="w-20 text-[10.5px] text-[var(--muted)] truncate shrink-0">{d.label}</div>
              <div className="flex-1 h-[5px] rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
              </div>
              <div className="text-[10.5px] tnum text-white/80 w-12 text-right shrink-0">{fmtCompact(d.value)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LineChartBlock({ b, accent }: { b: Extract<CardBlock, { type: "lineChart" }>; accent: string }) {
  const max = Math.max(...b.data.map((d) => d.y), 1);
  const min = Math.min(...b.data.map((d) => d.y), 0);
  const range = max - min || 1;
  const W = 280, H = 60, P = 4;
  const points = b.data.map((d, i) => {
    const x = P + (i / Math.max(b.data.length - 1, 1)) * (W - 2 * P);
    const y = H - P - ((d.y - min) / range) * (H - 2 * P);
    return [x, y] as [number, number];
  });
  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${path} L${points[points.length - 1][0].toFixed(1)},${H - P} L${points[0][0].toFixed(1)},${H - P} Z`;

  return (
    <div>
      <div className="text-[11px] font-semibold text-white mb-2">{b.title}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[60px]">
        <path d={areaPath} fill={accent} fillOpacity="0.08" />
        <path d={path} fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2" fill={accent} />
        ))}
      </svg>
      <div className="flex justify-between mt-1 text-[9.5px] text-[var(--muted)]">
        {b.data.map((d, i) => <span key={i}>{d.x}</span>)}
      </div>
    </div>
  );
}

function ComparisonBlock({ b, accent }: { b: Extract<CardBlock, { type: "comparison" }>; accent: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-white mb-2">{b.title}</div>
      <div className="grid grid-cols-2 gap-3">
        {[b.left, b.right].map((side, i) => (
          <div key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">{side.label}</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-[15px] font-bold tnum text-white">{side.value}</span>
              {trendIcon(side.trend, accent)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListBlock({ b }: { b: Extract<CardBlock, { type: "list" }> }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-white mb-2">{b.title}</div>
      <div className="space-y-1.5">
        {b.items.map((it, i) => (
          <div key={i} className="flex items-baseline justify-between gap-2 pb-1.5 border-b border-white/[0.04] last:border-0">
            <div className="min-w-0">
              <div className="text-[12px] text-white/85 truncate">{it.label}</div>
              {it.subtitle && <div className="text-[10px] text-[var(--muted)]">{it.subtitle}</div>}
            </div>
            <div className="text-[12px] font-semibold tnum text-white shrink-0">{it.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderBlock(b: CardBlock, idx: number, accent: string) {
  switch (b.type) {
    case "callout":    return <CalloutBlock    key={idx} b={b} />;
    case "bigNumber":  return <BigNumberBlock  key={idx} b={b} accent={accent} />;
    case "text":       return <TextBlock       key={idx} b={b} />;
    case "barChart":   return <BarChartBlock   key={idx} b={b} accent={accent} />;
    case "lineChart":  return <LineChartBlock  key={idx} b={b} accent={accent} />;
    case "comparison": return <ComparisonBlock key={idx} b={b} accent={accent} />;
    case "list":       return <ListBlock       key={idx} b={b} />;
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function TodayCard() {
  const { data, isLoading } = useQuery<DailyCardResponse>({
    queryKey: ["/dashboard/today-card"],
    queryFn: fetchTodayCard,
    refetchOnWindowFocus: false,
    staleTime: 30 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-5 flex items-center justify-center h-[120px]">
        <Loader2 size={16} className="text-[var(--muted)] animate-spin" />
      </div>
    );
  }

  if (!data || !Array.isArray(data.blocks) || data.blocks.length === 0) return null;

  const tone = pickPrimaryTone(data.blocks);
  const meta = TONE_META[tone];

  return (
    <div
      className="glass rounded-2xl p-5 relative overflow-hidden border"
      style={{ background: meta.bg, borderColor: meta.ring }}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[var(--muted)]">
          {todayLabel()}
        </span>
        {data.generatedBy === "ai" && (
          <span className="flex items-center gap-1 text-[9.5px] uppercase tracking-[0.12em] font-semibold text-[var(--muted)]">
            <Sparkles size={10} style={{ color: meta.color }} />
            IA
          </span>
        )}
      </div>

      <div className="space-y-4">
        {data.blocks.map((b, i) => renderBlock(b, i, meta.color))}
      </div>
    </div>
  );
}
