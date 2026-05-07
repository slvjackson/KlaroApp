import { useQuery } from "@tanstack/react-query";
import { Loader2, Star, Shield, Zap, Trophy, Lock, Upload, User, Flame, Hash, Target, CheckCircle2, TrendingUp, Tag, Sparkles, Medal } from "lucide-react";

interface Achievement {
  id: string;
  title: string;
  description: string;
  category: string;
  unlocked: boolean;
}

interface AchievementsData {
  level: string;
  levelIndex: number;
  levelPct: number;
  points: number;
  nextLevelThreshold: number;
  totalActiveDays: number;
  currentStreak: number;
  achievements: Achievement[];
  unlockedCount: number;
  totalAchievements: number;
}

async function fetchAchievements(): Promise<AchievementsData> {
  const res = await fetch("/api/dashboard/achievements", { credentials: "include" });
  if (!res.ok) throw new Error("achievements fetch failed");
  return res.json() as Promise<AchievementsData>;
}

interface RankingData {
  topPercentileBucket: 10 | 25 | 50 | 75 | null;
}

async function fetchRanking(): Promise<RankingData> {
  const res = await fetch("/api/dashboard/ranking", { credentials: "include" });
  if (!res.ok) throw new Error("ranking fetch failed");
  return res.json() as Promise<RankingData>;
}

// Friendly label per bucket. Lower bucket = more motivational. 75 means "below median",
// shown as a softer encouragement rather than a "you're at the bottom" framing.
const BUCKET_META: Record<10 | 25 | 50 | 75, { label: string; sub: string; color: string; bg: string }> = {
  10: { label: "Top 10% mais ativos",     sub: "Você está entre os mais engajados.", color: "#f59e0b", bg: "rgba(245,158,11,0.10)" },
  25: { label: "Top 25% mais ativos",     sub: "Acima da maioria — continue assim.",  color: "#a855f7", bg: "rgba(168,85,247,0.10)" },
  50: { label: "Top 50% mais ativos",     sub: "Mais ativo que metade dos usuários.", color: "#3b82f6", bg: "rgba(59,130,246,0.10)" },
  75: { label: "Mantendo o ritmo",        sub: "Use mais dias seguidos para subir.",  color: "#94a3b8", bg: "rgba(148,163,184,0.10)" },
};

const LEVEL_META = [
  { icon: Star,   color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
  { icon: Shield, color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  { icon: Zap,    color: "#a855f7", bg: "rgba(168,85,247,0.12)" },
  { icon: Trophy, color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
];

const ACHIEVEMENT_META: Record<string, { icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>; color: string; bg: string }> = {
  primeiro_upload:        { icon: Upload,      color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  anamnese_completa:      { icon: User,        color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  streak_7:               { icon: Flame,       color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  streak_30:              { icon: Trophy,      color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  cem_transacoes:         { icon: Hash,        color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  primeira_missao:        { icon: Target,      color: "#a855f7", bg: "rgba(168,85,247,0.12)" },
  passo_concluido:        { icon: CheckCircle2,color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  mes_positivo:           { icon: TrendingUp,  color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  categorizacao_perfeita: { icon: Tag,         color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  cinco_insights:         { icon: Sparkles,    color: "#6af82f", bg: "rgba(106,248,47,0.12)" },
};

function LevelBanner({ data }: { data: AchievementsData }) {
  const meta = LEVEL_META[data.levelIndex];
  const LevelIcon = meta.icon;
  const isMax = data.levelIndex === 3;

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: meta.bg }}>
        <LevelIcon size={22} style={{ color: meta.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-[16px] font-bold text-white">{data.level}</span>
          <span className="text-[11px] text-[var(--muted)]">{data.points} pts</span>
        </div>
        {!isMax ? (
          <>
            <div className="h-[3px] rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${data.levelPct}%`, background: meta.color }}
              />
            </div>
            <div className="text-[10px] text-[var(--muted)] mt-1">
              {data.nextLevelThreshold - data.points} pts para o próximo nível
            </div>
          </>
        ) : (
          <div className="text-[11px]" style={{ color: meta.color }}>Nível máximo atingido 🏆</div>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className="text-[18px] font-bold text-white">{data.unlockedCount}</div>
        <div className="text-[10px] text-[var(--muted)]">de {data.totalAchievements}</div>
      </div>
    </div>
  );
}

function AchievementBadge({ achievement }: { achievement: Achievement }) {
  const meta = ACHIEVEMENT_META[achievement.id];
  const Icon = meta?.icon ?? Star;
  const color = meta?.color ?? "#6af82f";
  const bg = meta?.bg ?? "rgba(106,248,47,0.12)";

  return (
    <div
      className={`flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all duration-300 ${
        achievement.unlocked
          ? "border-white/[0.08] bg-white/[0.025]"
          : "border-white/[0.04] bg-white/[0.01] opacity-40"
      }`}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: achievement.unlocked ? bg : "rgba(255,255,255,0.04)" }}
      >
        {achievement.unlocked
          ? <Icon size={18} style={{ color }} />
          : <Lock size={14} className="text-[var(--muted)]" />}
      </div>
      <div>
        <div className="text-[10.5px] font-semibold text-white leading-tight">{achievement.title}</div>
        <div className="text-[9px] text-[var(--muted)] leading-snug mt-0.5">{achievement.description}</div>
      </div>
    </div>
  );
}

function RankingPill({ bucket }: { bucket: 10 | 25 | 50 | 75 }) {
  const meta = BUCKET_META[bucket];
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl border"
      style={{ background: meta.bg, borderColor: `${meta.color}33` }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${meta.color}1f` }}>
        <Medal size={17} style={{ color: meta.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-white leading-snug">{meta.label}</div>
        <div className="text-[11px] text-[var(--muted)] mt-0.5">{meta.sub}</div>
      </div>
    </div>
  );
}

export function AchievementsCard() {
  const { data, isLoading } = useQuery<AchievementsData>({
    queryKey: ["/dashboard/achievements"],
    queryFn: fetchAchievements,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });
  const { data: rankData } = useQuery<RankingData>({
    queryKey: ["/dashboard/ranking"],
    queryFn: fetchRanking,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-5 flex items-center justify-center h-[120px]">
        <Loader2 size={16} className="text-[var(--muted)] animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="text-[13px] font-semibold text-white">Nível, Conquistas & Ranking</div>

      <LevelBanner data={data} />

      <div className="grid grid-cols-5 gap-2">
        {data.achievements.map((a) => (
          <AchievementBadge key={a.id} achievement={a} />
        ))}
      </div>

      {rankData?.topPercentileBucket != null && (
        <RankingPill bucket={rankData.topPercentileBucket} />
      )}

      <div className="text-[10px] text-[var(--muted)] pt-1">
        Pontos acumulam com dias de uso e conquistas desbloqueadas.
      </div>
    </div>
  );
}
