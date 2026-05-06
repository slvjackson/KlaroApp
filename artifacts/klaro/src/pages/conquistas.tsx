import { useRequireAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Loader2, Star, Shield, Zap, Trophy, Lock, Upload, User, Flame, Hash, Target, CheckCircle2, TrendingUp, Tag, Sparkles, Medal } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Achievement { id: string; title: string; description: string; category: string; unlocked: boolean }
interface AchievementsData {
  level: string; levelIndex: number; levelPct: number; points: number;
  nextLevelThreshold: number; totalActiveDays: number; currentStreak: number;
  achievements: Achievement[]; unlockedCount: number; totalAchievements: number;
}
interface RankEntry { rank: number; name: string; pts: number; isCurrentUser: boolean }
interface RankingData { userRank: number; userPts: number; totalUsers: number; nearby: RankEntry[] }

async function fetchAchievements(): Promise<AchievementsData> {
  const res = await fetch("/api/dashboard/achievements", { credentials: "include" });
  if (!res.ok) throw new Error("achievements fetch failed");
  return res.json() as Promise<AchievementsData>;
}

async function fetchRanking(): Promise<RankingData> {
  const res = await fetch("/api/dashboard/ranking", { credentials: "include" });
  if (!res.ok) throw new Error("ranking fetch failed");
  return res.json() as Promise<RankingData>;
}

// ─── Level meta ───────────────────────────────────────────────────────────────

