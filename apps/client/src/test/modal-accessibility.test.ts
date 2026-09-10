import { describe, expect, it } from "vitest";
import uiSource from "../components/ui.tsx?raw";

describe("Modal keyboard accessibility", () => {
  it("includes an Escape key listener in Modal", () => {
    expect(uiSource).toContain('if (event.key === "Escape")');
    expect(uiSource).toContain('window.addEventListener("keydown", handleKeyDown)');
    expect(uiSource).toContain('window.removeEventListener("keydown", handleKeyDown)');
  });
});
