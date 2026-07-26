import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Clock3,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Star,
} from "lucide-react";
import {
  RealtimeKitProvider,
  useRealtimeKitClient,
} from "@cloudflare/realtimekit-react";
import { RtkMeeting } from "@cloudflare/realtimekit-react-ui";
import type { Reading } from "../types";
import { api, duration, money } from "../lib/api";
import { useApiData } from "../hooks/use-api";
import { Button, Loading, Notice } from "../components/ui";

type ReadingDetail = {
  reading: Reading & {
    createdAt?: string;
    nextBillAt?: string | null;
    failureReason?: string | null;
  };
  events: { eventType: string; occurredAt: string }[];
  balance: number;
};

export function ReadingPage() {
  const { id = "" } = useParams();
  const detail = useApiData(() => api<ReadingDetail>(`/readings/${id}`), [id]);
  const [token, setToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => void detail.refresh(), 5000);
    return () => clearInterval(timer);
  }, [detail.refresh]);
  useEffect(() => {
    const status = detail.data?.reading.status;
    if (!token && status && ["connecting", "active"].includes(status)) {
      api<{ participantToken: string }>(`/readings/${id}/participant-token`, {
        method: "POST",
      })
        .then((r) => setToken(r.participantToken))
        .catch((e) =>
          setTokenError(
            e instanceof Error ? e.message : "Unable to enter the room.",
          ),
        );
    }
  }, [detail.data?.reading.status, id, token]);
  if (detail.loading && !detail.data)
    return (
      <div className="reading-shell">
        <Loading label="Preparing your private room…" />
      </div>
    );
  if (detail.error || !detail.data)
    return (
      <div className="reading-shell">
        <Notice tone="error">{detail.error ?? "Reading not found."}</Notice>
        <Link to="/dashboard">Return to dashboard</Link>
      </div>
    );
  const reading = detail.data.reading;
  if (reading.status === "ended")
    return (
      <SessionSummary
        detail={detail.data}
        onRated={() => void detail.refresh()}
      />
    );
  if (["failed", "cancelled"].includes(reading.status))
    return (
      <div className="reading-shell centered">
        <AlertTriangle />
        <h1>This reading couldn’t begin.</h1>
        <p>
          {reading.failureReason ??
            "No funds were charged. You can choose another Reader whenever you’re ready."}
        </p>
        <Link className="button" to="/readers">
          Browse Readers
        </Link>
      </div>
    );
  if (!token)
    return (
      <WaitingRoom
        detail={detail.data}
        error={tokenError}
        onRetry={() => setToken(null)}
      />
    );
  return (
    <LiveRoom token={token} detail={detail.data} refresh={detail.refresh} />
  );
}

function WaitingRoom({
  detail,
  error,
  onRetry,
}: {
  detail: ReadingDetail;
  error: string | null;
  onRetry: () => void;
}) {
  const navigate = useNavigate();
  async function end() {
    if (!confirm("Cancel this reading request?")) return;
    try {
      await api(`/readings/${detail.reading.id}/end`, { method: "POST" });
    } finally {
      navigate("/dashboard");
    }
  }
  return (
    <div className="reading-shell waiting">
      <div className="ritual-loader">
        <span />
        <span />
        <span />
      </div>
      <p className="eyebrow">Private reading room</p>
      <h1>
        {detail.reading.status === "pending"
          ? "Waiting for your Reader…"
          : "Preparing your connection…"}
      </h1>
      <p>
        Your locked rate is{" "}
        <strong>{money(detail.reading.pricePerMinute)} per minute</strong>.
        Billing does not begin until both of you are securely present.
      </p>
      {error && (
        <Notice tone="error">
          {error}
          <Button className="secondary" onClick={onRetry}>
            <RefreshCw /> Retry
          </Button>
        </Notice>
      )}
      <div className="waiting-trust">
        <ShieldCheck /> End-to-end transport security · Server-authoritative
        billing
      </div>
      <Button className="secondary" onClick={() => void end()}>
        Cancel request
      </Button>
    </div>
  );
}

