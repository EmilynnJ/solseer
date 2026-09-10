import { memo } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Mic, Video } from "lucide-react";
import type { Reader } from "../types";
import { API_ORIGIN, money } from "../lib/api";
import { Stars } from "./ui";

/**
 * ReaderCard is memoized with React.memo to prevent unnecessary re-renders when parent
 * components (like ReadersPage filter controls) update state without changing this reader's props.
 * Image loading uses loading="lazy" and decoding="async" to defer fetching off-screen avatars
 * and prevent image decoding from blocking the main thread during scrolling.
 */
export const ReaderCard = memo(function ReaderCard({ reader }: { reader: Reader }) {
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
          <span>
            <MessageCircle /> {money(reader.pricingChat)}
          </span>
          <span>
            <Mic /> {money(reader.pricingVoice)}
          </span>
          <span>
            <Video /> {money(reader.pricingVideo)}
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
