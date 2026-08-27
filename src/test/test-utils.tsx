import { useEffect, type ReactNode } from "react";
import { render, type RenderResult } from "@testing-library/react";
import { DemoSessionProvider, useDemoSession } from "@/lib/demo-session/provider";
import type { DemoRole } from "@/lib/demo-session/types";

/** Test helper: switches the demo role after mount. */
export function SetRole({ role }: { role: DemoRole }) {
  const { setRole } = useDemoSession();
  useEffect(() => {
    setRole(role);
  }, [role, setRole]);
  return null;
}

export function renderWithProviders(
  ui: ReactNode,
  {
    previewEnabled = true,
    role,
  }: { previewEnabled?: boolean; role?: DemoRole } = {},
): RenderResult {
  return render(
    <DemoSessionProvider previewEnabled={previewEnabled}>
      {role ? <SetRole role={role} /> : null}
      {ui}
    </DemoSessionProvider>,
  );
}
