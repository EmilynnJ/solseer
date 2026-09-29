import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Modal } from "../components/ui";

afterEach(() => {
  cleanup();
});

describe("Modal keyboard accessibility", () => {
  it("dismisses modal when Escape key is pressed", () => {
    const handleClose = vi.fn();
    render(
      <Modal title="Test Modal" onClose={handleClose}>
        <p>Modal content</p>
      </Modal>,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("focuses modal container on mount", () => {
    const handleClose = vi.fn();
    render(
      <Modal title="Test Modal" onClose={handleClose}>
        <p>Modal content</p>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog");
    expect(document.activeElement).toBe(dialog);
  });
});
