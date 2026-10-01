import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Modal } from "../components/ui";

afterEach(cleanup);

describe("Modal accessibility & keyboard interaction", () => {
  it("shifts focus to the modal section on mount", () => {
    render(
      <Modal title="Test Modal" onClose={vi.fn()}>
        <p>Modal content</p>
      </Modal>
    );

    const dialog = screen.getByRole("dialog");
    expect(document.activeElement).toBe(dialog);
  });

  it("triggers onClose when pressing the Escape key", () => {
    const handleClose = vi.fn();
    render(
      <Modal title="Test Modal" onClose={handleClose}>
        <p>Modal content</p>
      </Modal>
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("does not trigger onClose when pressing other keys", () => {
    const handleClose = vi.fn();
    render(
      <Modal title="Test Modal" onClose={handleClose}>
        <p>Modal content</p>
      </Modal>
    );

    fireEvent.keyDown(window, { key: "Enter" });
    expect(handleClose).not.toHaveBeenCalled();
  });
});
