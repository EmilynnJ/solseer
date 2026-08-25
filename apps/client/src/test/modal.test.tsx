import { render, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Modal } from "../components/ui";

describe("Modal accessibility", () => {
  afterEach(() => {
    cleanup();
  });

  it("calls onClose when Escape key is pressed", () => {
    const handleClose = vi.fn();
    render(
      <Modal title="Test Modal" onClose={handleClose}>
        <p>Modal Content</p>
      </Modal>,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("focuses the modal section on mount", () => {
    const handleClose = vi.fn();
    const { getByRole } = render(
      <Modal title="Test Modal" onClose={handleClose}>
        <p>Modal Content</p>
      </Modal>,
    );

    const dialog = getByRole("dialog");
    expect(document.activeElement).toBe(dialog);
  });
});
