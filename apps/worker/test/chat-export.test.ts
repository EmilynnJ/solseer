import { describe, expect, it } from "vitest";
import { isAllowedChatExportHost, parseChatExport } from "../src/lib/chat-export";

describe("RealtimeKit chat export", () => {
  it("reads the documented CSV columns, including quoted commas, quotes and newlines", () => {
    const csv = [
      "id,participantId,sessionId,meetingId,displayName,pinned,isEdited,payloadType,payload,createdAt",
      'm1,p1,s1,mt1,Brooke,false,false,TEXT_MESSAGE,"Hello, welcome ""friend""",2026-10-01T10:00:00Z',
      'm2,p2,s1,mt1,Client,false,false,TEXT_MESSAGE,"Line one\nline two",2026-10-01T10:01:00Z',
      "",
    ].join("\r\n");
    expect(parseChatExport(csv)).toEqual([
      expect.objectContaining({ displayName: "Brooke", payload: 'Hello, welcome "friend"', createdAt: "2026-10-01T10:00:00Z" }),
      expect.objectContaining({ displayName: "Client", payload: "Line one\nline two", payloadType: "TEXT_MESSAGE" }),
    ]);
  });

  it("still accepts a JSON array export", () => {
    expect(parseChatExport('[{"displayName":"A","message":"hi"}]')).toEqual([{ displayName: "A", message: "hi" }]);
    expect(parseChatExport("")).toEqual([]);
  });

  it("allows Cloudflare and AWS S3 export hosts only", () => {
    expect(isAllowedChatExportHost("realtimekit.com")).toBe(true);
    expect(isAllowedChatExportHost("exports.realtimekit.com")).toBe(true);
    expect(isAllowedChatExportHost("chat-dumps.s3.us-east-1.amazonaws.com")).toBe(true);
    expect(isAllowedChatExportHost("s3.amazonaws.com")).toBe(true);
    expect(isAllowedChatExportHost("s3-ap-south-1.amazonaws.com")).toBe(true);
    expect(isAllowedChatExportHost("ec2-1-2-3-4.compute-1.amazonaws.com")).toBe(false);
    expect(isAllowedChatExportHost("s3.amazonaws.com.evil.com")).toBe(false);
    expect(isAllowedChatExportHost("evil-s3.amazonaws.com.attacker.net")).toBe(false);
  });
});
