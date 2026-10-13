import { useEffect, useState, type SyntheticEvent } from "react";
import { API_ORIGIN, api, dateTime, duration, money } from "../lib/api";
import { ReaderImageUpload } from "./reader-image-upload";
import { transcriptLine } from "../lib/transcript";
import { Button, Empty, Loading, Modal, Notice } from "./ui";

export type AdminReaderProfile = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  status: string;
  bio: string;
  specialties: string[];
  pricingChat: number;
  pricingVoice: number;
  pricingVideo: number;
  verificationStatus: string;
  hasImage: boolean;
};

const VERIFICATION_STATUSES = ["invited", "pending", "verified", "rejected"];

export function AdminReaderProfiles({
  readers,
  onSaved,
}: {
  readers: AdminReaderProfile[];
  onSaved: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<AdminReaderProfile | null>(null);
  if (!readers.length)
    return (
      <Empty title="No Readers yet">
        Readers appear here once they accept their invitation.
      </Empty>
    );
  return (
    <>
      <div className="request-list">
        {readers.map((reader) => (
          <article key={reader.id}>
            <div>
              <strong>{reader.fullName}</strong>
              <small>
                @{reader.username} · {reader.email} ·{" "}
                {reader.verificationStatus} · {reader.status}
              </small>
              <small>
                {reader.specialties.length
                  ? reader.specialties.join(", ")
                  : "No specialties yet"}
              </small>
            </div>
            <div className="row-actions">
              <Button
                className="secondary"
                onClick={() => {
                  setEditing(reader);
                }}
              >
                Edit profile
              </Button>
            </div>
          </article>
        ))}
      </div>
      {editing && (
        <ReaderEditor
          reader={editing}
          onClose={() => {
            setEditing(null);
          }}
          onSaved={async () => {
            setEditing(null);
            await onSaved();
          }}
        />
      )}
    </>
  );
}

function ReaderEditor({
  reader,
  onClose,
  onSaved,
}: {
  reader: AdminReaderProfile;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    fullName: reader.fullName,
    bio: reader.bio,
    specialties: reader.specialties.join(", "),
    chat: reader.pricingChat / 100,
    voice: reader.pricingVoice / 100,
    video: reader.pricingVideo / 100,
    verificationStatus: reader.verificationStatus,
    status: reader.status,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoVersion, setPhotoVersion] = useState<number | null>(null);
  const hasPhoto = reader.hasImage || photoVersion !== null;
  // The public image route only serves verified, active Readers.
  const canPreview =
    hasPhoto && reader.verificationStatus === "verified" && reader.status === "active";

  async function save(event: SyntheticEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/admin/readers/${reader.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: form.fullName,
          bio: form.bio,
          specialties: form.specialties
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          pricingChat: Math.round(form.chat * 100),
          pricingVoice: Math.round(form.voice * 100),
          pricingVideo: Math.round(form.video * 100),
          verificationStatus: form.verificationStatus,
        }),
      });
      // Suspension goes through the status endpoint, which also takes the
      // Reader offline and records the change in the audit log.
      if (form.status !== reader.status) {
        await api(`/admin/users/${reader.id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: form.status }),
        });
      }
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Edit ${reader.fullName}`} onClose={onClose}>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="reader-photo">
        {canPreview ? (
          <img
            src={`${API_ORIGIN}/api/readers/${reader.id}/image${
              photoVersion ? `?v=${String(photoVersion)}` : ""
            }`}
            alt={`${reader.fullName} profile`}
          />
        ) : (
          <span className="muted">
            {hasPhoto
              ? "Photo uploaded (preview shows once the Reader is verified and active)."
              : "No profile photo yet."}
          </span>
        )}
        <ReaderImageUpload
          readerId={reader.id}
          onDone={() => {
            setPhotoVersion(Date.now());
          }}
        />
      </div>
      <form
        className="admin-form"
        onSubmit={(event) => {
          void save(event);
        }}
      >
        <label>
          Full name
          <input
            required
            minLength={2}
            maxLength={100}
            value={form.fullName}
            onChange={(e) => {
              setForm({ ...form, fullName: e.target.value });
            }}
          />
        </label>
        <label>
          Specialties (comma separated)
          <input
            value={form.specialties}
            onChange={(e) => {
              setForm({ ...form, specialties: e.target.value });
            }}
          />
        </label>
        <label className="wide">
          Bio
          <textarea
            rows={5}
            maxLength={4000}
            value={form.bio}
            onChange={(e) => {
              setForm({ ...form, bio: e.target.value });
            }}
          />
        </label>
        {(["chat", "voice", "video"] as const).map((key) => (
          <label key={key}>
            {key} $/min
            <input
              required
              type="number"
              min="1"
              step="0.01"
              value={form[key]}
              onChange={(e) => {
                setForm({ ...form, [key]: Number(e.target.value) });
              }}
            />
          </label>
        ))}
        <label>
          Approval
          <select
            value={form.verificationStatus}
            onChange={(e) => {
              setForm({ ...form, verificationStatus: e.target.value });
            }}
          >
            {VERIFICATION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          Account
          <select
            value={form.status}
            onChange={(e) => {
              setForm({ ...form, status: e.target.value });
            }}
          >
            <option value="active">active</option>
            <option value="suspended">suspended</option>
          </select>
        </label>
        <Button disabled={busy}>{busy ? "Saving…" : "Save profile"}</Button>
      </form>
    </Modal>
  );
}

