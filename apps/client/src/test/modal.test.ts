import { describe, expect, it } from "vitest";
import uiSource from "../components/ui.tsx?raw";

describe("Modal component keyboard dismissal and focus management", () => {
  it("handles Escape key dismissal using a window keydown listener", () => {
    expect(uiSource).toContain('if (event.key === "Escape")');
    expect(uiSource).toContain('window.addEventListener("keydown", handleKeyDown);');
    expect(uiSource).toContain('window.removeEventListener("keydown", handleKeyDown);');
  });

  it("decouples focus-on-mount in a separate effect with empty dependencies", () => {
    expect(uiSource).toContain("modalRef.current?.focus();");
    expect(uiSource).toContain("tabIndex={-1}");
  });
});
