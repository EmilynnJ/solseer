import { describe, expect, it } from "vitest";
import loginSource from "../pages/login.tsx?raw";

describe("login profile gate", () => {
  it("uses resolved profile state instead of a callback flag to enter profile setup", () => {
    expect(loginSource).not.toContain('params.get("complete")');
    expect(loginSource).toContain("if (!auth.needsProfile || mode === \"verify\") return;");
  });

  it("does not force Google sign-in callbacks into profile setup", () => {
    const socialStart = loginSource.indexOf("authClient.signIn.social");
    const socialEnd = loginSource.indexOf("</button>", socialStart);
    const socialBlock = loginSource.slice(socialStart, socialEnd);

    expect(socialStart).toBeGreaterThan(-1);
    expect(socialBlock).not.toContain('complete: "1"');
    expect(socialBlock).toContain("returnTo");
  });
});
