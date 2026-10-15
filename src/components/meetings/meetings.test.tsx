import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MeetingDetail } from "@/components/meetings/meeting-detail";
import { RequestMeeting } from "@/components/meetings/request-meeting";
import type { Meeting } from "@/components/meetings/meeting-types";
import { renderWithProviders } from "@/test/test-utils";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", async (actual) => ({
  ...(await actual<typeof import("@/lib/api/client")>()),
  apiBaseUrl: () => "https://api.test",
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const PROPOSED: Meeting = {
  id: "b1",
  kind: "triage",
  status: "proposed",
  title: "Maya Lin and mentors",
  note: "",
  minutes: 30,
  startsAt: "2026-10-17T17:00:00Z",
  options: [],
  reason: "Essay due soon.",
  agenda: ["Cut the introduction"],
  requestedBy: null,
  myResponse: "pending",
  myRole: "mentor",
  people: [
    {
      id: "s",
      name: "Maya Lin",
      role: "student",
      response: "accepted",
      calendarConnected: false,
    },
    {
      id: "m",
      name: "Jae Park",
      role: "mentor",
      response: "pending",
      calendarConnected: true,
    },
  ],
};

describe("MeetingDetail", () => {
  beforeEach(() => apiFetch.mockReset());

  it("shows why, the agenda, and books it on Confirm", async () => {
    const user = userEvent.setup();
    apiFetch.mockResolvedValueOnce(PROPOSED);
    renderWithProviders(<MeetingDetail meetingId="b1" />, { role: "mentor" });

    expect(await screen.findByText("Essay due soon.")).toBeInTheDocument();
    expect(screen.getByText("Cut the introduction")).toBeInTheDocument();
    expect(screen.getByText("Waiting for answers")).toBeInTheDocument();

    apiFetch.mockResolvedValueOnce({
      ...PROPOSED,
      status: "confirmed",
      myResponse: "accepted",
    });
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(apiFetch).toHaveBeenLastCalledWith("/meetings/b1/respond", {
      method: "POST",
      body: { accept: true },
    });
    expect(await screen.findByText("Booked")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Confirm" }),
    ).not.toBeInTheDocument();
  });

  it("lets the student pick an offered time when nothing fit", async () => {
    const user = userEvent.setup();
    apiFetch.mockResolvedValueOnce({
      ...PROPOSED,
      status: "no_slot",
      startsAt: null,
      options: ["2026-10-24T16:00:00Z", "2026-10-24T16:30:00Z"],
      myRole: "student",
      myResponse: "accepted",
    });
    renderWithProviders(<MeetingDetail meetingId="b1" />, { role: "student" });
    const choices = await screen.findAllByRole("button", { name: /October/ });
    apiFetch.mockResolvedValueOnce(PROPOSED);
    await user.click(choices[1]);
    expect(apiFetch).toHaveBeenLastCalledWith("/meetings/b1/pick", {
      method: "POST",
      body: { startsAt: "2026-10-24T16:30:00Z" },
    });
  });
});

describe("RequestMeeting", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    push.mockReset();
  });

  it("finds times everyone is free and sends the request", async () => {
    const user = userEvent.setup();
    apiFetch.mockImplementation(async (path: string) => {
      if (path === "/meetings/people")
        return [
          {
            id: "m",
            name: "Jae Park",
            role: "mentor",
            response: null,
            calendarConnected: true,
          },
          {
            id: "k",
            name: "Kim Ito",
            role: "mentor",
            response: null,
            calendarConnected: false,
          },
        ];
      if (path === "/meetings/slots")
        return {
          slots: ["2026-10-20T01:00:00Z", "2026-10-20T01:45:00Z"],
          notConnected: ["Kim Ito"],
        };
      return { ...PROPOSED, id: "new1" };
    });
    renderWithProviders(<RequestMeeting />, { role: "student" });

    const find = await screen.findByRole("button", { name: "Find times" });
    expect(find).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /Jae Park/ }));
    await user.click(screen.getByRole("checkbox", { name: /Kim Ito/ }));
    await user.click(screen.getByRole("radio", { name: "45 min" }));
    await user.click(find);

    expect(apiFetch).toHaveBeenCalledWith("/meetings/slots", {
      method: "POST",
      body: expect.objectContaining({ peopleIds: ["m", "k"], minutes: 45 }),
    });
    expect(
      await screen.findByText(/calendar not connected: Kim Ito/),
    ).toBeInTheDocument();
    await user.click(screen.getAllByRole("radio", { name: /\d:\d\d/ })[1]);
    await user.type(screen.getByLabelText("Note (optional)"), "Essay plan");
    await user.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/app/meetings/new1"),
    );
    expect(apiFetch).toHaveBeenCalledWith("/meetings", {
      method: "POST",
      body: expect.objectContaining({
        peopleIds: ["m", "k"],
        minutes: 45,
        startsAt: "2026-10-20T01:45:00Z",
        note: "Essay plan",
      }),
    });
  });
});
