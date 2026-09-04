import { describe, expect, it } from "vitest";
import modalSource from "../components/ui.tsx?raw";

describe("Modal keyboard accessibility", () => {
  it("attaches escape key listener for modal dismissal", () => {
    expect(modalSource).toContain('event.key === "Escape"');
    expect(modalSource).toContain('window.addEventListener("keydown", handleKeyDown)');
  });

  it("manages initial focus on mount via tabIndex -1 and modalRef", () => {
    expect(modalSource).toContain("tabIndex={-1}");
    expect(modalSource).toContain("modalRef.current?.focus()");
  });
});
