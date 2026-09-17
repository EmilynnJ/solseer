import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Modal } from "./ui";

afterEach(() => {
  cleanup();
});

describe("Modal Component", () => {
  test("renders title and children", () => {
    const onClose = vi.fn();
    render(
      <Modal title="Test Modal Title" onClose={onClose}>
        <div>Test Modal Content</div>
      </Modal>
    );

    expect(screen.getByText("Test Modal Title")).toBeInTheDocument();
    expect(screen.getByText("Test Modal Content")).toBeInTheDocument();
  });

  test("calls onClose when Close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal title="Test Modal" onClose={onClose}>
        <div>Content</div>
      </Modal>
    );

    const closeButton = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("focuses the modal section on mount", () => {
    const onClose = vi.fn();
    render(
      <Modal title="Test Modal" onClose={onClose}>
        <div>Content</div>
      </Modal>
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveFocus();
  });

  test("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    render(
      <Modal title="Test Modal" onClose={onClose}>
        <div>Content</div>
      </Modal>
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
