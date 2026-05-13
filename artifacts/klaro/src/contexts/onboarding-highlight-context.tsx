import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

// Identifier for a nav item to be highlighted while the guided onboarding is on a
// matching step. Matches the `href` of items in NAV_ITEMS / BOTTOM_NAV in layout.tsx.
type HighlightTarget = string | null;

type Ctx = {
  highlight: HighlightTarget;
  setHighlight: (target: HighlightTarget) => void;
};

const OnboardingHighlightContext = createContext<Ctx | null>(null);

export function OnboardingHighlightProvider({ children }: { children: ReactNode }) {
  const [highlight, setHighlightState] = useState<HighlightTarget>(null);
  const setHighlight = useCallback((target: HighlightTarget) => setHighlightState(target), []);
  return (
    <OnboardingHighlightContext.Provider value={{ highlight, setHighlight }}>
      {children}
    </OnboardingHighlightContext.Provider>
  );
}

export function useOnboardingHighlight(): Ctx {
  const ctx = useContext(OnboardingHighlightContext);
  if (!ctx) return { highlight: null, setHighlight: () => {} };
  return ctx;
}
