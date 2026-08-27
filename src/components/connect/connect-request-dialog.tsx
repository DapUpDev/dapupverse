"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { ConnectionPurpose, Mentor } from "@/lib/domain/types";
import { CONNECTION_PURPOSES } from "@/lib/domain/types";
import {
  connectionRepository,
  BlockedPairError,
  DuplicateRequestError,
} from "@/lib/repositories";

const MESSAGE_MIN_LENGTH = 20;
const MESSAGE_MAX_LENGTH = 600;

/** The connection request form: purpose + short message, nothing else. */
export function ConnectRequestDialog({
  open,
  onOpenChange,
  mentor,
  studentId,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mentor: Mentor;
  studentId: string;
  onSubmitted: () => void;
}) {
  const [purpose, setPurpose] = useState<ConnectionPurpose | null>(null);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<{ purpose?: string; message?: string }>(
    {},
  );
  const [submitting, setSubmitting] = useState(false);

  const validate = (): boolean => {
    const next: { purpose?: string; message?: string } = {};
    if (!purpose) next.purpose = "Choose what you'd like help with.";
    const trimmed = message.trim();
    if (trimmed.length < MESSAGE_MIN_LENGTH) {
      next.message = `Write at least ${MESSAGE_MIN_LENGTH} characters so ${mentor.name} knows how to help.`;
    } else if (trimmed.length > MESSAGE_MAX_LENGTH) {
      next.message = `Keep your message under ${MESSAGE_MAX_LENGTH} characters.`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate() || !purpose) return;
    setSubmitting(true);
    try {
      await connectionRepository.createRequest({
        mentorId: mentor.id,
        studentId,
        purpose,
        message: message.trim(),
      });
      onOpenChange(false);
      setPurpose(null);
      setMessage("");
      setErrors({});
      toast.success("Request sent", {
        description: `Your request to ${mentor.name} is pending. Track it in Connections.`,
      });
      onSubmitted();
    } catch (error) {
      if (error instanceof DuplicateRequestError) {
        toast.error("Request already active", {
          description: error.message,
        });
        onOpenChange(false);
      } else if (error instanceof BlockedPairError) {
        toast.error("Request unavailable", { description: error.message });
        onOpenChange(false);
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect with {mentor.name}</DialogTitle>
          <DialogDescription>
            Tell {mentor.name} what you&rsquo;re looking for. They&rsquo;ll see
            your profile alongside this request.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="request-purpose">Purpose</Label>
            <Select
              value={purpose}
              onValueChange={(value: string | null) => {
                setPurpose((value as ConnectionPurpose | null) ?? null);
                setErrors((prev) => ({ ...prev, purpose: undefined }));
              }}
            >
              <SelectTrigger
                id="request-purpose"
                aria-invalid={Boolean(errors.purpose)}
                aria-describedby={
                  errors.purpose ? "request-purpose-error" : undefined
                }
                className="w-full"
              >
                <SelectValue placeholder="What do you need help with?" className="data-placeholder:text-muted-foreground" />
              </SelectTrigger>
              <SelectContent>
                {CONNECTION_PURPOSES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.purpose ? (
              <p
                id="request-purpose-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {errors.purpose}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="request-message">Short message or question</Label>
            <Textarea
              id="request-message"
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
                setErrors((prev) => ({ ...prev, message: undefined }));
              }}
              rows={4}
              maxLength={MESSAGE_MAX_LENGTH + 100}
              placeholder="e.g. I'm applying to CS programs this year and would love feedback on my main essay."
              aria-invalid={Boolean(errors.message)}
              aria-describedby={
                errors.message ? "request-message-error" : "request-message-hint"
              }
            />
            {errors.message ? (
              <p
                id="request-message-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {errors.message}
              </p>
            ) : (
              <p
                id="request-message-hint"
                className="text-xs text-muted-foreground"
              >
                {MESSAGE_MIN_LENGTH}–{MESSAGE_MAX_LENGTH} characters.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Sending…" : "Send request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
