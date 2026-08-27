"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useDemoSession } from "@/lib/demo-session/provider";
import { DEMO_ROLES, isDemoRole } from "@/lib/demo-session/types";
import { toast } from "sonner";

/**
 * Preview-role selector. Rendered only when the server has decided this is a
 * development or Vercel preview environment; production never shows it.
 */
export function RoleSwitcher() {
  const { session, previewEnabled, setRole, resetDemoData } = useDemoSession();

  if (!previewEnabled) return null;

  const currentLabel =
    DEMO_ROLES.find((r) => r.value === session.role)?.label ?? "Visitor";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" data-testid="role-switcher" />
        }
      >
        Preview role: {currentLabel}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            Demo session
            <span className="block text-xs font-normal text-muted-foreground">
              Preview-only. Not authentication.
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={session.role}
          onValueChange={(value) => {
            if (isDemoRole(value)) setRole(value);
          }}
        >
          {DEMO_ROLES.map((role) => (
            <DropdownMenuRadioItem key={role.value} value={role.value}>
              {role.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            resetDemoData();
            toast("Demo data reset", {
              description: "All mock data is back to its starting state.",
            });
          }}
        >
          Reset demo data
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
