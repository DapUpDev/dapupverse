import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  CheckInForm,
  type CheckIn,
} from "@/components/check-ins/check-in-form";
import { renderWithProviders } from "@/test/test-utils";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", async (actual) => ({
  ...(await actual<typeof import("@/lib/api/client")>()),
  apiBaseUrl: () => "https://api.test",
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

const OPEN: CheckIn = {
  id: "c1",
  weekStart: "2026-10-12",
  status: "sent",
  closesAt: new Date(Date.now() + 86_400_000).toISOString(),
  progress: "",
  blockers: "",
  confidence: null,
  helpWanted: "",
  answeredAt: null,
};

describe("CheckInForm", () => {
  beforeEach(() => apiFetch.mockReset());

  it("asks the four questions, requires an answer and a confidence, then sends them", async () => {
    const user = userEvent.setup();
    apiFetch.mockResolvedValueOnce(OPEN);
    renderWithProviders(<CheckInForm checkInId="c1" />, { role: "student" });

    await user.click(
      await screen.findByRole("button", { name: "Send check-in" }),
    );
    expect(
      screen.getByText(/what you got done, even if it's small/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Choose how confident you feel."),
    ).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledTimes(1); // nothing sent yet

    await user.type(
      screen.getByLabelText("What did you get done this week?"),
      "Essay draft",
    );
    await user.type(screen.getByLabelText("What’s blocking you?"), "Too long");
    await user.click(screen.getByRole("radio", { name: /2\s*A little/ }));
    await user.type(
      screen.getByLabelText("What would you like help with?"),
      "Review",
    );
    apiFetch.mockResolvedValueOnce({
      ...OPEN,
      status: "answered",
      progress: "Essay draft",
      blockers: "Too long",
      confidence: 2,
      helpWanted: "Review",
      answeredAt: new Date().toISOString(),
    });
    await user.click(screen.getByRole("button", { name: "Send check-in" }));

    expect(apiFetch).toHaveBeenLastCalledWith("/me/check-ins/c1", {
      method: "PUT",
      body: {
        progress: "Essay draft",
        blockers: "Too long",
        confidence: 2,
        helpWanted: "Review",
      },
    });
    expect(
      await screen.findByText("Thanks, it’s with your mentor"),
    ).toBeInTheDocument();
    expect(screen.getByText("2 of 5")).toBeInTheDocument();
  });

  it("waits for sign-in before asking the API (no token means a 401)", () => {
    renderWithProviders(<CheckInForm checkInId="c1" />, { role: "visitor" });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("shows a closed check-in without a form", async () => {
    apiFetch.mockResolvedValueOnce({ ...OPEN, status: "expired" });
    renderWithProviders(<CheckInForm checkInId="c1" />, { role: "student" });
    expect(
      await screen.findByText("This check-in has closed"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Send check-in" }),
    ).not.toBeInTheDocument();
  });
});
