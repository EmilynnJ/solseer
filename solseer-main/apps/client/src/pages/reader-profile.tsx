import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  MessageCircle,
  Mic,
  ShieldCheck,
  Video,
} from "lucide-react";
import type { Reader, Review } from "../types";
import { API_ORIGIN, api, dateTime, money } from "../lib/api";
import { useApiData } from "../hooks/use-api";
import { useSoulAuth } from "../components/auth-context";
import { posthog } from "../lib/posthog";
import { Button, Loading, Notice, Stars } from "../components/ui";

export function ReaderProfilePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const auth = useSoulAuth();
  const profile = useApiData(
    () =>
      api<{ reader: Reader; reviews: Review[] }>(`/readers/${id}`, {}, false),
    [id],
  );
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function start(type: "chat" | "voice" | "video") {
    if (!auth.sessionUser) {
      navigate(`/login?returnTo=${encodeURIComponent(`/readers/${id}`)}`);
      return;
    }
    if (auth.me?.user.role !== "client") {
      setError("Only Client accounts can request a reading.");
      return;
    }
    setStarting(type);
    setError(null);
    try {
      const result = await api<{ reading: { id: string } }>(
        "/readings/on-demand",
        { method: "POST", body: JSON.stringify({ readerId: id, type }) },
      );
      posthog.capture("reading_requested", { reading_type: type });
      navigate(`/reading/${result.reading.id}`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to start the reading.",
      );
    } finally {
      setStarting(null);
    }
  }
  if (profile.loading)
    return (
      <div className="page-shell">
        <Loading label="Opening Reader profile…" />
      </div>
    );
  if (profile.error || !profile.data)
    return (
      <div className="page-shell">
        <Notice tone="error">{profile.error ?? "Reader not found."}</Notice>
      </div>
    );
  const { reader, reviews } = profile.data;
  const offerings = [
    ["chat", MessageCircle, reader.pricingChat],
    ["voice", Mic, reader.pricingVoice],
    ["video", Video, reader.pricingVideo],
  ] as const;
  return (
    <div className="page-shell">
      <Link className="back-link" to="/readers">
        <ArrowLeft /> All Readers
      </Link>
      <section className="profile-hero">
        <div className="profile-image">
          {reader.profileImageKey ? (
            <img
              src={`${API_ORIGIN}/api/readers/${reader.id}/image`}
              alt={reader.fullName}
            />
          ) : (
            <span>{reader.fullName.slice(0, 1)}</span>
          )}
          <div className={`presence ${reader.isOnline ? "online" : "offline"}`}>
            {reader.isOnline ? "Available now" : "Currently offline"}
          </div>
        </div>
        <div>
          <p className="eyebrow">{reader.specialties.join(" · ")}</p>
          <h1>{reader.fullName}</h1>
          <Stars value={Number(reader.rating)} count={reader.reviewCount} />
          <p className="profile-bio">{reader.bio}</p>
          <p className="verified">
            <ShieldCheck /> Verified SoulSeer Reader
          </p>
          {auth.me?.user.role === "client" && (
            <Button
              className="secondary"
              onClick={() => navigate(`/messages?reader=${reader.id}`)}
            >
              <MessageCircle /> Message Reader
            </Button>
          )}
        </div>
      </section>
      <section className="offerings">
        <div className="section-head">
          <div>
            <p className="eyebrow">Choose your connection</p>
            <h2>Begin a reading</h2>
          </div>
          <p>Securely billed per completed minute. End anytime.</p>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="offering-grid">
          {offerings.map(([type, Icon, price]) => (
            <article key={type}>
              <Icon />
              <h3>{type}</h3>
              <strong>
                {money(price)} <small>/ minute</small>
              </strong>
              <Button
                disabled={!reader.isOnline || Boolean(starting)}
                onClick={() => void start(type)}
              >
                {starting === type
                  ? "Requesting…"
                  : reader.isOnline
                    ? `Start ${type}`
                    : "Unavailable"}
              </Button>
            </article>
          ))}
        </div>
      </section>
      <section className="reviews">
        <div className="section-head">
          <div>
            <p className="eyebrow">Shared with gratitude</p>
            <h2>Client reflections</h2>
          </div>
        </div>
        {reviews.length ? (
          <div className="review-grid">
            {reviews.map((review) => (
              <blockquote key={review.id}>
                <Stars value={review.rating} />
                <p>“{review.text || "A meaningful reading."}”</p>
                <footer>
                  — {review.clientName}, {dateTime(review.createdAt)}
                </footer>
              </blockquote>
            ))}
          </div>
        ) : (
          <p className="muted">
            This Reader’s first reflections will appear here.
          </p>
        )}
      </section>
    </div>
  );
}
