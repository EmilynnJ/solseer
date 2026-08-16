import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Modal } from "../components/ui";

describe("Modal component", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders title and children", () => {
    render(
      <Modal title="Test Modal" onClose={() => {}}>
        <p>Modal content</p>
      </Modal>,
    );
    expect(screen.getByRole("heading", { name: "Test Modal" })).toBeDefined();
    expect(screen.getByText("Modal content")).toBeDefined();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal title="Test Modal" onClose={onClose}>
        <p>Modal content</p>
      </Modal>,
    );
    const closeBtn = screen.getByRole("button", { name: "Close" });
    expect(closeBtn.getAttribute("title")).toBe("Close");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    render(
      <Modal title="Test Modal" onClose={onClose}>
        <p>Modal content</p>
      </Modal>,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
