"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiBaseUrl, apiFetch } from "@/lib/api/client";
import { useAuthIdentity } from "@/lib/auth/use-auth-identity";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The weekly check-in, reached from the Monday email. It talks to the API
 * directly: check-ins only exist on the live backend, so there is no mock.
 * Answered once; submitting queues the triage agent on the API side.
 */

export type CheckIn = {
  id: string;
  weekStart: string;
  status: "sent" | "answered" | "expired";
  closesAt: string;
  progress: string;
  blockers: string;
  confidence: number | null;
  helpWanted: string;
  answeredAt: string | null;
};

const MAX = 2000;
const CONFIDENCE = [
  [1, "Not at all"],
  [2, "A little"],
  [3, "Somewhat"],
  [4, "Mostly"],
  [5, "Very"],
] as const;

type Load =
  | { state: "loading" }
  | { state: "missing" }
  | { state: "error" }
  | { state: "ready"; checkIn: CheckIn };

export function CheckInForm({ checkInId }: { checkInId: string }) {
  // No API configured (local mocks): check-ins only exist on the backend.
  const [load, setLoad] = useState<Load>(() =>
    apiBaseUrl() ? { state: "loading" } : { state: "missing" },
  );

  // Wait for Clerk: before it has loaded, requests go out without the
  // session token and the API answers 401.
  const { isLoaded, identity } = useAuthIdentity();
  const signedIn = isLoaded && identity.isAuthenticated;

  useEffect(() => {
    if (!apiBaseUrl() || !signedIn) return;
    apiFetch<CheckIn>(`/me/check-ins/${encodeURIComponent(checkInId)}`).then(
      (checkIn) => setLoad({ state: "ready", checkIn }),
      (error) =>
        setLoad({
          state:
            error instanceof ApiError && [403, 404].includes(error.status)
              ? "missing"
              : "error",
        }),
    );
  }, [checkInId, signedIn]);

  if (load.state === "loading") {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (load.state !== "ready") {
    return (
      <Notice
        title={
          load.state === "missing"
            ? "Check-in not found"
            : "Something went wrong"
        }
      >
        {load.state === "missing"
          ? "This check-in doesn't belong to the account you're signed in with. Check you're using your student account."
          : "We couldn't load your check-in. Refresh the page to try again."}
      </Notice>
    );
  }

  const { checkIn } = load;
  const open =
    checkIn.status === "sent" && new Date(checkIn.closesAt) > new Date();
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="label-caps text-subtle">
          {/* A date, not an instant: read it as local midnight so it never shifts a day. */}
          Week of {formatDate(`${checkIn.weekStart}T00:00:00`)}
        </p>
        <h1 className="page-title">Weekly check-in</h1>
        {open ? (
          <p className="text-muted-foreground">
            About two minutes. Closes {formatDate(checkIn.closesAt)}.
          </p>
        ) : null}
      </header>
      {checkIn.status === "answered" ? (
        <Answered checkIn={checkIn} />
      ) : open ? (
        <AnswerForm
          checkIn={checkIn}
          onAnswered={(answered) =>
            setLoad({ state: "ready", checkIn: answered })
          }
        />
      ) : (
        <Notice title="This check-in has closed">
          The next one arrives in your inbox on Monday.
        </Notice>
      )}
    </div>
  );
}

function Notice({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="sheet flex flex-col items-start gap-3 p-6 shadow-sheet sm:p-8">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="text-muted-foreground">{children}</p>
      <ButtonLink href="/app" variant="outline" size="sm">
        Back to DapUp
      </ButtonLink>
    </div>
  );
}

