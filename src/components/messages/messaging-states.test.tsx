import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { Conversation } from "@/components/messages/conversation";
import { ThreadList } from "@/components/messages/thread-list";
import { connectionRepository } from "@/lib/repositories";
import { renderWithProviders } from "@/test/test-utils";

describe("messaging availability states", () => {
  it("explains that messaging is unavailable while a request is pending", () => {
    renderWithProviders(
      <ThreadList
        items={[]}
        ready={true}
        hasPendingRequests={true}
      />,
    );
    expect(
      screen.getByText(/messaging unlocks once a request is accepted/i),
    ).toBeInTheDocument();
  });

  it("shows an active conversation with a composer for an accepted connection", async () => {
    renderWithProviders(
      <Conversation threadId="thread-lily-jae" userId="student-lily" />,
    );
    expect(
      await screen.findByRole("heading", { name: "Jae Park" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("becomes read-only after disconnect", async () => {
    await connectionRepository.disconnect("request-lily-jae");
    renderWithProviders(
      <Conversation threadId="thread-lily-jae" userId="student-lily" />,
    );
    expect(
      await screen.findByText(/this conversation is read-only/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("becomes read-only after a block", async () => {
    await connectionRepository.block("request-lily-jae");
    renderWithProviders(
      <Conversation threadId="thread-lily-jae" userId="student-lily" />,
    );
    expect(
      await screen.findByText(/this conversation is read-only/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
