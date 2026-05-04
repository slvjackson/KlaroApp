import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ChatProvider } from "@/contexts/chat-context";
import { UploadProvider, useUploadContext } from "@/contexts/upload-context";
import { useGetMe, useGetBillingStatus } from "@workspace/api-client-react";
import NotFound from "@/pages/not-found";

import Home from "@/pages/home";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Dashboard from "@/pages/dashboard";
import Upload from "@/pages/upload";
import Review from "@/pages/review";
import Transactions from "@/pages/transactions";
import Insights from "@/pages/insights";
import Profile from "@/pages/profile";
import Chat from "@/pages/chat";
import Anamnese from "@/pages/anamnese";
import Missions from "@/pages/missions";
import Billing from "@/pages/billing";
import { GlobalUploadOverlay } from "@/pages/upload";
import VerifyEmail from "@/pages/verify-email";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";

const queryClient = new QueryClient();

// Public paths that never need subscription check
const PUBLIC_PATHS = new Set(["/", "/login", "/signup", "/verify-email", "/forgot-password", "/reset-password", "/billing"]);

const BLOCKED_STATUSES = new Set(["expired", "cancelled", "overdue"]);

function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading: authLoading } = useGetMe({ query: { retry: false } });
  const { data: billing, isLoading: billingLoading } = useGetBillingStatus({
    query: {
      enabled: !!user,
      retry: false,
    },
  });

  useEffect(() => {
    if (PUBLIC_PATHS.has(location)) return;
    if (!user || authLoading || billingLoading) return;
    if (!billing) return;

    const isBlocked =
      BLOCKED_STATUSES.has(billing.status) ||
      (billing.status === "trial" && (billing.trialDaysLeft ?? 0) <= 0);

    if (isBlocked) setLocation("/billing");
  }, [user, authLoading, billing, billingLoading, location, setLocation]);

  return <>{children}</>;
}

function Router() {
  return (
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
      <Route path="/profile" component={Profile} />
      <Route path="/chat" component={Chat} />
      <Route path="/anamnese" component={Anamnese} />
      <Route path="/missions" component={Missions} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppInner() {
  const { uploading, uploadingFileName, cancel } = useUploadContext();
  return (
    <SubscriptionGuard>
      <Router />
      {uploading && <GlobalUploadOverlay fileName={uploadingFileName} onCancel={cancel} />}
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
              <AppInner />
            </UploadProvider>
          </WouterRouter>
          <Toaster />
        </ChatProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
