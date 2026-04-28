import { Link } from "wouter";
import { Sparkles } from "lucide-react";

interface Props {
  completed?: boolean;
}

export function AnamneseCta({ completed }: Props) {
  if (completed) return null;
  return (
    <Link href="/anamnese">
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-[rgba(106,248,47,0.08)] to-[rgba(106,248,47,0.03)] border border-[rgba(106,248,47,0.18)] hover:border-[rgba(106,248,47,0.35)] transition-colors cursor-pointer group">
        <div className="w-8 h-8 rounded-xl bg-[var(--accent-soft)] grid place-items-center shrink-0 group-hover:scale-105 transition-transform">
          <Sparkles size={14} className="text-[#90f048]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-semibold text-white leading-snug">
            Quer insights que realmente fazem sentido pro seu negócio?
          </div>
          <div className="text-[11px] text-[var(--muted)] mt-0.5">
            Responda 4 perguntas rápidas e a Klaro IA vai te entregar análises muito mais precisas e personalizadas.
          </div>
        </div>
        <div className="text-[11px] font-semibold text-[#90f048] shrink-0 group-hover:translate-x-0.5 transition-transform">
          Fazer diagnóstico →
        </div>
      </div>
    </Link>
  );
}
