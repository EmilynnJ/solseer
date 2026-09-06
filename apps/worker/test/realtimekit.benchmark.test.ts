import { describe, it, vi, expect } from "vitest";
import { verifyRealtimeKitSignature } from "../src/providers/realtimekit";

describe("RealtimeKit Webhook Signature Optimization Benchmark", () => {
  it("benchmarks signature verification", async () => {
    // We need to generate a real valid signature for testing
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"]
    );

    const rawBody = new TextEncoder().encode("test payload");
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      keyPair.privateKey,
      rawBody
    );
    const signatureString = btoa(String.fromCharCode(...new Uint8Array(signature)));

    // Get the SPKI format of the generated public key
    const spkiBuffer = await crypto.subtle.exportKey("spki", keyPair.publicKey);
    const spkiBase64 = btoa(String.fromCharCode(...new Uint8Array(spkiBuffer)));
    const actualMockPublicKey = `-----BEGIN PUBLIC KEY-----\n${spkiBase64}\n-----END PUBLIC KEY-----`;

    let fetchCallCount = 0;
    vi.stubGlobal("fetch", async () => {
      // Simulate network delay to make the benchmark realistic
      await new Promise(r => setTimeout(r, 10));
      fetchCallCount++;
      return new Response(JSON.stringify({
        success: true,
        data: { publicKey: actualMockPublicKey }
      }));
    });

    const start = performance.now();
    const iterations = 50; // Doing a good amount of iterations to see the difference clearly
    let result = false;
    console.log(result);
    for (let i = 0; i < iterations; i++) {
        result = await verifyRealtimeKitSignature(
            rawBody,
            signatureString,
            "https://example.com/public-key"
        );
        expect(result).toBe(true);
    }
    const end = performance.now();

    console.log(`[Benchmark] Baseline (unoptimized): ${(end - start).toFixed(2)}ms for ${String(iterations)} iterations`);
    console.log(`[Benchmark] Fetch called ${String(fetchCallCount)} times`);
  });
});
