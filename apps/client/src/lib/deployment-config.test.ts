import { describe, expect, it } from "vitest";
import workerConfig from "../../../worker/wrangler.toml?raw";

describe("Cloudflare production deployment", () => {
  it("targets the Worker that serves api.soul-seer.net", () => {
    const productionSection = workerConfig.split("[env.production]")[1];

    expect(productionSection).toMatch(/^\s*name\s*=\s*"soulseer-api"/);
  });
});
