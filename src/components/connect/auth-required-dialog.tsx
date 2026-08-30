"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ButtonLink } from "@/components/ui/button-link";
import { safeInternalPath } from "@/lib/auth/redirects";

/**
 * Shown when a visitor tries to connect with a mentor. Links into the real
 * Clerk sign-up/sign-in flows, carrying a validated internal return path so
 * the connect journey resumes on the mentor page afterwards.
 */
export function AuthRequiredDialog({
  open,
  onOpenChange,
  mentorName,
  returnTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mentorName: string;
  /** Internal path to return to after authentication. */
  returnTo: string;
}) {
  const dest = safeInternalPath(returnTo) ?? "/mentors";
  const redirect = `redirect_url=${encodeURIComponent(dest)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>You&rsquo;ll need an account to connect</DialogTitle>
          <DialogDescription>
            Create a free student account or sign in to send {mentorName} a
            connection request. We&rsquo;ll bring you right back here.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 sm:flex-row">
          <ButtonLink className="flex-1" href={`/sign-up?${redirect}`}>
            Create account
          </ButtonLink>
          <ButtonLink
            variant="outline"
            className="flex-1"
            href={`/sign-in?${redirect}`}
          >
            Sign in
          </ButtonLink>
        </div>
        <p className="text-xs text-muted-foreground">
          Every new account starts as a student — it takes under a minute.
        </p>
      </DialogContent>
    </Dialog>
  );
}
