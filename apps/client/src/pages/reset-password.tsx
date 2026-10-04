import { useState, type SyntheticEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { authClient } from "../lib/auth";
import { Button, Notice } from "../components/ui";

// Neon Auth sends reset emails to {auth}/reset-password/{token}, which validates
// the token and redirects here with ?token=... (or ?error=INVALID_TOKEN).
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const linkInvalid =
    !token || token === "INVALID_TOKEN" || Boolean(params.get("error"));
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    setError(null);
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const result = await authClient.resetPassword({
        newPassword: form.password,
        token,
      });
      if (result.error) throw new Error(result.error.message);
      void navigate("/login?reset=success", { replace: true });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "We couldn’t reset your password.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-visual">
        <div>
          <p className="eyebrow">A private door into SoulSeer</p>
          <h1>
            A fresh start.
            <br />
            <em>Choose a new password.</em>
          </h1>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-box">
          <p className="wordmark">
            SoulSeer<span>✦</span>
          </p>
          <h2>Choose a new password</h2>
          {linkInvalid ? (
            <>
              <Notice tone="error">
                This reset link is invalid or has expired. Reset links last 15
                minutes.
              </Notice>
              <p className="switch-auth">
                <Link to="/login?forgot=1">Request a new reset link</Link>
              </p>
            </>
          ) : (
            <>
              {error && <Notice tone="error">{error}</Notice>}
              <form
                className="stack-form"
                onSubmit={(event) => {
                  void submit(event);
                }}
              >
                <label>
                  New password
                  <span className="password-field">
                    <input
                      required
                      minLength={8}
                      type={show ? "text" : "password"}
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(e) => {
                        setForm({ ...form, password: e.target.value });
                      }}
                    />
                    <button
                      type="button"
                      aria-label={show ? "Hide password" : "Show password"}
                      onClick={() => {
                        setShow(!show);
                      }}
                    >
                      {show ? <EyeOff /> : <Eye />}
                    </button>
                  </span>
                </label>
                <label>
                  Confirm new password
                  <input
                    required
                    minLength={8}
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    value={form.confirm}
                    onChange={(e) => {
                      setForm({ ...form, confirm: e.target.value });
                    }}
                  />
                </label>
                <Button disabled={busy}>
                  {busy ? "Please wait…" : "Update password"}
                </Button>
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
