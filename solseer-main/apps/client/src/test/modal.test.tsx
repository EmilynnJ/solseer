import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Modal } from "../components/ui";

afterEach(cleanup);

describe("Modal keyboard accessibility", () => {
  it("moves focus into the dialog when it opens", () => {
    render(
      <Modal title="Booking details" onClose={vi.fn()}>
        <button>Confirm</button>
      </Modal>,
    );

    expect(screen.getByRole("dialog")).toHaveFocus();
  });

  it("closes on Escape without treating other keys as dismissal", () => {
    const onClose = vi.fn();
    render(
      <Modal title="Booking details" onClose={onClose}>
        <button>Confirm</button>
      </Modal>,
    );

    fireEvent.keyDown(window, { key: "Enter" });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not steal focus again when its parent rerenders", () => {
    const { rerender } = render(
      <Modal title="Booking details" onClose={vi.fn()}>
        <input aria-label="Question" />
      </Modal>,
    );
    const input = screen.getByRole("textbox", { name: "Question" });
    input.focus();

    rerender(
      <Modal title="Booking details" onClose={vi.fn()}>
        <input aria-label="Question" />
      </Modal>,
    );

    expect(input).toHaveFocus();
  });
});
