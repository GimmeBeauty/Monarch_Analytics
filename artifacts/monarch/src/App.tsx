import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/context/ThemeContext";
import { DateRangeProvider } from "@/context/DateRangeContext";
import { ProfileProvider } from "@/context/ProfileContext";
import Sidebar from "@/components/layout/Sidebar";
import NotFound from "@/pages/not-found";
import Overview from "@/pages/overview";
import Traffic from "@/pages/traffic";
import Spend from "@/pages/spend";
import Attribution from "@/pages/attribution";
import Performance from "@/pages/performance";
import Forecast from "@/pages/forecast";
import KnowledgeHub from "@/pages/knowledge-hub";
import Settings from "@/pages/settings";
import Integrations from "@/pages/integrations";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 1000 * 60 * 2 } },
});

function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#FFF9F2] dark:bg-[#120d06]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Switch>
          <Route path="/">
            <Redirect to="/overview" />
          </Route>
          <Route path="/overview" component={Overview} />
          <Route path="/traffic" component={Traffic} />
          <Route path="/spend" component={Spend} />
          <Route path="/attribution" component={Attribution} />
          <Route path="/performance" component={Performance} />
          <Route path="/forecast" component={Forecast} />
          <Route path="/knowledge-hub" component={KnowledgeHub} />
          <Route path="/settings">
            {() => <Settings params={{ section: "profile" }} />}
          </Route>
          <Route path="/settings/:section">
            {(params) => <Settings params={params} />}
          </Route>
          <Route path="/integrations">
            {() => <Settings params={{ section: "integrations" }} />}
          </Route>
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ProfileProvider>
        <ThemeProvider>
          <DateRangeProvider>
            <TooltipProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <AppShell />
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </DateRangeProvider>
        </ThemeProvider>
      </ProfileProvider>
    </QueryClientProvider>
  );
}

export default App;
