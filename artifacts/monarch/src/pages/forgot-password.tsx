import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { AuthShell, Field, ErrorBanner, SubmitButton } from "./login";
import { API_BASE } from "@/lib/apiBase";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();

  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [sent,    setSent]    = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Email is required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      {sent ? (
        <div className="text-center py-4">
          <CheckCircle2 size={36} className="text-green-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-[#3A3A3A] dark:text-[#FFF9F2] mb-2">
            Check your email
          </h2>
          <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mb-5 leading-relaxed">
            If an account exists for <span className="font-medium">{email}</span>, we've sent a password reset link. It expires in 24 hours.
          </p>
          <button
            onClick={() => setLocation("/login")}
            className="text-xs text-[#D97706] hover:underline flex items-center gap-1 mx-auto"
          >
            <ArrowLeft size={12} /> Back to login
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setLocation("/login")}
            className="flex items-center gap-1.5 text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 hover:text-[#3A3A3A]/70 dark:hover:text-[#FFF9F2]/60 mb-5 transition-colors"
          >
            <ArrowLeft size={13} /> Back to login
          </button>

          <h2 className="text-lg font-bold text-[#3A3A3A] dark:text-[#FFF9F2] mb-1">
            Forgot password?
          </h2>
          <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mb-6 leading-relaxed">
            Enter the email address associated with your account and we'll send you a reset link.
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

            <SubmitButton loading={loading}>Send reset link</SubmitButton>
          </form>
        </>
      )}
    </AuthShell>
  );
}
