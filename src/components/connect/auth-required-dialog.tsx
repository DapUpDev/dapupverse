"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useDemoSession } from "@/lib/demo-session/provider";

/**
 * Shown when a visitor tries to connect with a mentor. The Create account /
 * Sign in actions are future-auth UI only — real authentication arrives with
 * Clerk in a later milestone, so they are intentionally inert here.
 */
export function AuthRequiredDialog({
  open,
  onOpenChange,
  mentorName,
  onPreviewAsStudent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mentorName: string;
  onPreviewAsStudent: () => void;
}) {
  const { previewEnabled } = useDemoSession();

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
          <Button className="flex-1" disabled>
            Create account
          </Button>
          <Button variant="outline" className="flex-1" disabled>
            Sign in
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Accounts aren&rsquo;t enabled yet — sign-up and sign-in arrive in an
          upcoming release.
        </p>
        {previewEnabled ? (
          <>
            <Separator />
            <DialogFooter className="sm:flex-col sm:items-stretch sm:gap-2">
              <Button variant="secondary" onClick={onPreviewAsStudent}>
                Preview as student
              </Button>
              <p className="text-xs text-muted-foreground">
                Demo session only: continues this flow with mock data.
              </p>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
