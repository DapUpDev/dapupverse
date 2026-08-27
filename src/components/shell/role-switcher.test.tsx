import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { RoleSwitcher } from "@/components/shell/role-switcher";
import { renderWithProviders } from "@/test/test-utils";

describe("RoleSwitcher", () => {
  it("renders nothing when preview is disabled (production)", () => {
    renderWithProviders(<RoleSwitcher />, { previewEnabled: false });
    expect(screen.queryByTestId("role-switcher")).not.toBeInTheDocument();
  });

  it("renders the preview-role selector when preview is enabled", () => {
    renderWithProviders(<RoleSwitcher />, { previewEnabled: true });
    expect(screen.getByTestId("role-switcher")).toHaveTextContent(
      "Preview role: Visitor",
    );
  });
});
