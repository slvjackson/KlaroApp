import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";

interface ComponentItem {
  value: number;
  max: number;
  label: string;
  filled?: number;
  total?: number;
  pct?: number | null;
  streak?: number;
  pinnedCount?: number;
  completedSteps?: number;
  totalSteps?: number;
}

interface HealthScore {
  score: number;
  components: {
    anamnese: ComponentItem;
    dados: ComponentItem;
    categorizacao: ComponentItem;
    margem: ComponentItem;
    engajamento: ComponentItem;
    missoes: ComponentItem;
  };
}

async function fetchHealthScore(): Promise<HealthScore> {
  const res = await fetch("/api/dashboard/health-score", { credentials: "include" });
  if (!res.ok) throw new Error("health-score fetch failed");
  return res.json() as Promise<HealthScore>;
}

// ─── Score color ──────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 71) return "#22c55e";
  if (score >= 41) return "#f59e0b";
  return "#f43f5e";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Excelente";
  if (score >= 60) return "Bom";
  if (score >= 40) return "Regular";
  return "Atenção";
}

// ─── Circular arc gauge ───────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const R = 52;
  const CX = 64;
  const CY = 64;
  const CIRC = 2 * Math.PI * R;
  const SWEEP_DEG = 270;
  const ARC_LEN = (SWEEP_DEG / 360) * CIRC;
  const GAP = CIRC - ARC_LEN;
  const filled = Math.max(0, Math.min(1, score / 100)) * ARC_LEN;
  const color = scoreColor(score);

  // Rotate -135deg so the 90° gap sits at the bottom
  const rotateAttr = `rotate(-135 ${CX} ${CY})`;

  return (
    <svg width="128" height="128" viewBox="0 0 128 128">
      {/* Track */}
      <circle
        cx={CX} cy={CY} r={R}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={10}
        strokeDasharray={`${ARC_LEN} ${GAP}`}
        strokeLinecap="round"
        transform={rotateAttr}
      />
      {/* Fill */}
      {filled > 0 && (
        <circle
          cx={CX} cy={CY} r={R}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeDasharray={`${filled} ${CIRC - filled}`}
          strokeLinecap="round"
          transform={rotateAttr}
          style={{ transition: "stroke-dasharray 0.8s ease, stroke 0.5s ease" }}
        />
      )}
      {/* Score text */}
      <text x={CX} y={CY - 4} textAnchor="middle" fill="white" fontSize="26" fontWeight="700" fontFamily="system-ui, sans-serif">
        {score}
      </text>
      <text x={CX} y={CY + 14} textAnchor="middle" fill={color} fontSize="10" fontWeight="600" fontFamily="system-ui, sans-serif" letterSpacing="0.05em">
        {scoreLabel(score).toUpperCase()}
      </text>
    </svg>
  );
}

// ─── Component row ────────────────────────────────────────────────────────────

function ComponentRow({ item, hint }: { item: ComponentItem; hint?: string }) {
  const done = item.value >= item.max;
  const pct = item.value / item.max;

  return (
    <div className="flex items-center gap-2">
      <div
        className="shrink-0 w-1.5 h-1.5 rounded-full"
        style={{ background: done ? "#22c55e" : item.value > 0 ? "#f59e0b" : "rgba(255,255,255,0.15)" }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-1">
          <span className="text-[11.5px] text-white/80 truncate">{item.label}</span>
          <span className="text-[10.5px] tabular-nums text-[var(--muted)] shrink-0">
            {item.value}/{item.max}
          </span>
        </div>
        <div className="mt-0.5 h-[3px] rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct * 100}%`,
              background: done ? "#22c55e" : item.value > 0 ? "#f59e0b" : "transparent",
            }}
          />
        </div>
        {hint && <div className="text-[10px] text-[var(--muted)] mt-0.5 leading-snug">{hint}</div>}
      </div>
    </div>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────

export function HealthScoreCard() {
  const { data, isLoading } = useQuery<HealthScore>({
    queryKey: ["/dashboard/health-score"],
    queryFn: fetchHealthScore,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-5 flex items-center justify-center h-[220px]">
        <Loader2 size={16} className="text-[var(--muted)] animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const { score, components } = data;
  const c = components;

  const anamneseHint = c.anamnese.filled != null && c.anamnese.filled < (c.anamnese.total ?? 14)
    ? `${c.anamnese.filled}/${c.anamnese.total} campos preenchidos`
    : undefined;

  const catHint = c.categorizacao.pct != null && c.categorizacao.pct < 100
    ? `${c.categorizacao.pct}% categorizadas`
    : undefined;

  const engHint = (c.engajamento.streak ?? 0) > 0
    ? `Sequência de ${c.engajamento.streak} dia${c.engajamento.streak !== 1 ? "s" : ""}`
    : undefined;

  const missoesHint = c.missoes.pinnedCount === 0
    ? "Ative um plano de ação em Insights"
    : c.missoes.totalSteps === 0
      ? `${c.missoes.pinnedCount} insight${c.missoes.pinnedCount !== 1 ? "s" : ""} pinado${c.missoes.pinnedCount !== 1 ? "s" : ""}`
      : `${c.missoes.completedSteps}/${c.missoes.totalSteps} passos concluídos`;

  // Pick the lowest-scoring incomplete component as the CTA target
  const ctaLink = c.missoes.value < c.missoes.max && c.missoes.pinnedCount === 0
    ? "/insights"
    : c.anamnese.value < c.anamnese.max
      ? "/anamnese"
      : "/upload";

  return (
    <div className="glass rounded-2xl p-5">
      <div className="text-[13px] font-semibold text-white mb-4">Saúde do Negócio</div>

      <div className="flex items-center gap-5">
        {/* Gauge */}
        <div className="shrink-0">
          <ScoreGauge score={score} />
        </div>

        {/* Component breakdown */}
        <div className="flex-1 min-w-0 space-y-2.5">
          <ComponentRow item={c.anamnese} hint={anamneseHint} />
          <ComponentRow item={c.dados} hint={c.dados.value === 0 ? "Faça um upload nos últimos 30 dias" : undefined} />
          <ComponentRow item={c.categorizacao} hint={catHint} />
          <ComponentRow item={c.margem} hint={c.margem.value === 0 ? "Receitas < Despesas no mês passado" : undefined} />
          <ComponentRow item={c.engajamento} hint={engHint} />
          <ComponentRow item={c.missoes} hint={missoesHint} />
        </div>
      </div>

      {/* CTA if score is low */}
      {score < 60 && (
        <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between">
          <span className="text-[11px] text-[var(--muted)]">Melhore seu score completando seu perfil</span>
          <Link href={ctaLink} className="text-[11px] text-[var(--accent)] hover:brightness-110 font-medium">
            {c.missoes.pinnedCount === 0 ? "Ver insights →" : "Completar →"}
          </Link>
        </div>
      )}
    </div>
  );
}
