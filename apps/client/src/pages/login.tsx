import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { authClient } from "../lib/auth";
import { api } from "../lib/api";
import { useSoulAuth } from "../components/auth-context";
import { Button, Notice } from "../components/ui";

export function LoginPage() {
  const [params] = useSearchParams();
  const auth = useSoulAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "profile">(
    params.get("complete") ? "profile" : "signin",
  );
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    username: "",
    invite: params.get("readerInvite") ?? params.get("invite") ?? "",
  });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);
  const returnTo = params.get("returnTo") || "/dashboard";
  useEffect(() => {
    if (auth.needsProfile) setMode("profile");
  }, [auth.needsProfile]);
  if (auth.me && mode !== "profile") return <Navigate to={returnTo} replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "signin") {
        const result = await authClient.signIn.email({
          email: form.email,
          password: form.password,
          callbackURL: returnTo,
        });
        if (result.error) throw new Error(result.error.message);
        await auth.refresh();
        navigate(returnTo);
      } else if (mode === "signup") {
        const result = await authClient.signUp.email({
          email: form.email,
          password: form.password,
          name: form.name,
          callbackURL: "/login?complete=1",
        });
        if (result.error) throw new Error(result.error.message);
        setMode("profile");
      } else if (mode === "forgot") {
        const result = await authClient.requestPasswordReset({
          email: form.email,
          redirectTo: `${window.location.origin}/login`,
        });
        if (result.error) throw new Error(result.error.message);
        setMessage({
          tone: "success",
          text: "If that address is registered, a reset link is on its way.",
        });
      } else {
        await api("/auth/bootstrap", {
          method: "POST",
          body: JSON.stringify({
            username: form.username,
            fullName: form.name || auth.sessionUser?.name,
            ...(form.invite ? { readerInviteToken: form.invite } : {}),
          }),
        });
        await auth.refresh();
        navigate(returnTo);
      }
    } catch (cause) {
      setMessage({
        tone: "error",
        text:
          cause instanceof Error
            ? cause.message
            : "We couldn’t complete that request.",
      });
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
            Come as you are.
            <br />
            <em>Leave with clarity.</em>
          </h1>
          <p>
            Secure, compassionate readings with people who honor your story.
          </p>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-box">
          <p className="wordmark">
            SoulSeer<span>✦</span>
          </p>
          <h2>
            {mode === "signin"
              ? "Welcome back"
              : mode === "signup"
                ? "Join the soul tribe"
                : mode === "forgot"
                  ? "Reset your password"
                  : "Complete your profile"}
          </h2>
          <p className="muted">
            {mode === "profile"
              ? "Choose how you’ll appear in the SoulSeer community."
              : "Your account is securely managed by Neon Auth."}
          </p>
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
          {mode !== "profile" && mode !== "forgot" && (
            <button
              className="google-button"
              onClick={() =>
                void authClient.signIn.social({
                  provider: "google",
                  callbackURL: `${window.location.origin}/login?complete=1`,
                })
              }
            >
              <span>G</span> Continue with Google
            </button>
          )}
          {mode !== "profile" && mode !== "forgot" && (
            <div className="divider">
              <span>or use email</span>
            </div>
          )}
          <form className="stack-form" onSubmit={submit}>
            {(mode === "signup" || mode === "profile") && (
              <label>
                Full name
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
            )}
            {mode === "profile" && (
              <label>
                Community username
                <input
                  required
                  minLength={3}
                  maxLength={40}
                  pattern="[A-Za-z0-9_.-]+"
                  autoComplete="username"
                  value={form.username}
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value })
                  }
                />
              </label>
            )}
            {mode !== "profile" && (
              <label>
                Email address
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
            )}
            {mode !== "forgot" && mode !== "profile" && (
              <label>
                Password
                <span className="password-field">
                  <input
                    required
                    minLength={8}
                    type={show ? "text" : "password"}
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    aria-label={show ? "Hide password" : "Show password"}
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff /> : <Eye />}
                  </button>
                </span>
              </label>
            )}
            <Button disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : mode === "forgot"
                      ? "Send reset link"
                      : "Enter SoulSeer"}
            </Button>
          </form>
          {mode === "signin" && (
            <>
              <button className="plain-link" onClick={() => setMode("forgot")}>
                Forgot password?
              </button>
              <p className="switch-auth">
                New here?{" "}
                <button onClick={() => setMode("signup")}>
                  Create an account
                </button>
              </p>
            </>
          )}
          {(mode === "signup" || mode === "forgot") && (
            <p className="switch-auth">
              Already belong?{" "}
              <button onClick={() => setMode("signin")}>Sign in</button>
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
