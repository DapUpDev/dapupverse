import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MentorFilterBar } from "@/components/mentors/mentor-filter-bar";
import type { MentorFilters } from "@/lib/domain/types";
import { renderWithProviders } from "@/test/test-utils";

function renderBar(filters: MentorFilters) {
  const onChange = vi.fn();
  const onClear = vi.fn();
  renderWithProviders(
    <MentorFilterBar
      filters={filters}
      options={{ subjects: ["Physics"], countries: [], universities: [] }}
      onChange={onChange}
      onClear={onClear}
    />,
  );
  return { onChange, onClear };
}

describe("MentorFilterBar", () => {
  it("sets a field when a value is chosen through the Filter menu", async () => {
    const user = userEvent.setup();
    const { onChange } = renderBar({ query: "mit" });

    // Keyboard from here: jsdom has no layout, so a pointer move off the
    // submenu trigger closes the submenu. Playwright covers the pointer path.
    await user.click(screen.getByRole("button", { name: "Filter" }));
    await screen.findByRole("menuitem", { name: "Subject or specialty" });
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowRight}");
    await screen.findByRole("menuitemradio", { name: "Physics" });
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith({ query: "mit", subject: "Physics" });
  });

  it("clears a field from its chip, and clears everything from Clear", async () => {
    const user = userEvent.setup();
    const { onChange, onClear } = renderBar({ educationSystem: "IB" });

    await user.click(
      screen.getByRole("button", { name: "Remove Education system filter" }),
    );
    expect(onChange).toHaveBeenCalledWith({ educationSystem: undefined });

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});
