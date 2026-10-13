import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
} from "jose";
import { describe, expect, it } from "vitest";
import {
  neonAuthIssuer,
  NEON_AUTH_ALGORITHMS,
  verifyIdentityToken,
} from "../src/lib/auth";

describe("Neon Auth JWT verification", () => {
  it("accepts the EdDSA/Ed25519 tokens issued by Neon Auth", async () => {
    const configuredAuthUrl = "https://auth.example.test/neondb/auth";
    const issuer = "https://auth.example.test";
    const kid = "neon-auth-ed25519";
    const { privateKey, publicKey } = await generateKeyPair("EdDSA", {
      crv: "Ed25519",
      extractable: true,
    });
    const publicJwk = await exportJWK(publicKey);
    const token = await new SignJWT({
      email: "reader@example.test",
      name: "SoulSeer Reader",
      emailVerified: true,
    })
      .setProtectedHeader({ alg: "EdDSA", kid })
      .setIssuer(issuer)
      .setSubject("neon-user-id")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);

    const identity = await verifyIdentityToken(
      token,
      neonAuthIssuer(configuredAuthUrl),
      createLocalJWKSet({
        keys: [{ ...publicJwk, alg: "EdDSA", kid }],
      }),
    );

    expect(NEON_AUTH_ALGORITHMS).toContain("EdDSA");
    expect(identity).toEqual({
      subject: "neon-user-id",
      email: "reader@example.test",
      name: "SoulSeer Reader",
      emailVerified: true,
    });
  });

  it("rejects an otherwise valid token until its email is verified", async () => {
    const issuer = "https://auth.example.test";
    const kid = "neon-auth-ed25519";
    const { privateKey, publicKey } = await generateKeyPair("EdDSA", {
      crv: "Ed25519",
      extractable: true,
    });
    const publicJwk = await exportJWK(publicKey);
    const token = await new SignJWT({
      email: "unverified@example.test",
      emailVerified: false,
    })
      .setProtectedHeader({ alg: "EdDSA", kid })
      .setIssuer(issuer)
      .setSubject("unverified-user")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);

    await expect(
      verifyIdentityToken(
        token,
        issuer,
        createLocalJWKSet({
          keys: [{ ...publicJwk, alg: "EdDSA", kid }],
        }),
      ),
    ).rejects.toMatchObject({
      status: 403,
      code: "EMAIL_NOT_VERIFIED",
    });
  });

  it("normalizes the configured Neon Auth endpoint to the JWT issuer origin", () => {
    expect(
      neonAuthIssuer(
        "https://ep-example.neonauth.us-east-2.aws.neon.tech/neondb/auth",
      ),
    ).toBe("https://ep-example.neonauth.us-east-2.aws.neon.tech");
  });
});