function Answered({ checkIn }: { checkIn: CheckIn }) {
  const rows: [string, string][] = [
    ["What you got done", checkIn.progress],
    ["What's blocking you", checkIn.blockers || "Nothing"],
    ["Confidence about your next deadline", `${checkIn.confidence} of 5`],
    ["What you'd like help with", checkIn.helpWanted || "Nothing"],
  ];
  return (
    <div className="sheet flex flex-col gap-5 p-6 shadow-sheet sm:p-8">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-semibold">
          Thanks, it&rsquo;s with your mentor
        </h2>
        <p className="text-muted-foreground">
          If you need a meeting this week, you&rsquo;ll hear about it soon.
        </p>
      </div>
      <dl className="flex flex-col gap-4">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1">
            <dt className="label-caps text-subtle">{label}</dt>
            <dd className="text-pretty whitespace-pre-line">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function AnswerForm({
  checkIn,
  onAnswered,
}: {
  checkIn: CheckIn;
  onAnswered: (checkIn: CheckIn) => void;
}) {
  const [progress, setProgress] = useState("");
  const [blockers, setBlockers] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [helpWanted, setHelpWanted] = useState("");
  const [errors, setErrors] = useState<{
    progress?: string;
    confidence?: string;
    form?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!progress.trim())
      next.progress = "Tell your mentor what you got done, even if it's small.";
    if (!confidence) next.confidence = "Choose how confident you feel.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      onAnswered(
        await apiFetch<CheckIn>(
          `/me/check-ins/${encodeURIComponent(checkIn.id)}`,
          {
            method: "PUT",
            body: {
              progress: progress.trim(),
              blockers: blockers.trim(),
              confidence,
              helpWanted: helpWanted.trim(),
            },
          },
        ),
      );
    } catch (error) {
      setErrors({
        form:
          error instanceof ApiError && error.status === 409
            ? error.message
            : "We couldn't send your check-in. Check your connection and try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="sheet flex flex-col gap-6 p-6 shadow-sheet sm:p-8"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="checkin-progress">
          What did you get done this week?
        </Label>
        <Textarea
          id="checkin-progress"
          rows={4}
          maxLength={MAX}
          value={progress}
          onChange={(e) => {
            setProgress(e.target.value);
            setErrors((prev) => ({ ...prev, progress: undefined }));
          }}
          placeholder="e.g. Finished my essay draft and two maths past papers."
          aria-invalid={Boolean(errors.progress)}
          aria-describedby={
            errors.progress ? "checkin-progress-error" : undefined
          }
        />
        <FieldError id="checkin-progress-error" message={errors.progress} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="checkin-blockers">What&rsquo;s blocking you?</Label>
        <Textarea
          id="checkin-blockers"
          rows={3}
          maxLength={MAX}
          value={blockers}
          onChange={(e) => setBlockers(e.target.value)}
          aria-describedby="checkin-blockers-hint"
        />
        <p id="checkin-blockers-hint" className="text-sm text-subtle">
          Leave it blank if nothing is.
        </p>
      </div>

      <fieldset
        className="flex flex-col gap-2"
        aria-describedby={
          errors.confidence ? "checkin-confidence-error" : undefined
        }
      >
        <legend className="mb-2 text-sm font-medium">
          How confident are you about your next deadline?
        </legend>
        <div className="grid grid-cols-5 gap-2">
          {CONFIDENCE.map(([value, label]) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-0.5 rounded-[6px] border border-foreground/15 px-1 py-2.5 text-center transition-[background-color,border-color,scale] duration-150 ease-out active:scale-[0.97] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                confidence === value
                  ? "border-transparent bg-mark"
                  : "hover:border-foreground/40",
              )}
            >
              <input
                type="radio"
                name="confidence"
                value={value}
                checked={confidence === value}
                onChange={() => {
                  setConfidence(value);
                  setErrors((prev) => ({ ...prev, confidence: undefined }));
                }}
                className="sr-only"
              />
              <span className="font-display text-xl">{value}</span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </label>
          ))}
        </div>
        <FieldError id="checkin-confidence-error" message={errors.confidence} />
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="checkin-help">What would you like help with?</Label>
        <Textarea
          id="checkin-help"
          rows={3}
          maxLength={MAX}
          value={helpWanted}
          onChange={(e) => setHelpWanted(e.target.value)}
          placeholder="e.g. A second pair of eyes on my essay before I submit."
        />
      </div>

      <FieldError id="checkin-form-error" message={errors.form} />
      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Sending…" : "Send check-in"}
        </Button>
      </div>
    </form>
  );
}
