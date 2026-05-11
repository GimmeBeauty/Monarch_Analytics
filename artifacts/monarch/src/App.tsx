import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/context/ThemeContext";
import { DateRangeProvider } from "@/context/DateRangeContext";
import { ProfileProvider } from "@/context/ProfileContext";
import { TeamProvider } from "@/context/TeamContext";
import { AlertsProvider } from "@/context/AlertsContext";
import { ExportsProvider } from "@/context/ExportsContext";
import { StoreFilterProvider } from "@/context/StoreFilterContext";
import { PricingModeProvider } from "@/context/PricingModeContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import NotFound from "@/pages/not-found";
import Overview from "@/pages/overview";
import Traffic from "@/pages/traffic";
import Spend from "@/pages/spend";
import Attribution from "@/pages/attribution";
import Performance from "@/pages/performance";
import Forecast from "@/pages/forecast";
import KnowledgeHub from "@/pages/knowledge-hub";
import Settings from "@/pages/settings";
import OAuthCallback from "@/pages/oauth-callback";
import Login from "@/pages/login";
import SetPassword from "@/pages/set-password";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import PrivacyPolicy from "@/pages/privacy-policy";
import TermsOfUse from "@/pages/terms-of-use";
import DataSecurity from "@/pages/data-security";
import InfoSecPolicy from "@/pages/data-security/information-security-policy";
import DataClassPolicy from "@/pages/data-security/data-classification-policy";
import AccessControlPolicy from "@/pages/data-security/access-control-policy";
import DataProtectionPolicy from "@/pages/data-security/data-protection-policy";
import IncidentResponsePolicy from "@/pages/data-security/incident-response-policy";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 1000 * 60 * 2 } },
});

// ─── Public-only guard: redirect authenticated users away from auth pages ──────

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <AuthLoadingScreen />;
  if (user) return <Redirect to="/overview" />;
  return <Component />;
}

// ─── Protected guard: redirect unauthenticated users to /login ─────────────────

function PrivateRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) return <AuthLoadingScreen />;
  if (!user) return <Redirect to={`/login?next=${encodeURIComponent(location)}`} />;
  return <Component />;
}

// ─── Full-screen loading state shown while the session check is in-flight ──────

function AuthLoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFF9F2] dark:bg-[#120d06]">
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl"
          style={{ background: "linear-gradient(135deg, #FFBC80 0%, #FFE29A 100%)" }}
        />
        <div className="w-5 h-5 border-2 border-[#FFBC80]/40 border-t-[#FFBC80] rounded-full animate-spin" />
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      {/* OAuth callback — public, no auth required */}
      <Route path="/oauth/callback">
        {() => <OAuthCallback />}
      </Route>

      {/* Legal pages — public, no auth required */}
      <Route path="/privacy-policy">
        {() => <PrivacyPolicy />}
      </Route>
      <Route path="/terms-of-use">
        {() => <TermsOfUse />}
      </Route>
      <Route path="/knowledge-hub/data-security">
        {() => <DataSecurity />}
      </Route>
      <Route path="/knowledge-hub/data-security/information-security-policy">
        {() => <InfoSecPolicy />}
      </Route>
      <Route path="/knowledge-hub/data-security/data-classification-policy">
        {() => <DataClassPolicy />}
      </Route>
      <Route path="/knowledge-hub/data-security/access-control-policy">
        {() => <AccessControlPolicy />}
      </Route>
      <Route path="/knowledge-hub/data-security/data-protection-policy">
        {() => <DataProtectionPolicy />}
      </Route>
      <Route path="/knowledge-hub/data-security/incident-response-policy">
        {() => <IncidentResponsePolicy />}
      </Route>

      {/* Public auth routes */}
      <Route path="/login">
        {() => <PublicRoute component={Login} />}
      </Route>
      <Route path="/set-password">
        {() => <SetPassword />}
      </Route>
      <Route path="/forgot-password">
        {() => <PublicRoute component={ForgotPassword} />}
      </Route>
      <Route path="/reset-password">
        {() => <ResetPassword />}
      </Route>

      {/* Protected app routes */}
      <Route path="/">
        <Redirect to="/overview" />
      </Route>
      <Route path="/overview">
        {() => <PrivateRoute component={Overview} />}
      </Route>
      <Route path="/traffic">
        {() => <PrivateRoute component={Traffic} />}
      </Route>
      <Route path="/spend">
        {() => <PrivateRoute component={Spend} />}
      </Route>
      <Route path="/attribution">
        {() => <PrivateRoute component={Attribution} />}
      </Route>
      <Route path="/performance">
        {() => <PrivateRoute component={Performance} />}
      </Route>
      <Route path="/forecast">
        {() => <PrivateRoute component={Forecast} />}
      </Route>
      <Route path="/knowledge-hub">
        {() => <PrivateRoute component={KnowledgeHub} />}
      </Route>
      <Route path="/settings">
        {() => <PrivateRoute component={() => <Settings params={{ section: "profile" }} />} />}
      </Route>
      <Route path="/settings/:section">
        {(params) => <PrivateRoute component={() => <Settings params={params} />} />}
      </Route>
      <Route path="/integrations">
        {() => <PrivateRoute component={() => <Settings params={{ section: "integrations" }} />} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProfileProvider>
          <TeamProvider>
          <AlertsProvider>
          <ExportsProvider>
          <StoreFilterProvider>
          <PricingModeProvider>
          <ThemeProvider>
            <DateRangeProvider>
              <TooltipProvider>
                <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                  <Router />
                </WouterRouter>
                <Toaster />
              </TooltipProvider>
            </DateRangeProvider>
          </ThemeProvider>
          </PricingModeProvider>
          </StoreFilterProvider>
          </ExportsProvider>
          </AlertsProvider>
          </TeamProvider>
        </ProfileProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
