import { describe, expect, it } from "vitest";
import clientConfig from "../../vercel.json?raw";
import workerConfig from "../../../worker/wrangler.toml?raw";

describe("Cloudflare production deployment", () => {
  it("targets the Worker that serves api.soul-seer.net", () => {
    const productionSection = workerConfig.split("[env.production]")[1];

    expect(productionSection).toMatch(/^\s*name\s*=\s*"soulseer-api"/);
  });

  it("promotes production client deployments to soul-seer.net", () => {
    const config = JSON.parse(clientConfig) as { alias?: string[] };

    expect(config.alias).toContain("soul-seer.net");
  });
});
