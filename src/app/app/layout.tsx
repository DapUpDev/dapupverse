import type { ReactNode } from "react";
import { AccountAccessNotice } from "@/components/app/account-access-notice";
import { isPreviewEnvironment } from "@/lib/demo-session/preview";

/**
 * Gate for the future authenticated area. On production (no preview
 * environment), account pages clearly state that access is not enabled yet —
 * there is no role selection and no fake authenticated experience.
 */
export default function AppAreaLayout({ children }: { children: ReactNode }) {
  if (!isPreviewEnvironment()) {
    return <AccountAccessNotice />;
  }
  return <>{children}</>;
}
