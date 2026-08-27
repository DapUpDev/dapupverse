import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MentorRequestsInbox } from "@/components/connections/mentor-requests-inbox";
import { DEMO_MENTOR_ID } from "@/lib/data/seed";
import { connectionRepository } from "@/lib/repositories";
import { renderWithProviders } from "@/test/test-utils";

describe("MentorRequestsInbox", () => {
  it("lists pending requests with Accept and Archive — and no reject action anywhere", async () => {
    const { container } = renderWithProviders(
      <MentorRequestsInbox mentorId={DEMO_MENTOR_ID} />,
    );

    expect(await screen.findByText("Noah Williams")).toBeInTheDocument();
    expect(screen.getByText("Omar Haddad")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Accept" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "Archive" }).length,
    ).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/reject|decline/i);
  });

  it("accepting a pending request creates a connection", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MentorRequestsInbox mentorId={DEMO_MENTOR_ID} />);

    await screen.findByText("Noah Williams");
    await user.click(screen.getAllByRole("button", { name: "Accept" })[0]);

    const requests = await connectionRepository.listForMentor(DEMO_MENTOR_ID);
    expect(requests.filter((r) => r.state === "accepted").length).toBe(2); // seed + newly accepted
  });

  it("archiving hides a request from the inbox but keeps it pending", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MentorRequestsInbox mentorId={DEMO_MENTOR_ID} />);

    await screen.findByText("Noah Williams");
    const archiveButtons = screen.getAllByRole("button", { name: "Archive" });
    await user.click(archiveButtons[0]);

    expect(await screen.findByText(/^Archived$/)).toBeInTheDocument();
    expect(
      screen.getByText(/students still see them as pending/i),
    ).toBeInTheDocument();

    const requests = await connectionRepository.listForMentor(DEMO_MENTOR_ID);
    const archived = requests.find((r) => r.archivedByMentor);
    expect(archived?.state).toBe("pending");
  });
});
