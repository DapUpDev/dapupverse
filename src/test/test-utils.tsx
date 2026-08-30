import type { ReactNode } from "react";
import { render, type RenderResult } from "@testing-library/react";
import { setTestIdentity, type TestRole } from "@/test/auth-fixtures";

/**
 * Render helper for component tests. The auth hook is mocked globally in
 * setup.ts to return the fixture identity selected here.
 */
export function renderWithProviders(
  ui: ReactNode,
  { role = "visitor" }: { role?: TestRole } = {},
): RenderResult {
  setTestIdentity(role);
  return render(<>{ui}</>);
}
