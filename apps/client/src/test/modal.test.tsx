import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "../components/ui";

describe("Modal component", () => {
  it("focuses the dialog container on mount", () => {
    const handleClose = vi.fn();
    render(
      <Modal title="Test Modal" onClose={handleClose}>
        <p>Modal content</p>
      </Modal>,
    );

    const modalDialog = screen.getByRole("dialog");
    expect(modalDialog).toHaveFocus();
  });

  it("closes when the Escape key is pressed", () => {
    const handleClose = vi.fn();
    render(
      <Modal title="Test Modal" onClose={handleClose}>
        <p>Modal content</p>
      </Modal>,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
