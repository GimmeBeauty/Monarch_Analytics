import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

// ─── Shared Layout ────────────────────────────────────────────────────────────

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFF9F2] dark:bg-[#120d06] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2.5 mb-1">
            <img
              src="/monarch-logo.jpg"
              alt="Monarch"
              className="w-9 h-9 rounded-xl object-cover object-center shadow-sm"
            />
            <span className="text-2xl font-black tracking-widest text-[#3A3A3A] dark:text-[#FFF9F2]">
              MONARCH
            </span>
          </div>
          <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 mt-1">
            Analytics Platform
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl bg-white dark:bg-[#1a1208] p-8"
          style={{ border: "1px solid rgba(255,188,128,0.3)" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Input Component ──────────────────────────────────────────────────────────

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  showToggle,
  onToggle,
  disabled,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  showToggle?: boolean;
  onToggle?: () => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#3A3A3A]/65 dark:text-[#FFF9F2]/55 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#FFBC80]/40 bg-white dark:bg-[#231a0e] text-[#3A3A3A] dark:text-[#FFF9F2] placeholder-[#3A3A3A]/30 dark:placeholder-[#FFF9F2]/25 focus:outline-none focus:ring-2 focus:ring-[#FFBC80]/60 focus:border-transparent disabled:opacity-50 transition-all"
          style={{ paddingRight: showToggle ? "2.75rem" : undefined }}
        />
        {showToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 hover:text-[#3A3A3A]/70 dark:hover:text-[#FFF9F2]/60"
          >
            {type === "password" ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Error Banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200/60 dark:border-red-800/40">
      <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-red-500" />
      <p className="text-xs text-red-700 dark:text-red-400">{message}</p>
    </div>
  );
}

// ─── Submit Button ─────────────────────────────────────────────────────────────

function SubmitButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-2.5 rounded-lg text-sm font-semibold text-[#3A3A3A] transition-opacity hover:opacity-85 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
      style={{ background: "linear-gradient(135deg, #FFBC80 0%, #FFE29A 100%)" }}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-3.5 h-3.5 border-2 border-[#3A3A3A]/30 border-t-[#3A3A3A]/80 rounded-full animate-spin" />
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────────

export { AuthShell, Field, ErrorBanner, SubmitButton };

export default function Login() {
  const { login } = useAuth();
  const { resetTheme } = useTheme();
  const [, setLocation] = useLocation();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      resetTheme();
      setLocation("/overview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <h2 className="text-lg font-bold text-[#3A3A3A] dark:text-[#FFF9F2] mb-1">Sign in</h2>
      <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mb-6">
        Enter your email and password to access Monarch.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorBanner message={error} />}

        <Field
          label="Email address"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@company.com"
          autoComplete="email"
          disabled={loading}
        />

        <Field
          label="Password"
          type={showPw ? "text" : "password"}
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          autoComplete="current-password"
          showToggle
          onToggle={() => setShowPw((p) => !p)}
          disabled={loading}
        />

        <div className="flex justify-end -mt-1">
          <button
            type="button"
            onClick={() => setLocation("/forgot-password")}
            className="text-xs text-[#D97706] hover:underline"
          >
            Forgot password?
          </button>
        </div>

        <SubmitButton loading={loading}>Sign in</SubmitButton>
      </form>
    </AuthShell>
  );
}
