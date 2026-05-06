import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Loader2, ArrowRight, TrendingUp, TrendingDown, PieChart, BarChart3,
  Sparkles, Upload, AlertCircle, Trophy,
} from "lucide-react";

type CardTone = "insight" | "comparison" | "warning" | "celebration";

interface DailyCard {
  id: string;
  tone: CardTone;
  icon: string;
  headline: string;
  body: string;
  metric?: { value: string; delta?: string; trend?: "up" | "down" | "flat" };
  cta?: { label: string; href: string };
}

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>> = {
  TrendingUp, TrendingDown, PieChart, BarChart3, Sparkles, Upload, AlertCircle, Trophy,
};

const TONE_META: Record<CardTone, { color: string; bg: string; ring: string; pill: string }> = {
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

async function fetchTodayCard(): Promise<DailyCard> {
  const res = await fetch("/api/dashboard/today-card", { credentials: "include" });
  if (!res.ok) throw new Error("today-card fetch failed");
  return res.json() as Promise<DailyCard>;
}

function todayLabel(): string {
  const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const d = new Date();
  return `Hoje · ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function TodayCard() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useQuery<DailyCard>({
    queryKey: ["/dashboard/today-card"],
    queryFn: fetchTodayCard,
    refetchOnWindowFocus: false,
    staleTime: 30 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-5 flex items-center justify-center h-[110px]">
        <Loader2 size={16} className="text-[var(--muted)] animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const meta = TONE_META[data.tone];
  const Icon = ICON_MAP[data.icon] ?? Sparkles;
  const trendIcon = data.metric?.trend === "up" ? TrendingUp : data.metric?.trend === "down" ? TrendingDown : null;
  const TrendIcon = trendIcon;

  return (
    <div
      className="glass rounded-2xl p-5 relative overflow-hidden"
      style={{ background: meta.bg, borderColor: meta.ring }}
    >
      {/* Top label */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: meta.pill }}
          >
            <Icon size={14} style={{ color: meta.color }} />
          </div>
          <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[var(--muted)]">
            {todayLabel()}
          </span>
        </div>
        {data.metric && (
          <div className="flex items-center gap-1.5 text-right shrink-0">
            {TrendIcon && <TrendIcon size={14} style={{ color: meta.color }} />}
            <span className="text-[16px] font-bold tnum" style={{ color: meta.color }}>
              {data.metric.value}
            </span>
          </div>
        )}
      </div>

      {/* Headline + body */}
      <div className="space-y-1.5">
        <div className="text-[15px] font-semibold text-white leading-snug">{data.headline}</div>
        <p className="text-[12.5px] text-[var(--muted)] leading-relaxed">{data.body}</p>
      </div>

      {/* CTA */}
      {data.cta && (
        <button
          onClick={() => setLocation(data.cta!.href)}
          className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold transition-all hover:gap-2"
          style={{ color: meta.color }}
        >
          {data.cta.label}
          <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}
