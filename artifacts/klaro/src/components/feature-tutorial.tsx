import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Lightbulb, X } from "lucide-react";

// One step in a feature tutorial. `target` is an optional CSS selector — if provided,
// the spotlight finds that element and the tooltip docks near it; otherwise the
// tooltip is centered on screen.
export type TutorialStep = {
  title: string;
  body: ReactNode;
  tip?: string;
  /** CSS selector for the element this step refers to (e.g. `#dropzone`). */
  target?: string;
  /** Preferred placement of the tooltip relative to the target. Default: "auto". */
  placement?: "top" | "bottom" | "left" | "right" | "auto";
};

type Rect = { top: number; left: number; width: number; height: number };

const PADDING = 10;
const TOOLTIP_WIDTH = 340;
const TOOLTIP_GAP = 14;

function getRect(selector: string | undefined): Rect | null {
  if (!selector) return null;
  if (typeof window === "undefined") return null;
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function pickPlacement(rect: Rect, preferred: TutorialStep["placement"]): "top" | "bottom" | "left" | "right" {
  if (preferred && preferred !== "auto") return preferred;
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const spaceBelow = vh - (rect.top + rect.height);
  const spaceAbove = rect.top;
  const spaceRight = vw - (rect.left + rect.width);
  const spaceLeft = rect.left;
  const best = Math.max(spaceBelow, spaceAbove, spaceRight, spaceLeft);
  if (best === spaceBelow) return "bottom";
  if (best === spaceAbove) return "top";
  if (best === spaceRight) return "right";
  return "left";
}

function tooltipPosition(rect: Rect | null, placement: ReturnType<typeof pickPlacement>) {
  if (!rect) {
    return {
      top: `calc(50% - 120px)`,
      left: `calc(50% - ${TOOLTIP_WIDTH / 2}px)`,
    };
  }
  switch (placement) {
    case "bottom":
      return { top: rect.top + rect.height + TOOLTIP_GAP, left: clamp(rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2, 12, window.innerWidth - TOOLTIP_WIDTH - 12) };
    case "top":
      return { top: rect.top - TOOLTIP_GAP, left: clamp(rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2, 12, window.innerWidth - TOOLTIP_WIDTH - 12), transform: "translateY(-100%)" };
    case "right":
      return { top: rect.top + rect.height / 2, left: rect.left + rect.width + TOOLTIP_GAP, transform: "translateY(-50%)" };
    case "left":
      return { top: rect.top + rect.height / 2, left: rect.left - TOOLTIP_GAP, transform: "translate(-100%, -50%)" };
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

export function FeatureTutorial({
  open,
  steps,
  onClose,
}: {
  open: boolean;
  steps: TutorialStep[];
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const current = steps[step] ?? steps[0];
  const isFirst = step === 0;
  const isLast = step === steps.length - 1;

  // Lock body scroll while the overlay is up.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Recompute target rect on step change, scroll, or resize. useLayoutEffect so the
  // spotlight doesn't paint at the previous step's position on transitions.
  useLayoutEffect(() => {
    if (!open) return;
    const r = getRect(current?.target);
    setRect(r);
    if (r && current?.target) {
      const el = document.querySelector(current.target) as HTMLElement | null;
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    const onUpdate = () => setRect(getRect(current?.target));
    window.addEventListener("resize", onUpdate);
    window.addEventListener("scroll", onUpdate, true);
    return () => {
      window.removeEventListener("resize", onUpdate);
      window.removeEventListener("scroll", onUpdate, true);
    };
  }, [open, current?.target]);

  // Reset to step 0 when reopened.
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open && !wasOpen.current) setStep(0);
    wasOpen.current = open;
  }, [open]);

  if (!open || steps.length === 0) return null;

  const placement = rect ? pickPlacement(rect, current.placement) : "bottom";
  const tipPos = tooltipPosition(rect, placement);

  // Spotlight box (with padding) — exposes the target while dimming everything else
  // via an inset box-shadow on a fixed full-screen element.
  const spotlight = rect
    ? {
        top: rect.top - PADDING,
        left: rect.left - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
      }
    : null;

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
      {/* Backdrop: full-screen dim, with a cut-out via inset shadow if there is a target. */}
      {spotlight ? (
        <div
          className="absolute pointer-events-auto rounded-2xl transition-all duration-300"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.62)",
            outline: "2px solid rgba(106,248,47,0.6)",
            outlineOffset: "0px",
          }}
          onClick={onClose}
        />
      ) : (
        <div className="absolute inset-0 bg-black/62 pointer-events-auto" onClick={onClose} />
      )}

      {/* Animated ring around the spotlight (pulse). */}
      {spotlight && (
        <div
          className="absolute pointer-events-none rounded-2xl"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            animation: "tutorial-ring-pulse 1.8s ease-in-out infinite",
          }}
        />
      )}

      {/* Tooltip. */}
      <div
        className="absolute pointer-events-auto rounded-2xl border border-[var(--border-2)] p-5 shadow-2xl glass-strong"
        style={{
          width: TOOLTIP_WIDTH,
          background: "rgba(16,16,20,0.97)",
          ...tipPos,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-lg text-[var(--muted)] transition-colors hover:bg-white/5 hover:text-white"
          aria-label="Fechar tutorial"
        >
          <X size={14} />
        </button>

        <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#90f048]">
          Dica {step + 1} de {steps.length}
        </p>
        <h3 className="mt-1 text-[15px] font-bold tracking-tight text-white pr-7">{current.title}</h3>
        <div className="mt-2 text-[12.5px] leading-relaxed text-[var(--muted)]">{current.body}</div>

        {current.tip && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-[rgba(106,248,47,0.18)] bg-[rgba(106,248,47,0.06)] px-3 py-2">
            <Lightbulb size={13} className="mt-0.5 shrink-0 text-[#90f048]" />
            <span className="text-[11.5px] leading-snug text-white/80">{current.tip}</span>
          </div>
        )}

        <div className="mt-4 flex items-center gap-1.5">
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === step ? 22 : 8,
                background: i === step ? "var(--accent)" : "var(--border-2)",
              }}
              aria-label={`Ir para dica ${i + 1}`}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStep((v) => v - 1)}
            disabled={isFirst}
            className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--border)] text-[var(--muted)] transition-colors hover:border-[var(--border-2)] hover:text-white disabled:opacity-30 disabled:hover:border-[var(--border)] disabled:hover:text-[var(--muted)]"
            aria-label="Dica anterior"
          >
            <ArrowLeft size={13} />
          </button>
          <button
            type="button"
            onClick={() => (isLast ? onClose() : setStep((v) => v + 1))}
            className="btn-primary flex h-9 flex-1 items-center justify-center gap-2 rounded-xl text-[12.5px] font-semibold"
          >
            {isLast ? "Concluir" : "Próxima"}
            {!isLast && <ArrowRight size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// Small button to drop into a feature page header.
export function TutorialButton({ onClick, label = "Tutorial" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(106,248,47,0.25)] bg-[rgba(106,248,47,0.08)] px-3 py-1.5 text-[12px] font-semibold text-[#90f048] transition-colors hover:bg-[rgba(106,248,47,0.14)]"
    >
      <Lightbulb size={12} />
      {label}
    </button>
  );
}
