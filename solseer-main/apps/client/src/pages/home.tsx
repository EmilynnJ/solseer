import { useState, type SyntheticEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Globe2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { BRAND } from "@soulseer/shared";
import type { Reader } from "../types";
import { api } from "../lib/api";
import { useApiData } from "../hooks/use-api";
import { ReaderCard } from "../components/reader-card";
import { Button, Empty, Loading } from "../components/ui";

export function HomePage() {
  const readers = useApiData(
    () => api<{ readers: Reader[] }>("/readers/online", {}, false),
    [],
  );
  const [newsletter, setNewsletter] = useState({
    email: "",
    state: "idle" as "idle" | "sending" | "done" | "error",
  });
  async function subscribe(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setNewsletter((value) => ({ ...value, state: "sending" }));
    try {
      await api(
        "/newsletter",
        {
          method: "POST",
          body: JSON.stringify({ email: newsletter.email, consent: true }),
        },
        false,
      );
      setNewsletter((value) => ({ ...value, state: "done" }));
    } catch {
      setNewsletter((value) => ({ ...value, state: "error" }));
    }
  }
  return (
    <>
      <section className="hero">
        <div className="hero-atmosphere" aria-hidden="true" />
        <div className="hero-shade" aria-hidden="true" />
        <div className="hero-inner">
          <div className="hero-copy reveal">
            <p className="eyebrow">Welcome to your soul tribe</p>
            <h1>
              Guidance that meets you <em>heart to heart.</em>
            </h1>
            <p>{BRAND.tagline}</p>
            <div className="hero-actions">
              <Link className="button" to="/readers">
                Find your Reader <ArrowRight />
              </Link>
              <Link className="text-link" to="/about">
                Our promise
              </Link>
            </div>
          </div>
          <figure className="hero-art reveal">
            <span className="hero-orbit" aria-hidden="true" />
            <img
              src={BRAND.heroImage}
              alt="SoulSeer — A Community of Gifted Psychics"
              width="610"
              height="622"
              fetchPriority="high"
              decoding="async"
            />
            <figcaption>
              Ethical guidance <span aria-hidden="true">✦</span> Private connection
            </figcaption>
          </figure>
        </div>
        <div className="trust-note">
          <ShieldCheck /> Ethical readers · Secure private sessions
        </div>
      </section>
      <section className="section readers-feature">
        <div className="section-head">
          <div>
            <p className="eyebrow">The light is on</p>
            <h2>Readers available now</h2>
          </div>
          <Link className="text-link" to="/readers">
            Browse everyone <ArrowRight />
          </Link>
        </div>
        {readers.loading ? (
          <Loading label="Finding available Readers…" />
        ) : readers.error ? (
          <Empty icon={<Sparkles />} title="The Reader circle is reconnecting">
            Browse every verified Reader while live availability comes back.
          </Empty>
        ) : readers.data?.readers.length ? (
          <div className="reader-grid">
            {readers.data.readers.map((reader) => (
              <ReaderCard key={reader.id} reader={reader} />
            ))}
          </div>
        ) : (
          <Empty icon={<Sparkles />} title="Your Readers will be back soon">
            Browse every verified Reader and discover who resonates with you.
          </Empty>
        )}
      </section>
      <section className="community-ribbon section">
        <div>
          <p className="eyebrow">More than an app</p>
          <h2>Come sit with the SoulSeer community.</h2>
          <p>
            Share, listen, learn, and find belonging with spiritually curious
            people and gifted Readers.
          </p>
        </div>
        <div className="community-actions">
          <a
            className="button gold"
            href={
              import.meta.env.VITE_FACEBOOK_GROUP_URL || "https://www.facebook.com"
            }
            target="_blank"
            rel="noreferrer"
          >
            <Globe2 /> Facebook group
          </a>
          <a
            className="button secondary"
            href={import.meta.env.VITE_DISCORD_INVITE_URL || "https://discord.com"}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle /> Discord server
          </a>
        </div>
      </section>
      <section className="newsletter section">
        <div>
          <p className="eyebrow">A little light in your inbox</p>
          <h2>Stay close to the circle.</h2>
          <p>
            Receive thoughtful SoulSeer news and community updates. No clutter,
            ever.
          </p>
        </div>
        <form
          onSubmit={(event) => {
            void subscribe(event);
          }}
        >
          <label className="sr-only" htmlFor="newsletter-email">
            Email address
          </label>
          <input
            id="newsletter-email"
            required
            type="email"
            placeholder="you@example.com"
            value={newsletter.email}
            onChange={(event) => {
              setNewsletter({ email: event.target.value, state: "idle" });
            }}
          />
          <Button disabled={newsletter.state === "sending"}>
            {newsletter.state === "sending" ? "Joining…" : "Join the circle"}
          </Button>
          {newsletter.state === "done" && (
            <span className="form-success">You’re in. Welcome.</span>
          )}
          {newsletter.state === "error" && (
            <span className="form-error">We couldn’t save that just yet.</span>
          )}
        </form>
      </section>
    </>
  );
}