type Party = {
  id: string | null;
  fullName: string | null;
  username: string | null;
  email: string | null;
};

type ReadingRecord = {
  reading: {
    id: string;
    type: string;
    status: string;
    pricePerMinute: number;
    createdAt: string;
    startedAt: string | null;
    completedAt: string | null;
    durationSeconds: number;
    totalPrice: number;
    paymentStatus: string;
    failureReason: string | null;
    endedById: string | null;
    chatTranscript: unknown[] | null;
    client: Party;
    reader: Party;
  };
  events: { id: string; eventType: string; occurredAt: string }[];
  ledger: {
    id: string;
    userId: string;
    type: string;
    amount: number;
    reason: string | null;
    createdAt: string;
  }[];
};

const partyLabel = (party: Party) =>
  party.fullName
    ? `${party.fullName} (@${party.username ?? "?"}, ${party.email ?? "no email"})`
    : "Deleted account";

export function ReadingRecordModal({
  readingId,
  onClose,
}: {
  readingId: string;
  onClose: () => void;
}) {
  const [record, setRecord] = useState<ReadingRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<ReadingRecord>(`/admin/readings/${readingId}`)
      .then(setRecord)
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error ? cause.message : "Could not load reading.",
        );
      });
  }, [readingId]);

  return (
    <Modal title="Reading record" onClose={onClose}>
      {error && <Notice tone="error">{error}</Notice>}
      {!record && !error && <Loading label="Loading reading record…" />}
      {record && <ReadingRecordBody record={record} />}
    </Modal>
  );
}

function ReadingRecordBody({ record }: { record: ReadingRecord }) {
  const { reading, events, ledger } = record;
  const nameFor = (userId: string | null) =>
    userId === reading.client.id
      ? reading.client.fullName
      : userId === reading.reader.id
        ? reading.reader.fullName
        : userId
          ? "Admin/other"
          : "System";
  const transcript = reading.chatTranscript ?? [];
  return (
    <div className="reading-record">
      <dl>
        <dt>Reading ID</dt>
        <dd>{reading.id}</dd>
        <dt>Client</dt>
        <dd>{partyLabel(reading.client)}</dd>
        <dt>Reader</dt>
        <dd>{partyLabel(reading.reader)}</dd>
        <dt>Type</dt>
        <dd>
          {reading.type} at {money(reading.pricePerMinute)}/min
        </dd>
        <dt>Status</dt>
        <dd>
          {reading.status} · payment {reading.paymentStatus}
          {reading.failureReason ? ` · ${reading.failureReason}` : ""}
        </dd>
        <dt>Requested</dt>
        <dd>{dateTime(reading.createdAt)}</dd>
        <dt>Started</dt>
        <dd>{reading.startedAt ? dateTime(reading.startedAt) : "Never started"}</dd>
        <dt>Ended</dt>
        <dd>
          {reading.completedAt ? dateTime(reading.completedAt) : "—"}
          {reading.completedAt ? ` (ended by ${nameFor(reading.endedById) ?? "Unknown"})` : ""}
        </dd>
        <dt>Billed</dt>
        <dd>
          {duration(reading.durationSeconds)} · {money(reading.totalPrice)}
        </dd>
      </dl>

      <h3>Chat transcript</h3>
      {transcript.length ? (
        <ol className="transcript">
          {transcript.map((entry, index) => {
            const line = transcriptLine(entry);
            return (
              <li key={index}>
                <strong>{line.who ?? "Unknown"}</strong>
                {line.when && <small> · {dateTime(line.when)}</small>}
                <p>{line.text}</p>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="muted">
          No chat transcript was saved for this reading. Voice and video audio
          is not recorded.
        </p>
      )}

      <h3>Session events</h3>
      {events.length ? (
        <ol className="transcript">
          {events.map((event) => (
            <li key={event.id}>
              <strong>{event.eventType}</strong>
              <small> · {dateTime(event.occurredAt)}</small>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">No provider events were recorded.</p>
      )}

      <h3>Money movements</h3>
      {ledger.length ? (
        <ol className="transcript">
          {ledger.map((entry) => (
            <li key={entry.id}>
              <strong>
                {entry.type} {money(entry.amount)}
              </strong>
              <small>
                {" "}
                · {nameFor(entry.userId)} · {dateTime(entry.createdAt)}
              </small>
              {entry.reason && <p>{entry.reason}</p>}
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">No charges were recorded for this reading.</p>
      )}
    </div>
  );
}
