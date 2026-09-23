import { memo } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Mic, Video } from "lucide-react";
import type { Reader } from "../types";
import { API_ORIGIN, money } from "../lib/api";
import { Stars } from "./ui";

// ⚡ Bolt: Memoize ReaderCard with React.memo to prevent unnecessary re-renders
// when filtering reader lists or re-rendering parent components. Profile images
// use loading="lazy" and decoding="async" to defer downloading off-screen assets.
export const ReaderCard = memo(function ReaderCard({
  reader,
}: {
  reader: Reader;
}) {
  return (
    <article className="reader-card reveal">
      <Link to={`/readers/${reader.id}`} className="reader-portrait-wrap">
        {reader.profileImageKey ? (
          <img
            className="reader-portrait"
            src={`${API_ORIGIN}/api/readers/${reader.id}/image`}
            alt={`${reader.fullName}, SoulSeer Reader`}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="reader-portrait fallback" aria-hidden="true">
            {reader.fullName.slice(0, 1)}
          </div>
        )}
        <span className={`presence ${reader.isOnline ? "online" : "offline"}`}>
          {reader.isOnline ? "Available now" : "Offline"}
        </span>
      </Link>
      <div className="reader-copy">
        <p className="eyebrow">{reader.specialties.slice(0, 2).join(" · ")}</p>
        <h3>
          <Link to={`/readers/${reader.id}`}>{reader.fullName}</Link>
        </h3>
        <Stars value={Number(reader.rating)} count={reader.reviewCount} />
        <p className="reader-bio">{reader.bio}</p>
        <div className="rate-row">
          <span
            aria-label={`Chat rate: ${money(reader.pricingChat)} per minute`}
          >
            <MessageCircle aria-hidden="true" /> {money(reader.pricingChat)}
          </span>
          <span
            aria-label={`Voice rate: ${money(reader.pricingVoice)} per minute`}
          >
            <Mic aria-hidden="true" /> {money(reader.pricingVoice)}
          </span>
          <span
            aria-label={`Video rate: ${money(reader.pricingVideo)} per minute`}
          >
            <Video aria-hidden="true" /> {money(reader.pricingVideo)}
          </span>
        </div>
        <Link
          className={`button full ${reader.isOnline ? "" : "secondary"}`}
          to={`/readers/${reader.id}`}
        >
          {reader.isOnline ? "Start a reading" : "View profile"}
        </Link>
      </div>
    </article>
  );
});
