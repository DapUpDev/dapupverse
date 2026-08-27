import type { ReactNode } from "react";
import { AccountAccessNotice } from "@/components/app/account-access-notice";
import { isPreviewEnvironment } from "@/lib/demo-session/preview";

/** Same production gate as /app: no accounts exist yet in production. */
export default function AdminAreaLayout({ children }: { children: ReactNode }) {
  if (!isPreviewEnvironment()) {
    return <AccountAccessNotice />;
  }
  return <>{children}</>;
}
