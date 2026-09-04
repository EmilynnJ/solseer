import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Modal } from "./ui";

describe("Modal Component Accessibility and Interactions", () => {
  afterEach(() => {
    cleanup();
  });

  it("focuses the modal content on mount", () => {
    const handleClose = vi.fn();
    render(
      <Modal title="Test Modal" onClose={handleClose}>
        <div>Modal Content</div>
      </Modal>
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(document.activeElement).toBe(dialog);
  });

  it("calls onClose when Escape key is pressed", () => {
    const handleClose = vi.fn();
    render(
      <Modal title="Test Modal" onClose={handleClose}>
        <div>Modal Content</div>
      </Modal>
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the close button is clicked", () => {
    const handleClose = vi.fn();
    render(
      <Modal title="Test Modal" onClose={handleClose}>
        <div>Modal Content</div>
      </Modal>
    );

    const closeButton = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("does not steal focus from an input element inside the modal on re-render", () => {
    const handleClose = vi.fn();
    const { rerender } = render(
      <Modal title="Test Modal" onClose={handleClose}>
        <input data-testid="modal-input" type="text" />
      </Modal>
    );

    const input = screen.getByTestId("modal-input");
    input.focus();
    expect(document.activeElement).toBe(input);

    // Re-render the Modal with a new onClose reference (representing inline handler changes on parent state update)
    rerender(
      <Modal title="Test Modal" onClose={() => {}}>
        <input data-testid="modal-input" type="text" />
      </Modal>
    );

    // Verify focus remains on the input and wasn't stolen back to the modal container
    expect(document.activeElement).toBe(input);
  });
});
