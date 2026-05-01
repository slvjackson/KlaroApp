import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ChatProvider } from "@/contexts/chat-context";
import { UploadProvider, useUploadContext } from "@/contexts/upload-context";
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
import { GlobalUploadOverlay } from "@/pages/upload";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/upload" component={Upload} />
      <Route path="/review/:id" component={Review} />
      <Route path="/transactions" component={Transactions} />
      <Route path="/insights" component={Insights} />
      <Route path="/profile" component={Profile} />
      <Route path="/chat" component={Chat} />
      <Route path="/anamnese" component={Anamnese} />
      <Route path="/missions" component={Missions} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppInner() {
  const { uploading, uploadingFileName, cancel } = useUploadContext();
  return (
    <>
      <Router />
      {uploading && <GlobalUploadOverlay fileName={uploadingFileName} onCancel={cancel} />}
    </>
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
