import { useState, useEffect, type FormEvent } from "react";
import { useLocation, useSearch } from "wouter";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AuthShell, Field, ErrorBanner, SubmitButton } from "./login";
import { API_BASE } from "@/lib/apiBase";

type Stage = "loading" | "invalid" | "form" | "success";

export default function SetPassword() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const token  = params.get("token") ?? "";

  const { refetch } = useAuth();

  const [stage,       setStage]       = useState<Stage>("loading");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [confirmPw,   setConfirmPw]   = useState("");
  const [showPw,      setShowPw]      = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");

  // Validate the token on mount
  useEffect(() => {
    if (!token) { setStage("invalid"); return; }

    fetch(`${API_BASE}/api/auth/validate-token?token=${encodeURIComponent(token)}&type=invite`, {
      credentials: "include",
    })
      .then(r => r.json())
      .then((data: { valid: boolean; email?: string }) => {
        if (data.valid && data.email) {
          setEmail(data.email);
          setStage("form");
        } else {
          setStage("invalid");
        }
      })
      .catch(() => setStage("invalid"));
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPw) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/set-password`, {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to set password");

      await refetch();
      setStage("success");
      setTimeout(() => setLocation("/overview"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      {stage === "loading" && (
        <div className="text-center py-8">
          <div className="w-6 h-6 border-2 border-[#FFBC80]/40 border-t-[#FFBC80] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">Verifying your invitation…</p>
        </div>
      )}

      {stage === "invalid" && (
        <div className="text-center py-4">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-3">
            <span className="text-red-500 text-lg">✕</span>
          </div>
          <h2 className="text-base font-bold text-[#3A3A3A] dark:text-[#FFF9F2] mb-2">
            Link invalid or expired
          </h2>
          <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mb-5">
            This invitation link is no longer valid. It may have already been used or expired after 24 hours. Contact your admin for a new invite.
          </p>
          <button
            onClick={() => setLocation("/login")}
            className="text-xs text-[#D97706] hover:underline"
          >
            Back to login
          </button>
        </div>
      )}

      {stage === "success" && (
        <div className="text-center py-4">
          <CheckCircle2 size={36} className="text-green-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-[#3A3A3A] dark:text-[#FFF9F2] mb-1">
            Account activated!
          </h2>
          <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">
            Redirecting you to the dashboard…
          </p>
        </div>
      )}

      {stage === "form" && (
        <>
          <h2 className="text-lg font-bold text-[#3A3A3A] dark:text-[#FFF9F2] mb-1">
            Set your password
          </h2>
          <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mb-6">
            Creating account for <span className="font-medium text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60">{email}</span>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <ErrorBanner message={error} />}

            <Field
              label="Password"
              type={showPw ? "text" : "password"}
              value={password}
              onChange={setPassword}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
              showToggle
              onToggle={() => setShowPw(p => !p)}
              disabled={loading}
            />

            <Field
              label="Confirm password"
              type={showConfirm ? "text" : "password"}
              value={confirmPw}
              onChange={setConfirmPw}
              placeholder="Repeat your password"
              autoComplete="new-password"
              showToggle
              onToggle={() => setShowConfirm(p => !p)}
              disabled={loading}
            />

            <SubmitButton loading={loading}>Activate account</SubmitButton>
          </form>
        </>
      )}
    </AuthShell>
  );
}
