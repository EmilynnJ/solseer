import { describe, expect, it, vi, afterEach } from "vitest";
import { sendSms, SmsProviderError } from "../../src/providers/telnyx";

describe("telnyx provider", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env: any = {
    TELNYX_API_KEY: "test-key",
    TELNYX_FROM_NUMBER: "+1234567890",
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("sendSms", () => {
    it("handles 400 error with json errors array", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            errors: [{ code: "10005" }, { code: 123 }, {}],
          }),
      } as unknown as Response);

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        sendSms(env, { to: "+0987654321", text: "Hello" }),
      ).rejects.toThrow(new SmsProviderError(400, ["10005", "123"]));
    });

    it("handles error response with malformed json", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("Invalid JSON")),
      } as unknown as Response);

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        sendSms(env, { to: "+0987654321", text: "Hello" }),
      ).rejects.toThrow(new SmsProviderError(500, []));
    });

    it("handles error response with no errors array in json", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 403,
        json: () =>
          Promise.resolve({
            something: "else",
          }),
      } as unknown as Response);

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        sendSms(env, { to: "+0987654321", text: "Hello" }),
      ).rejects.toThrow(new SmsProviderError(403, []));
    });

    it("handles happy path 200 ok response", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            data: {
              id: "message-id-123",
            },
          }),
      } as unknown as Response);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const result = await sendSms(env, { to: "+0987654321", text: "Hello" });
      expect(result).toBe("message-id-123");
    });

    it("throws SmsProviderError on 200 ok with invalid schema", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            invalid: "schema",
          }),
      } as unknown as Response);

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        sendSms(env, { to: "+0987654321", text: "Hello" }),
      ).rejects.toThrow(new SmsProviderError(200, ["invalid_response"]));
    });
  });
});
