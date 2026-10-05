import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { authClient } from "../lib/auth";
import { ApiError, api } from "../lib/api";
import { useSoulAuth } from "../components/auth-context";
import { Button, Notice } from "../components/ui";

const PENDING_VERIFICATION_EMAIL = "soulseer.pendingVerificationEmail";
// Kept until the profile is created so a Reader who leaves mid-signup (or is
// sent back to /login without the link's query string) still becomes a Reader.
const PENDING_READER_INVITE = "soulseer.pendingReaderInvite";

function storedReaderInvite() {
  try {
    return localStorage.getItem(PENDING_READER_INVITE) ?? "";
  } catch {
    return "";
  }
}

function storeReaderInvite(token: string | null) {
  try {
    if (token) localStorage.setItem(PENDING_READER_INVITE, token);
    else localStorage.removeItem(PENDING_READER_INVITE);
  } catch {
    // Storage can be unavailable (private mode); the URL still carries the invite.
  }
}

export function LoginPage() {
  const [params] = useSearchParams();
  const linkInvite = params.get("readerInvite") || params.get("invite") || "";
  const readerInvite = linkInvite || storedReaderInvite();
  const auth = useSoulAuth();
  const navigate = useNavigate();
  const pendingVerificationEmail =
    sessionStorage.getItem(PENDING_VERIFICATION_EMAIL) ?? "";
  const [mode, setMode] = useState<
    "signin" | "signup" | "verify" | "forgot" | "profile"
  >(
    pendingVerificationEmail
      ? "verify"
      : linkInvite
        ? "signup"
        : params.get("forgot")
          ? "forgot"
          : "signin",
  );
  const [form, setForm] = useState({
    email: pendingVerificationEmail,
    password: "",
    name: "",
    username: "",
    otp: "",
    invite: readerInvite,
  });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(
    params.get("reset") === "success"
      ? { tone: "success", text: "Password updated. Sign in with your new password." }
      : null,
  );
  const returnTo = params.get("returnTo") || "/dashboard";
  useEffect(() => {
    if (linkInvite) storeReaderInvite(linkInvite);
  }, [linkInvite]);
  useEffect(() => {
    if (!auth.needsProfile || mode === "verify") return;
    setMode("profile");
    setForm((current) => ({
      ...current,
      name: current.name || auth.sessionUser?.name || "",
    }));
  }, [auth.needsProfile, auth.sessionUser?.name, mode]);
  if (auth.me && mode !== "verify")
    return <Navigate to={returnTo} replace />;
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
        if (!result.data.user.emailVerified) {
          const verification = await authClient.emailOtp.sendVerificationOtp({
            email: form.email,
            type: "email-verification",
          });
          if (verification.error)
            throw new Error(verification.error.message);
          sessionStorage.setItem(PENDING_VERIFICATION_EMAIL, form.email);
          setMode("verify");
          setMessage({
            tone: "success",
            text: "Verify your email with the code we just sent.",
          });
          return;
        }
        await auth.refresh();
        navigate(returnTo);
      } else if (mode === "signup") {
        const result = await authClient.signUp.email({
          email: form.email,
          password: form.password,
          name: form.name,
          callbackURL: `${window.location.origin}/login?${new URLSearchParams({
            returnTo,
            ...(form.invite ? { readerInvite: form.invite } : {}),
          }).toString()}`,
        });
        if (result.error) throw new Error(result.error.message);
        if (!result.data.user.emailVerified) {
          const verification = await authClient.emailOtp.sendVerificationOtp({
            email: form.email,
            type: "email-verification",
          });
          if (verification.error)
            throw new Error(verification.error.message);
          sessionStorage.setItem(PENDING_VERIFICATION_EMAIL, form.email);
          setMode("verify");
          setMessage({
            tone: "success",
            text: "We sent a verification code to your email.",
          });
        } else {
          setMode("profile");
        }
      } else if (mode === "verify") {
        const result = await authClient.emailOtp.verifyEmail({
          email: form.email,
          otp: form.otp,
        });
        if (result.error) throw new Error(result.error.message);
        if (!result.data.user.emailVerified)
          throw new Error("Email verification did not complete.");
        sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL);
        await auth.refresh();
        setMode("profile");
        setMessage({
          tone: "success",
          text: "Email verified. Choose your community username.",
        });
      } else if (mode === "forgot") {
        const result = await authClient.requestPasswordReset({
          email: form.email,
          redirectTo: `${window.location.origin}/reset-password`,
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
        storeReaderInvite(null);
        await auth.refresh();
        navigate(returnTo);
      }
    } catch (cause) {
      // An expired or mismatched invitation can never succeed, so stop
      // sending it; the next submit creates an ordinary client profile.
      const deadInvite =
        cause instanceof ApiError && cause.code === "INVALID_READER_INVITE";
      if (deadInvite) {
        storeReaderInvite(null);
        setForm((current) => ({ ...current, invite: "" }));
      }
      setMessage({
        tone: "error",
        text: deadInvite
          ? "This Reader invitation is invalid, expired, or was sent to a different email. Ask SoulSeer for a new invitation, or submit again to join as a client."
          : cause instanceof Error
            ? cause.message
            : "We couldn’t complete that request.",
      });
    } finally {
      setBusy(false);
    }
  }
  async function resendVerification() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: form.email,
        type: "email-verification",
      });
      if (result.error) throw new Error(result.error.message);
      setMessage({
        tone: "success",
        text: "A new verification code is on its way.",
      });
    } catch (cause) {
      setMessage({
        tone: "error",
        text:
          cause instanceof Error
            ? cause.message
            : "We couldn’t resend the verification code.",
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
                ? form.invite
                  ? "Create your reader account"
                  : "Join the soul tribe"
                : mode === "verify"
                  ? "Verify your email"
                  : mode === "forgot"
                    ? "Reset your password"
                    : "Complete your profile"}
          </h2>
          <p className="muted">
            {mode === "verify"
              ? `Enter the code sent to ${form.email}.`
              : mode === "profile"
                ? "Choose how you’ll appear in the SoulSeer community."
                : form.invite
                  ? "Use the email address your reader invitation was sent to."
                  : "Your account is securely managed by Neon Auth."}
          </p>
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
          {(mode === "signin" || mode === "signup") && (
            <button
              className="google-button"
              onClick={() =>
                void authClient.signIn.social({
                  provider: "google",
                  callbackURL: `${window.location.origin}/login?${new URLSearchParams({
                    returnTo,
                    ...(form.invite ? { readerInvite: form.invite } : {}),
                  }).toString()}`,
                })
              }
            >
              <span>G</span> Continue with Google
            </button>
          )}
          {(mode === "signin" || mode === "signup") && (
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
            {mode !== "profile" && mode !== "verify" && (
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
            {(mode === "signin" || mode === "signup") && (
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
            {mode === "verify" && (
              <label>
                Verification code
                <input
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  minLength={6}
                  maxLength={6}
                  pattern="[0-9]{6}"
                  value={form.otp}
                  onChange={(e) => setForm({ ...form, otp: e.target.value })}
                />
              </label>
            )}
            <Button disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : mode === "verify"
                      ? "Verify email"
                      : mode === "forgot"
                        ? "Send reset link"
                        : "Enter SoulSeer"}
            </Button>
          </form>
          {mode === "verify" && (
            <button
              type="button"
              className="plain-link"
              disabled={busy}
              onClick={() => {
                void resendVerification();
              }}
            >
              Resend verification code
            </button>
          )}
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
          {(mode === "signup" || mode === "verify" || mode === "forgot") && (
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
