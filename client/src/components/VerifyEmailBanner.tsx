import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import * as authApi from "../features/auth/api";
import { extractErrorMessage } from "../lib/errors";

// Shown on every signed-in page until the email is verified.
export function VerifyEmailBanner() {
  const { user } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  if (!user || user.emailVerified) return null;

  async function resend(): Promise<void> {
    if (!user) return;
    setIsSending(true);
    try {
      await authApi.resendVerification(user.email);
      setStatus("Code sent — check your inbox (it can take a minute).");
    } catch (err) {
      setStatus(extractErrorMessage(err));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div role="status" className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 sm:px-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>
          Please verify your email address (<span className="font-medium">{user.email}</span>).
        </span>
        <Link to={`/verify-email?email=${encodeURIComponent(user.email)}`} className="font-medium underline">
          Enter code
        </Link>
        <button type="button" onClick={() => void resend()} disabled={isSending} className="font-medium underline disabled:opacity-60">
          {isSending ? "Sending..." : "Resend code"}
        </button>
        {status && <span className="text-amber-800">{status}</span>}
      </div>
    </div>
  );
}
