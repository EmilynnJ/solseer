import { describe, expect, it } from "vitest";
import loginSource from "../pages/login.tsx?raw";

describe("login profile gate", () => {
  it("does not force an existing Google login into profile setup from a callback flag", () => {
    expect(loginSource).not.toContain('params.get("complete")');
    expect(loginSource).not.toContain('complete: "1"');
  });
});
