// RealtimeKit's chat export (meeting.chatSynced / Chat Replay API) is a CSV
// file served from AWS S3 with the columns: id, participantId, sessionId,
// meetingId, displayName, pinned, isEdited, payloadType, payload, createdAt.
// A JSON array is still accepted in case the export format changes.
export type ChatExportRow = Record<string, string>;

export function parseChatExport(text: string): unknown[] {
  const trimmed = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed: unknown = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  const [header, ...rows] = parseCsv(trimmed);
  if (!header) return [];
  return rows
    .filter((row) => row.some((cell) => cell !== ""))
    .map((row) =>
      Object.fromEntries(header.map((name, i) => [name.trim(), row[i] ?? ""])),
    );
}

// RFC 4180: quoted fields may contain commas, doubled quotes and newlines.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    if (quoted) {
      if (char === '"') {
        if (text.charAt(i + 1) === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text.charAt(i + 1) === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field);
  rows.push(row);
  return rows;
}

// Hosts the signed webhook may point us at: Cloudflare/RealtimeKit and the
// AWS S3 bucket hosts that serve chat exports.
export function isAllowedChatExportHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  const cloudflare = ["cloudflare.com", "realtimekit.com", "cloudflarestream.com"];
  if (cloudflare.some((domain) => host === domain || host.endsWith(`.${domain}`)))
    return true;
  return /^(?:[a-z0-9.-]+\.)?s3(?:[.-][a-z0-9]+)*\.amazonaws\.com$/.test(host);
}
