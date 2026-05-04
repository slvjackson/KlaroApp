import { useEffect, useState } from "react";
import { Loader2, Lightbulb } from "lucide-react";

const PHASES = [
  { after: 0,  title: "Analisando transações…",     sub: "A IA está lendo seu histórico financeiro." },
  { after: 5,  title: "Identificando padrões…",     sub: "Encontrando tendências e anomalias nos seus dados." },
  { after: 14, title: "Gerando recomendações…",     sub: "Elaborando insights personalizados para o seu negócio." },
  { after: 28, title: "Quase pronto…",              sub: "Finalizando as análises. Só mais um instante!" },
  { after: 50, title: "Ainda processando…",         sub: "Análises mais complexas levam um pouco mais." },
];

interface Props {
  /** Timestamp (Date.now()) de quando a geração começou — persiste entre navegações */
  startedAt: number;
}

export function GeneratingInsightsOverlay({ startedAt }: Props) {
  const [elapsed, setElapsed] = useState(() =>
    Math.floor((Date.now() - startedAt) / 1000)
  );

  useEffect(() => {
    // Sync com wall-clock para que remounts mostrem o tempo correto
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      1000
    );
    return () => clearInterval(timer);
  }, [startedAt]);

  const phase = PHASES.reduce(
    (cur, p) => (elapsed >= p.after ? p : cur),
    PHASES[0]!
  );

  // absolute dentro do container relativo da página — sidebar continua acessível
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--background)]/80 backdrop-blur-sm rounded-2xl">
      <div className="glass rounded-2xl p-10 flex flex-col items-center gap-4 border border-[var(--border-2)] w-full max-w-sm text-center mx-4">
        <div className="w-20 h-20 rounded-full bg-[var(--accent-soft)] grid place-items-center animate-pulse">
          <Lightbulb size={38} className="text-[#90f048]" />
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-[17px] font-semibold text-white leading-snug">
            {phase.title}
          </p>
          <p className="text-[13px] text-[var(--muted)] leading-relaxed">
            {phase.sub}
          </p>
        </div>

        <Loader2 size={22} className="text-[#90f048] animate-spin mt-1" />

        {elapsed >= 5 && (
          <p className="text-[11px] text-[var(--muted)] opacity-50">{elapsed}s</p>
        )}
      </div>
    </div>
  );
}
