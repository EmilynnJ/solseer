import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "../pages/dashboard";

const mocks = vi.hoisted(() => ({ api: vi.fn(), refresh: vi.fn() }));
vi.mock("../lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../lib/api")>(), api: mocks.api,
}));
vi.mock("../lib/posthog", () => ({ posthog: { capture: vi.fn() } }));
vi.mock("../components/auth-context", () => ({
  useSoulAuth: () => ({
    me: {
      user: { id: "reader-1", role: "reader", fullName: "Reader One" },
      reader: { isOnline: false, phoneNumber: null, smsNotificationsEnabled: false },
      balance: 0,
    }, refresh: mocks.refresh,
  }),
}));
vi.mock("../hooks/use-api", () => ({
  useApiData: () => ({
    data: { readings: [], reviews: [], summary: { historicalEarnings: 0, todayEarnings: 0, pendingPayout: 0 } },
    loading: false, error: null, refresh: mocks.refresh,
  }),
}));

function setup() {
  render(<MemoryRouter><DashboardPage /></MemoryRouter>);
  const phone = screen.getByRole("textbox", { name: "Mobile number" });
  const form = phone.closest("form");
  if (!form) throw new Error("Reading alerts form is missing");
  return { phone, form, submit: () => fireEvent.click(screen.getByRole("button", { name: "Save reading alerts" })) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.api.mockResolvedValue({ reader: { phoneNumber: "+15551234567", smsNotificationsEnabled: false } });
  mocks.refresh.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("reader reading-alert settings", () => {
  it("normalizes cosmetic formatting while preserving an explicit country code", async () => {
    const { phone, form, submit } = setup();
    fireEvent.change(phone, { target: { value: "+1 (555) 123-4567" } });
    submit();
    expect(mocks.api).toHaveBeenCalledWith("/readers/notifications", {
      method: "PATCH", body: JSON.stringify({ phoneNumber: "+15551234567", smsNotificationsEnabled: false }),
    });
    expect(await within(form).findByRole("status")).toHaveTextContent("saved");
    expect(phone).toHaveValue("+15551234567");
  });

  it("explains a missing country code beside the input and sends no invalid request", async () => {
    const { phone, form, submit } = setup();
    fireEvent.change(phone, { target: { value: "5551234567" } });
    submit();
    expect(await within(form).findByRole("alert")).toHaveTextContent("international format");
    expect(mocks.api).not.toHaveBeenCalled();
    expect(phone).toHaveValue("5551234567");
  });

  it("requires a mobile number when SMS alerts are enabled", async () => {
    const { form, submit } = setup();
    fireEvent.click(within(form).getByRole("checkbox"));
    submit();
    expect(await within(form).findByRole("alert")).toHaveTextContent("Add a mobile number");
    expect(mocks.api).not.toHaveBeenCalled();
  });

  it("shows rejected saves as errors at the form, not a success notice elsewhere", async () => {
    const { phone, form, submit } = setup();
    fireEvent.change(phone, { target: { value: "+15551234567" } });
    mocks.api.mockRejectedValueOnce(new Error("The request could not be completed."));
    submit();
    expect(await within(form).findByRole("alert")).toHaveTextContent("The request could not be completed.");
    expect(within(form).queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save reading alerts" })).toBeEnabled();
  });

  it("allows clearing the phone number while notifications are disabled", async () => {
    const { form, submit } = setup();
    submit();
    expect(mocks.api).toHaveBeenCalledWith("/readers/notifications", {
      method: "PATCH", body: JSON.stringify({ phoneNumber: null, smsNotificationsEnabled: false }),
    });
    expect(await within(form).findByRole("status")).toHaveTextContent("saved");
  });
});
