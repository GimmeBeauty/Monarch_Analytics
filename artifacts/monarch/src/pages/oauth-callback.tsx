import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useLocation } from "wouter";

/**
 * OAuth 2.0 callback handler.
 *
 * Registered redirect URI to add in each platform's developer console:
 *   {your_app_origin}/oauth/callback
 *
 * When reached via popup (window.opener present):
 *   - Posts { type: "oauth_callback", code, state, error } to the parent window
 *   - Closes itself
 *
 * When reached via full-page redirect (no opener):
 *   - Stores the result in sessionStorage
 *   - Redirects to /settings/integrations
 */
export default function OAuthCallback() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");
    const errorDescription = params.get("error_description");

    const payload = {
      type: "oauth_callback",
      code,
      state,
      error,
      error_description: errorDescription,
    };

    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(payload, window.location.origin);
        setStatus("success");
        setTimeout(() => window.close(), 600);
      } catch {
        setStatus("error");
        setErrorMsg("Could not communicate with the parent window. Please close this tab and try again.");
      }
      return;
    }

    // Full-page redirect fallback
    if (error) {
      setStatus("error");
      setErrorMsg(errorDescription ?? error ?? "Authorization was denied.");
    } else if (code && state) {
      sessionStorage.setItem(`oauth_redirect_${state}`, JSON.stringify(payload));
      setStatus("success");
      setTimeout(() => setLocation("/settings/integrations"), 1500);
    } else {
      setStatus("error");
      setErrorMsg("No authorization code was received. The request may have expired.");
    }
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFF9F2] dark:bg-[#120d06]">
      <div className="flex flex-col items-center gap-4 p-8 max-w-sm text-center">

        {/* Logo mark */}
        <div
          className="w-10 h-10 rounded-xl mb-2"
          style={{ background: "linear-gradient(135deg, #FFBC80 0%, #FFE29A 100%)" }}
        />

        {status === "processing" && (
          <>
            <Loader2 size={28} className="text-[#FFBC80] animate-spin" />
            <p className="text-sm text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50">Completing authorization…</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle size={28} className="text-emerald-500" />
            <p className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">Authorization successful</p>
            <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">Returning to settings…</p>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle size={28} className="text-rose-500" />
            <p className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">Authorization failed</p>
            <p className="text-xs text-rose-600 dark:text-rose-400 leading-relaxed">{errorMsg}</p>
            <button
              onClick={() => setLocation("/settings/integrations")}
              className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold text-[#3A3A3A]"
              style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}
            >
              Back to Settings
            </button>
          </>
        )}
      </div>
    </div>
  );
}
