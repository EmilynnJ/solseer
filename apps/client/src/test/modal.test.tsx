import { render, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Modal } from "../components/ui";

describe("Modal component accessibility", () => {
  afterEach(() => {
    cleanup();
  });

  it("calls onClose when the Escape key is pressed", () => {
    const handleClose = vi.fn();
    render(
      <Modal title="Test Modal" onClose={handleClose}>
        <p>Modal content</p>
      </Modal>,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("focuses the close button on mount", () => {
    const handleClose = vi.fn();
    const { getByRole } = render(
      <Modal title="Test Modal" onClose={handleClose}>
        <p>Modal content</p>
      </Modal>,
    );

    const closeButton = getByRole("button", { name: /close/i });
    expect(document.activeElement).toBe(closeButton);
  });
});
