import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { Reader } from "../types";
import { api } from "../lib/api";
import { useApiData } from "../hooks/use-api";
import { ReaderCard } from "../components/reader-card";
import { Empty, Loading, Notice, PageIntro } from "../components/ui";

export function ReadersPage() {
  const readers = useApiData(
    () => api<{ readers: Reader[] }>("/readers", {}, false),
    [],
  );
  const [online, setOnline] = useState(false);
  const [type, setType] = useState("all");
  const [specialty, setSpecialty] = useState("all");
  const [maxPrice, setMaxPrice] = useState(10000);
  const specialties = useMemo(
    () =>
      [
        ...new Set(readers.data?.readers.flatMap((r) => r.specialties) ?? []),
      ].sort(),
    [readers.data],
  );
  const filtered = useMemo(
    () =>
      readers.data?.readers.filter((reader) => {
        // Performance optimization: evaluate cheap boolean and string checks first
        // to short-circuit before executing price comparison logic.
        if (online && !reader.isOnline) return false;
        if (specialty !== "all" && !reader.specialties.includes(specialty))
          return false;

        const price =
          type === "chat"
            ? reader.pricingChat
            : type === "voice"
              ? reader.pricingVoice
              : type === "video"
                ? reader.pricingVideo
                : Math.min(
                    reader.pricingChat,
                    reader.pricingVoice,
                    reader.pricingVideo,
                  );
        return price <= maxPrice;
      }) ?? [],
    [maxPrice, online, readers.data, specialty, type],
  );
  return (
    <div className="page-shell">
      <PageIntro
        eyebrow="Meet the circle"
        title="Find the Reader who feels right."
      >
        <p>
          Every SoulSeer Reader is personally approved, fairly supported, and
          here to offer compassionate guidance without judgment.
        </p>
      </PageIntro>
      <section className="filters" aria-label="Reader filters">
        <span>
          <SlidersHorizontal /> Refine
        </span>
        <label>
          Specialty
          <select
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
          >
            <option value="all">All specialties</option>
            {specialties.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Reading type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">Any type</option>
            <option value="chat">Chat</option>
            <option value="voice">Voice</option>
            <option value="video">Video</option>
          </select>
        </label>
        <label>
          Maximum rate
          <select
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
          >
            <option value="500">$5 / min</option>
            <option value="1000">$10 / min</option>
            <option value="2500">$25 / min</option>
            <option value="10000">Any rate</option>
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={online}
            onChange={(e) => setOnline(e.target.checked)}
          />{" "}
          Available now
        </label>
      </section>
      {readers.loading ? (
        <Loading />
      ) : readers.error ? (
        <Notice tone="error">{readers.error}</Notice>
      ) : filtered.length ? (
        <div className="reader-grid">
          {filtered.map((reader) => (
            <ReaderCard key={reader.id} reader={reader} />
          ))}
        </div>
      ) : (
        <Empty title="No Readers match those filters">
          Widen your preferences to meet more of the SoulSeer circle.
        </Empty>
      )}
    </div>
  );
}
