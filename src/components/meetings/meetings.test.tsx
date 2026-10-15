import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MeetingDetail } from "@/components/meetings/meeting-detail";
import { RequestMeeting } from "@/components/meetings/request-meeting";
import type {
  Availability,
  Meeting,
} from "@/components/meetings/meeting-types";
import { renderWithProviders } from "@/test/test-utils";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", async (actual) => ({
  ...(await actual<typeof import("@/lib/api/client")>()),
  apiBaseUrl: () => "https://api.test",
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

// A week far in the future so "window has passed" never triggers.
const START = new Date(2031, 2, 10, 0, 0).toISOString();
const END = new Date(2031, 2, 17, 0, 0).toISOString();
const GREEN = new Date(2031, 2, 11, 9, 0).toISOString();

const MEETING: Meeting = {
  id: "b1",
  kind: "triage",
  status: "collecting",
  title: "Maya Lin and mentors",
  note: "",
  minutes: 30,
  startsAt: null,
  windowStart: START,
  windowEnd: END,
  reason: "Essay due soon.",
  agenda: ["Cut the introduction"],
  requestedBy: null,
  myRole: "mentor",
  myFilledIn: false,
  people: [
    {
      id: "s",
      name: "Maya Lin",
      role: "student",
      filledIn: true,
      calendarConnected: false,
    },
    {
      id: "m",
      name: "Jae Park",
      role: "mentor",
      filledIn: false,
      calendarConnected: true,
    },
  ],
};

const AVAILABILITY: Availability = {
  mine: [],
  suggested: false,
  cells: [{ start: GREEN, free: ["s", "m"] }],
  bookable: [GREEN],
  blocked: [],
};

function route(meeting: Meeting, availability: Availability) {
  apiFetch.mockImplementation(
    async (path: string, init?: { method?: string }) => {
      if (path.includes("/availability")) return availability;
      if (path.endsWith("/book"))
        return { ...meeting, status: "confirmed", startsAt: GREEN };
      if (init?.method === undefined) return meeting;
      return meeting;
    },
  );
}

describe("MeetingDetail with the availability grid", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("marks a cell and saves my times", async () => {
    const user = userEvent.setup();
    route(MEETING, AVAILABILITY);
    renderWithProviders(<MeetingDetail meetingId="b1" />, { role: "mentor" });

    expect(
      await screen.findByText("Waiting for Jae Park."),
    ).toBeInTheDocument();
    const mine = screen.getByRole("group", { name: "Your free times" });
    const cells = mine.querySelectorAll("button:not([disabled])");
    expect(cells.length).toBeGreaterThan(100);
    await user.click(cells[40]);
    expect(cells[40]).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Save my times" }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        expect.stringContaining("/meetings/b1/availability?timezone="),
        { method: "PUT", body: { slots: [expect.any(String)] } },
      ),
    );
  });

  it("lets a mentor book a time that works for everyone", async () => {
    const user = userEvent.setup();
    route(
      {
        ...MEETING,
        myFilledIn: true,
        people: MEETING.people.map((p) => ({ ...p, filledIn: true })),
      },
      AVAILABILITY,
    );
    renderWithProviders(<MeetingDetail meetingId="b1" />, { role: "mentor" });

    await user.click(
      await screen.findByRole("button", { name: /Recommended/ }),
    );
    await user.click(screen.getByRole("button", { name: /^Book / }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith("/meetings/b1/book", {
        method: "POST",
        body: { startsAt: GREEN },
      }),
    );
    expect(await screen.findByText("Booked")).toBeInTheDocument();
  });

  it("shows the student the green times but no Book button", async () => {
    route(
      {
        ...MEETING,
        myRole: "student",
        people: MEETING.people.map((p) => ({ ...p, filledIn: true })),
      },
      AVAILABILITY,
    );
    renderWithProviders(<MeetingDetail meetingId="b1" />, { role: "student" });
    expect(await screen.findByText(/Recommended/)).toBeInTheDocument();
    expect(
      screen.getByText("A mentor will book a green time."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Book / }),
    ).not.toBeInTheDocument();
  });
});

describe("RequestMeeting", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    push.mockReset();
  });

  it("sends the request and opens the grid", async () => {
    const user = userEvent.setup();
    apiFetch.mockImplementation(async (path: string) =>
      path === "/meetings/people"
        ? [
            {
              id: "m",
              name: "Jae Park",
              role: "mentor",
              filledIn: false,
              calendarConnected: true,
            },
            {
              id: "k",
              name: "Kim Ito",
              role: "mentor",
              filledIn: false,
              calendarConnected: false,
            },
          ]
        : { ...MEETING, id: "new1" },
    );
    renderWithProviders(<RequestMeeting />, { role: "student" });

    const send = await screen.findByRole("button", {
      name: "Send and mark my times",
    });
    expect(send).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /Jae Park/ }));
    await user.click(screen.getByRole("radio", { name: "45 min" }));
    await user.type(screen.getByLabelText("Note (optional)"), "Essay plan");
    await user.click(send);

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/app/meetings/new1"),
    );
    expect(apiFetch).toHaveBeenCalledWith("/meetings", {
      method: "POST",
      body: { peopleIds: ["m"], minutes: 45, title: "", note: "Essay plan" },
    });
  });
});