function LiveRoom({
  token,
  detail,
  refresh,
}: {
  token: string;
  detail: ReadingDetail;
  refresh: () => Promise<void>;
}) {
  const [meeting, initMeeting] = useRealtimeKitClient();
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    void initMeeting({
      authToken: token,
      defaults: {
        audio: detail.reading.type !== "chat",
        video: detail.reading.type === "video",
      },
    })
      .then((instance) => instance?.join())
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "Connection failed."),
      );
  }, [detail.reading.type, initMeeting, token]);
  useEffect(() => {
    const started = detail.reading.startedAt
      ? new Date(detail.reading.startedAt).getTime()
      : Date.now();
    const timer = window.setInterval(
      () => setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000))),
      1000,
    );
    return () => clearInterval(timer);
  }, [detail.reading.startedAt]);
  const estimated = useMemo(
    () => Math.ceil(elapsed / 60) * detail.reading.pricePerMinute,
    [detail.reading.pricePerMinute, elapsed],
  );
  const minutesLeft = Math.floor(
    detail.balance / detail.reading.pricePerMinute,
  );
  async function end() {
    if (
      !confirm(
        "End this reading for both participants? Final billing will be reconciled from secure session events.",
      )
    )
      return;
    await api(`/readings/${detail.reading.id}/end`, { method: "POST" });
    await meeting?.leave();
    await refresh();
  }
  return (
    <div className="live-room">
      <header className="session-bar">
        <Link
          to="/dashboard"
          aria-label="Emergency exit"
          title="Leave this screen; the reading remains protected"
        >
          <ArrowLeft /> Exit screen
        </Link>
        <div>
          <span className={`session-dot ${detail.reading.status}`} />
          <strong>
            {detail.reading.status === "active"
              ? "Reading in progress"
              : "Connecting securely"}
          </strong>
        </div>
        <div className="session-metrics">
          <span>
            <Clock3 /> {duration(elapsed)}
          </span>
          <span>Est. {money(estimated)}</span>
          <span>Balance {money(detail.balance)}</span>
        </div>
        <Button className="end-button" onClick={() => void end()}>
          <LogOut /> End session
        </Button>
      </header>
      {minutesLeft < 2 && (
        <div className="low-balance">
          <AlertTriangle /> Less than two minutes remain at the current rate.
          The session will end safely before your balance goes below zero.
        </div>
      )}
      {error && (
        <Notice tone="error">
          Connection issue: {error}. RealtimeKit will keep trying to reconnect.
        </Notice>
      )}
      <RealtimeKitProvider
        value={meeting}
        fallback={<Loading label="Connecting to RealtimeKit…" />}
      >
        {meeting && (
          <RtkMeeting
            meeting={meeting}
            showSetupScreen={false}
            leaveOnUnmount={false}
          />
        )}
      </RealtimeKitProvider>
    </div>
  );
}

function SessionSummary({
  detail,
  onRated,
}: {
  detail: ReadingDetail;
  onRated: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api(`/readings/${detail.reading.id}/rate`, {
        method: "POST",
        body: JSON.stringify({ rating, review: review || undefined }),
      });
      setMessage("Thank you. Your reflection has been shared.");
      onRated();
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "Unable to save your review.",
      );
    }
  }
  return (
    <div className="reading-summary">
      <div className="summary-glow">
        <p className="eyebrow">Reading complete</p>
        <h1>May the clarity stay with you.</h1>
        <p>Your final charges were reconciled from secure session events.</p>
        <div className="summary-metrics">
          <article>
            <span>Duration</span>
            <strong>{duration(detail.reading.durationSeconds)}</strong>
          </article>
          <article>
            <span>Final cost</span>
            <strong>{money(detail.reading.totalPrice)}</strong>
          </article>
          <article>
            <span>Remaining balance</span>
            <strong>{money(detail.balance)}</strong>
          </article>
        </div>
        {!detail.reading.rating ? (
          <form className="rating-form" onSubmit={submit}>
            <h2>How did this reading feel?</h2>
            <div className="rating-buttons" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  type="button"
                  aria-label={`${value} stars`}
                  className={value <= rating ? "active" : ""}
                  onClick={() => setRating(value)}
                  key={value}
                >
                  <Star fill="currentColor" />
                </button>
              ))}
            </div>
            <textarea
              maxLength={2000}
              placeholder="Share a reflection (optional)"
              value={review}
              onChange={(e) => setReview(e.target.value)}
            />
            {message && (
              <Notice tone={message.startsWith("Thank") ? "success" : "error"}>
                {message}
              </Notice>
            )}
            <Button disabled={!rating}>Share review</Button>
          </form>
        ) : (
          <Notice tone="success">
            Your review has been submitted. Thank you.
          </Notice>
        )}
        <Link className="text-link" to="/dashboard">
          Return to dashboard
        </Link>
      </div>
    </div>
  );
}
