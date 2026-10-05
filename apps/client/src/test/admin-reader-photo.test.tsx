import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AdminReaderProfiles } from "../components/admin-records";

const api = vi.hoisted(() => vi.fn().mockResolvedValue({ capability: "cap", signature: "sig" }));
vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
  api,
}));
vi.mock("../lib/auth", () => ({ getAccessToken: vi.fn().mockResolvedValue("token") }));
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

it("lets an Admin upload a profile photo for a specific Reader", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  render(
    <AdminReaderProfiles
      onSaved={vi.fn().mockResolvedValue(undefined)}
      readers={[{
        id: "11111111-1111-4111-8111-111111111111",
        email: "reader@example.com",
        username: "TarotIlluminae",
        fullName: "Brooke",
        status: "active",
        bio: "",
        specialties: [],
        pricingChat: 500,
        pricingVoice: 700,
        pricingVideo: 1000,
        verificationStatus: "pending",
        hasImage: false,
      }]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
  expect(screen.getByText("No profile photo yet.")).toBeInTheDocument();
  const input = screen.getByLabelText(/Upload profile image/);
  fireEvent.change(input, { target: { files: [new File(["x"], "me.png", { type: "image/png" })] } });
  await waitFor(() => { expect(fetchMock).toHaveBeenCalledTimes(1); });
  expect(api.mock.calls[0]?.[0]).toBe(
    "/uploads/reader-image/capability?readerId=11111111-1111-4111-8111-111111111111",
  );
  expect(await screen.findByText(/Photo uploaded/)).toBeInTheDocument();
});

it("suspends a Reader from the editor through the status endpoint", async () => {
  api.mockResolvedValue({});
  const onSaved = vi.fn().mockResolvedValue(undefined);
  render(
    <AdminReaderProfiles
      onSaved={onSaved}
      readers={[{
        id: "22222222-2222-4222-8222-222222222222",
        email: "reader@example.com",
        username: "reader",
        fullName: "Reader Name",
        status: "active",
        bio: "",
        specialties: [],
        pricingChat: 500,
        pricingVoice: 700,
        pricingVideo: 1000,
        verificationStatus: "verified",
        hasImage: false,
      }]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
  fireEvent.change(screen.getByLabelText("Account"), { target: { value: "suspended" } });
  fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
  await waitFor(() => { expect(onSaved).toHaveBeenCalled(); });
  const profileBody = JSON.parse((api.mock.calls[0]?.[1] as { body: string }).body) as Record<string, unknown>;
  expect(profileBody.status).toBeUndefined();
  expect(api.mock.calls[1]).toEqual([
    "/admin/users/22222222-2222-4222-8222-222222222222/status",
    { method: "PATCH", body: JSON.stringify({ status: "suspended" }) },
  ]);
});
