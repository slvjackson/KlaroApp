import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ChatProvider } from "@/contexts/chat-context";
import { UploadProvider, useUploadContext } from "@/contexts/upload-context";
import { OnboardingHighlightProvider } from "@/contexts/onboarding-highlight-context";
import { useGetMe, useGetBillingStatus } from "@workspace/api-client-react";
import { TrialWelcomeModal } from "@/components/trial-welcome-modal";
import { FirstLoginOnboarding, hasCompletedFirstLoginOnboarding } from "@/components/first-login-onboarding";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Dashboard from "@/pages/dashboard";
import Upload from "@/pages/upload";
import Review from "@/pages/review";
import Transactions from "@/pages/transactions";
import Insights from "@/pages/insights";
import InsightsHistory from "@/pages/insights-history";
import Reports from "@/pages/reports";
import Produto from "@/pages/produto";
import Precos from "@/pages/precos";
import Empresa from "@/pages/empresa";
import SolucoesIndex from "@/pages/solucoes/index";
import SolucoesImportacao from "@/pages/solucoes/importacao";
import SolucoesInsightsPage from "@/pages/solucoes/insights";
import SolucoesChat from "@/pages/solucoes/chat";
import SolucoesMissoes from "@/pages/solucoes/missoes";
import Profile from "@/pages/profile";
import Chat from "@/pages/chat";
import Anamnese from "@/pages/anamnese";
import Missions from "@/pages/missions";
import Billing from "@/pages/billing";
import Admin from "@/pages/admin";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import Saude from "@/pages/saude";
import { GlobalUploadOverlay } from "@/pages/upload";
import VerifyEmail from "@/pages/verify-email";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import faq from "@/pages/faq";

const queryClient = new QueryClient();

// Public paths that never need subscription check
const PUBLIC_PATHS = new Set([
  "/", "/login", "/signup", "/verify-email", "/forgot-password", "/reset-password",
  "/billing", "/admin", "/terms", "/privacy", "/faq",
  // Landing area — marketing pages are always accessible regardless of subscription state.
  "/produto", "/precos", "/empresa",
  "/solucoes", "/solucoes/importacao", "/solucoes/insights", "/solucoes/chat", "/solucoes/missoes",
]);

const BLOCKED_STATUSES = new Set(["expired"]);

function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading: authLoading } = useGetMe({ query: { queryKey: ["me"], retry: false } });
  const { data: billing, isLoading: billingLoading, isError: billingError } = useGetBillingStatus({
    query: {
      queryKey: ["billingStatus"],
      enabled: !!user,
      retry: false,
    },
  });

  const isPublic = PUBLIC_PATHS.has(location);

  const isBlocked = !!billing && (
    BLOCKED_STATUSES.has(billing.status) ||
    (billing.status === "trial" && (billing.trialDaysLeft ?? 0) <= 0)
  );

  // Wait for billing status before allowing a protected page to render —
  // otherwise the user can poke around /dashboard, /upload, etc. while the
  // query is in flight and only gets bounced once it returns. If the request
  // outright failed (network etc.), bail out of the wait so we can route
  // them to /billing instead of leaving them stuck on a spinner.
  const awaitingBilling = !!user && !isPublic && billingLoading && !billingError;

  useEffect(() => {
    if (isPublic) return;
    if (!user || authLoading || billingLoading) return;
    // Conservative: if we can't determine status (error), send them to /billing.
    if (billingError) { setLocation("/billing"); return; }
    if (!billing) return;
    if (isBlocked) setLocation("/billing");
  }, [user, authLoading, billing, billingLoading, billingError, isBlocked, isPublic, setLocation]);

  if (awaitingBilling) {
    return (
      <div className="min-h-screen grid place-items-center bg-ambient">
        <div className="text-[12px] text-[var(--muted)] tracking-wide uppercase">Carregando…</div>
      </div>
    );
  }

  // Block flashes content on a protected route until the redirect lands.
  if (!isPublic && (isBlocked || (billingError && !!user))) return null;

  return <>{children}</>;
}

// Return to the top when redirect

function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  return null;
}

function Router() {
  return (
    <>
    <ScrollToTop />

    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/billing" component={Billing} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/upload" component={Upload} />
      <Route path="/review/:id" component={Review} />
      <Route path="/transactions" component={Transactions} />
      <Route path="/insights" component={Insights} />
      <Route path="/insights/historico" component={InsightsHistory} />
      <Route path="/reports" component={Reports} />
      <Route path="/produto" component={Produto} />
      <Route path="/precos" component={Precos} />
      <Route path="/empresa" component={Empresa} />
      <Route path="/solucoes" component={SolucoesIndex} />
      <Route path="/solucoes/importacao" component={SolucoesImportacao} />
      <Route path="/solucoes/insights" component={SolucoesInsightsPage} />
      <Route path="/solucoes/chat" component={SolucoesChat} />
      <Route path="/solucoes/missoes" component={SolucoesMissoes} />
      <Route path="/profile" component={Profile} />
      <Route path="/chat" component={Chat} />
      <Route path="/anamnese" component={Anamnese} />
      <Route path="/missions" component={Missions} />
      <Route path="/admin" component={Admin} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/saude" component={Saude} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/faq" component={faq} />
        </Switch>
  </>
  );
}

function AppInner() {
  const { uploading, uploadingFileName, cancel } = useUploadContext();
  const [location] = useLocation();
  const { data: user } = useGetMe({ query: { retry: false } });
  const { data: billing } = useGetBillingStatus({ query: { enabled: !!user, retry: false } });
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    setOnboardingDone(user ? hasCompletedFirstLoginOnboarding(user) : true);
  }, [user]);

  const shouldShowOnboarding = !!user && onboardingDone === false && !PUBLIC_PATHS.has(location);

  return (
    <SubscriptionGuard>
      <Router />
      {uploading && <GlobalUploadOverlay fileName={uploadingFileName} onCancel={cancel} />}
      {shouldShowOnboarding && (
        <FirstLoginOnboarding user={user} onDone={() => setOnboardingDone(true)} />
      )}
      {user && billing && onboardingDone === true && <TrialWelcomeModal billing={billing} />}
    </SubscriptionGuard>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ChatProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <UploadProvider>
              <OnboardingHighlightProvider>
                <AppInner />
              </OnboardingHighlightProvider>
            </UploadProvider>
          </WouterRouter>
          <Toaster />
        </ChatProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