const LEVEL_META = [
  { icon: Star,   color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
  { icon: Shield, color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  { icon: Zap,    color: "#a855f7", bg: "rgba(168,85,247,0.12)" },
  { icon: Trophy, color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
];

const ACHIEVEMENT_META: Record<string, { icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; color: string; bg: string }> = {
  primeiro_upload:        { icon: Upload,       color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  anamnese_completa:      { icon: User,         color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  streak_7:               { icon: Flame,        color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  streak_30:              { icon: Trophy,       color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  cem_transacoes:         { icon: Hash,         color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  primeira_missao:        { icon: Target,       color: "#a855f7", bg: "rgba(168,85,247,0.12)" },
  passo_concluido:        { icon: CheckCircle2, color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  mes_positivo:           { icon: TrendingUp,   color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  categorizacao_perfeita: { icon: Tag,          color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  cinco_insights:         { icon: Sparkles,     color: "#6af82f", bg: "rgba(106,248,47,0.12)" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function LevelBanner({ data }: { data: AchievementsData }) {
  const meta = LEVEL_META[data.levelIndex];
  const LevelIcon = meta.icon;
  const isMax = data.levelIndex === 3;

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ background: meta.bg }}>
        <LevelIcon size={26} style={{ color: meta.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-[18px] font-bold text-white">{data.level}</span>
          <span className="text-[12px] text-[var(--muted)]">{data.points} pts</span>
        </div>
        {!isMax ? (
          <>
            <div className="h-[4px] rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${data.levelPct}%`, background: meta.color }} />
            </div>
            <div className="text-[10.5px] text-[var(--muted)] mt-1">{data.nextLevelThreshold - data.points} pts para o próximo nível</div>
          </>
        ) : (
          <div className="text-[12px] font-medium" style={{ color: meta.color }}>Nível máximo atingido 🏆</div>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className="text-[22px] font-bold text-white">{data.unlockedCount}</div>
        <div className="text-[10px] text-[var(--muted)]">de {data.totalAchievements}</div>
        <div className="text-[10px] text-[var(--muted)]">conquistas</div>
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
    <div className={`flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all ${achievement.unlocked ? "border-white/[0.08] bg-white/[0.025]" : "border-white/[0.04] bg-white/[0.01] opacity-40"}`}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: achievement.unlocked ? bg : "rgba(255,255,255,0.04)" }}>
        {achievement.unlocked ? <Icon size={18} style={{ color }} /> : <Lock size={14} className="text-[var(--muted)]" />}
      </div>
      <div>
        <div className="text-[10.5px] font-semibold text-white leading-tight">{achievement.title}</div>
        <div className="text-[9px] text-[var(--muted)] leading-snug mt-0.5">{achievement.description}</div>
      </div>
    </div>
  );
}

function RankingRow({ entry }: { entry: RankEntry }) {
  const isTop3 = entry.rank <= 3;
  const podiumColors = ["#f59e0b", "#94a3b8", "#cd7c32"];

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${entry.isCurrentUser ? "bg-[rgba(106,248,47,0.06)] border border-[rgba(106,248,47,0.15)]" : "border border-transparent"}`}>
      <div className={`w-8 text-center shrink-0 ${isTop3 ? "font-bold text-[14px]" : "text-[12px] text-[var(--muted)]"}`} style={isTop3 ? { color: podiumColors[entry.rank - 1] } : undefined}>
        {isTop3 ? <Medal size={16} style={{ color: podiumColors[entry.rank - 1], display: "inline" }} /> : `#${entry.rank}`}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-[13px] truncate ${entry.isCurrentUser ? "font-semibold text-white" : "text-white/80"}`}>
          {entry.isCurrentUser ? "Você" : entry.name}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className={`text-[13px] font-semibold tnum ${entry.isCurrentUser ? "text-[var(--accent)]" : "text-white"}`}>{entry.pts}</div>
        <div className="text-[9.5px] text-[var(--muted)]">dias ativos</div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Conquistas() {
  const { isLoading: isAuthLoading } = useRequireAuth();
  const { data: achData, isLoading: isAchLoading } = useQuery<AchievementsData>({
    queryKey: ["/dashboard/achievements"],
    queryFn: fetchAchievements,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });
  const { data: rankData, isLoading: isRankLoading } = useQuery<RankingData>({
    queryKey: ["/dashboard/ranking"],
    queryFn: fetchRanking,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  if (isAuthLoading) return null;

  return (
    <Layout title="Conquistas">
      <div className="space-y-6 max-w-xl">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-white">Nível & Conquistas</h1>
          <p className="text-[12.5px] text-[var(--muted)] mt-1">
            Desbloqueie conquistas usando a plataforma regularmente.
          </p>
        </div>

        {/* Level banner */}
        {isAchLoading ? (
          <div className="glass rounded-2xl p-8 flex items-center justify-center">
            <Loader2 size={16} className="text-[var(--muted)] animate-spin" />
          </div>
        ) : achData ? (
          <>
            <div className="glass rounded-2xl p-5 space-y-4">
              <div className="text-[13px] font-semibold text-white">Seu nível</div>
              <LevelBanner data={achData} />
              <div className="text-[11px] text-[var(--muted)]">
                Pontos = dias de uso + conquistas desbloqueadas × 5
              </div>
            </div>

            {/* Achievements */}
            <div className="glass rounded-2xl p-5 space-y-4">
              <div className="flex items-baseline justify-between">
                <div className="text-[13px] font-semibold text-white">Conquistas</div>
                <div className="text-[11px] text-[var(--muted)]">{achData.unlockedCount}/{achData.totalAchievements} desbloqueadas</div>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {achData.achievements.map((a) => (
                  <AchievementBadge key={a.id} achievement={a} />
                ))}
              </div>
            </div>
          </>
        ) : null}

        {/* Ranking */}
        <div className="glass rounded-2xl p-5 space-y-4">
          <div className="flex items-baseline justify-between">
            <div className="text-[13px] font-semibold text-white">Ranking Global</div>
            {rankData && (
              <div className="text-[11px] text-[var(--muted)]">
                Você está em <span className="text-white font-semibold">#{rankData.userRank}</span> de {rankData.totalUsers}
              </div>
            )}
          </div>

          {isRankLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={16} className="text-[var(--muted)] animate-spin" />
            </div>
          ) : rankData ? (
            <>
              <div className="space-y-1">
                {rankData.nearby.map((entry) => (
                  <RankingRow key={`${entry.rank}-${entry.name}`} entry={entry} />
                ))}
              </div>
              <div className="text-[10.5px] text-[var(--muted)] pt-1">
                Ranking baseado em dias de uso. Nomes de outros usuários são mascarados.
              </div>
            </>
          ) : null}
        </div>
      </div>
    </Layout>
  );
}
