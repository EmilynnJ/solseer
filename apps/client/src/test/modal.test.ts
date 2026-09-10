import { describe, expect, it } from "vitest";
import uiSource from "../components/ui.tsx?raw";

describe("Modal keyboard accessibility", () => {
  it("dismisses modal on Escape key down event", () => {
    expect(uiSource).toContain('event.key === "Escape"');
    expect(uiSource).toContain('window.addEventListener("keydown", handleKeyDown)');
    expect(uiSource).toContain('window.removeEventListener("keydown", handleKeyDown)');
  });
});
