import { describe, expect, it } from "vitest";
import uiSource from "../components/ui.tsx?raw";

describe("modal accessibility", () => {
  it("implements keydown listener for Escape key dismissal", () => {
    expect(uiSource).toContain('if (event.key === "Escape")');
    expect(uiSource).toContain('window.addEventListener("keydown", handleKeyDown)');
    expect(uiSource).toContain('window.removeEventListener("keydown", handleKeyDown)');
  });

  it("manages initial focus on mount without re-focusing on re-render", () => {
    expect(uiSource).toContain("modalRef.current?.focus()");
    expect(uiSource).toContain("tabIndex={-1}");
  });
});
