import { useState } from "react";
import { ImageUp } from "lucide-react";
import { API_ORIGIN, api } from "../lib/api";
import { getAccessToken } from "../lib/auth";

// Readers upload their own photo; Admins pass readerId to upload for a Reader.
export function ReaderImageUpload({
  onDone,
  readerId,
}: {
  onDone: () => void;
  readerId?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function choose(file?: File) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const cap = await api<{ capability: string; signature: string }>(
        `/uploads/reader-image/capability${
          readerId ? `?readerId=${encodeURIComponent(readerId)}` : ""
        }`,
        {
          method: "POST",
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type,
            size: file.size,
          }),
        },
      );
      const token = await getAccessToken();
      if (!token) throw new Error("Please sign in again before uploading.");
      const response = await fetch(`${API_ORIGIN}/api/uploads/reader-image`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": file.type,
          "X-SoulSeer-Upload-Capability": cap.capability,
          "X-SoulSeer-Upload-Signature": cap.signature,
        },
        body: file,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(payload?.error?.message ?? "Image upload failed.");
      }
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Image upload failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <label className="upload-button">
        <ImageUp /> {busy ? "Uploading…" : "Upload profile image"}
        <input
          type="file"
          hidden
          disabled={busy}
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => void choose(e.target.files?.[0])}
        />
      </label>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
