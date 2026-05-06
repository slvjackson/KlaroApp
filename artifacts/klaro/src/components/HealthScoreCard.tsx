import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";

interface HealthScore {
  score: number;
  components: Record<string, { value: number; max: number; label: string; [key: string]: unknown }>;
}

async function fetchHealthScore(): Promise<HealthScore> {
  const res = await fetch("/api/dashboard/health-score", { credentials: "include" });
  if (!res.ok) throw new Error("health-score fetch failed");
  return res.json() as Promise<HealthScore>;
}

function scoreColor(score: number): string {
  if (score >= 71) return "#7FE5C2"; // mint pastel
  if (score >= 41) return "#C2B5FF"; // lavender pastel
  return "#FF9580";                   // coral pastel
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Excelente";
  if (score >= 60) return "Bom";
  if (score >= 40) return "Regular";
  return "Atenção";
}

function ScoreGauge({ score }: { score: number }) {
  const R = 52, CX = 64, CY = 64;
  const CIRC = 2 * Math.PI * R;
  const ARC_LEN = (270 / 360) * CIRC;
  const GAP = CIRC - ARC_LEN;
  const filled = Math.max(0, Math.min(1, score / 100)) * ARC_LEN;
  const color = scoreColor(score);
  const rotate = `rotate(-135 ${CX} ${CY})`;

  return (
    <svg width="128" height="128" viewBox="0 0 128 128">
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} strokeDasharray={`${ARC_LEN} ${GAP}`} strokeLinecap="round" transform={rotate} />
      {filled > 0 && (
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={color} strokeWidth={10} strokeDasharray={`${filled} ${CIRC - filled}`} strokeLinecap="round" transform={rotate} style={{ transition: "stroke-dasharray 0.8s ease, stroke 0.5s ease" }} />
      )}
      <text x={CX} y={CY - 4} textAnchor="middle" fill="white" fontSize="26" fontWeight="700" fontFamily="system-ui, sans-serif">{score}</text>
      <text x={CX} y={CY + 14} textAnchor="middle" fill={color} fontSize="10" fontWeight="600" fontFamily="system-ui, sans-serif" letterSpacing="0.05em">{scoreLabel(score).toUpperCase()}</text>
    </svg>
  );
}

export function HealthScoreCard() {
  const { data, isLoading } = useQuery<HealthScore>({
    queryKey: ["/dashboard/health-score"],
    queryFn: fetchHealthScore,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-5 flex items-center justify-center h-full min-h-[200px]">
        <Loader2 size={16} className="text-[var(--muted)] animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="glass rounded-2xl p-5 flex flex-col h-full">
      <div className="text-[13px] font-semibold text-white mb-3">Saúde do Negócio</div>
      <div className="flex-1 flex items-center justify-center py-2">
        <ScoreGauge score={data.score} />
      </div>
      <Link
        href="/saude"
        className="text-[11.5px] text-[var(--accent)] hover:brightness-110 transition text-center mt-3 block"
      >
        Entenda como melhorar →
      </Link>
    </div>
  );
}

// Re-export gauge for reuse in /saude page
export { ScoreGauge, scoreColor, scoreLabel };
export type { HealthScore };
