import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import AdminPage from "@/app/admin/page";
import { renderWithProviders } from "@/test/test-utils";

/**
 * Access denial for /admin is enforced server-side in src/app/admin/layout.tsx
 * via requireAdmin() (covered by the guards' claim tests and e2e); this test
 * covers the page content itself.
 */
describe("AdminPage", () => {
  it("renders the mentor roster with private rates for an admin", async () => {
    renderWithProviders(<AdminPage />, { role: "mentor-admin" });
    expect(await screen.findByText(/mentor roster/i)).toBeInTheDocument();
    expect(await screen.findByText("$40 USD")).toBeInTheDocument();
    expect(
      screen.getByText(/distinct from account type/i),
    ).toBeInTheDocument();
  });
});
