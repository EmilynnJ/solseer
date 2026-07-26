import { describe, expect, it } from "vitest";
import { signUploadCapability, verifyUploadCapability } from "../src/lib/crypto";

describe("signed upload capabilities", () => {
  it("accepts only the exact signed payload", async () => {
    const payload = btoa(JSON.stringify({ userId: crypto.randomUUID(), expiresAt: Date.now() + 60_000 }));
    const signature = await signUploadCapability(payload, "a-production-length-test-secret");
    await expect(verifyUploadCapability(payload, signature, "a-production-length-test-secret")).resolves.toBe(true);
    await expect(verifyUploadCapability(`${payload}x`, signature, "a-production-length-test-secret")).resolves.toBe(false);
    await expect(verifyUploadCapability(payload, "not-a-signature", "a-production-length-test-secret")).resolves.toBe(false);
  });
});
