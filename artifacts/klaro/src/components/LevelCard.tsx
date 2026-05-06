import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2, Star, Shield, Zap, Trophy } from "lucide-react";

interface AchievementsData {
  level: string;
  levelIndex: number;
  levelPct: number;
  points: number;
  nextLevelThreshold: number;
  unlockedCount: number;
  totalAchievements: number;
}

async function fetchAchievements(): Promise<AchievementsData> {
  const res = await fetch("/api/dashboard/achievements", { credentials: "include" });
  if (!res.ok) throw new Error("achievements fetch failed");
  return res.json() as Promise<AchievementsData>;
}

const LEVEL_META = [
  { icon: Star,   color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
  { icon: Shield, color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  { icon: Zap,    color: "#a855f7", bg: "rgba(168,85,247,0.12)" },
  { icon: Trophy, color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
];

export function LevelCard() {
  const { data, isLoading } = useQuery<AchievementsData>({
    queryKey: ["/dashboard/achievements"],
    queryFn: fetchAchievements,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-5 flex items-center justify-center h-[108px]">
        <Loader2 size={14} className="text-[var(--muted)] animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const meta = LEVEL_META[data.levelIndex];
  const LevelIcon = meta.icon;
  const isMax = data.levelIndex === 3;

  return (
    <div className="glass rounded-2xl p-4 flex flex-col gap-3">
      {/* Level row */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: meta.bg }}>
          <LevelIcon size={18} style={{ color: meta.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[14px] font-bold text-white">{data.level}</span>
            <span className="text-[11px] text-[var(--muted)]">{data.points} pts</span>
          </div>
          {!isMax ? (
            <>
              <div className="mt-1.5 h-[3px] rounded-full bg-white/5 overflow-hidden">
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
            <div className="text-[11px] mt-0.5" style={{ color: meta.color }}>Nível máximo</div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-[16px] font-bold text-white">{data.unlockedCount}</div>
          <div className="text-[9.5px] text-[var(--muted)]">de {data.totalAchievements}</div>
        </div>
      </div>

      <Link
        href="/conquistas"
        className="text-[11.5px] text-[var(--accent)] hover:brightness-110 transition text-center block"
      >
        Veja suas conquistas →
      </Link>
    </div>
  );
}
