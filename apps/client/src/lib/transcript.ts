const pick = (entry: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = entry[key];
    if (typeof value === "string" || typeof value === "number")
      return String(value);
  }
  return null;
};

const toIsoTime = (value: string | null) => {
  if (!value) return null;
  const date = new Date(/^\d+$/.test(value) ? Number(value) : value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

// RealtimeKit's chat export is stored as-is, so read the common field names
// and fall back to the raw entry rather than hiding anything.
export function transcriptLine(entry: unknown) {
  if (typeof entry !== "object" || entry === null)
    return { who: null, when: null, text: String(entry) };
  const record = entry as Record<string, unknown>;
  const text = pick(record, ["message", "text", "payload", "content", "body"]);
  return {
    who: pick(record, [
      "displayName",
      "userDisplayName",
      "senderName",
      "userName",
      "name",
    ]),
    when: toIsoTime(pick(record, ["createdAt", "timestamp", "time", "sentAt"])),
    text: text ?? JSON.stringify(entry),
  };
}
