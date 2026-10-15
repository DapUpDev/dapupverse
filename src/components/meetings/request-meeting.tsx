"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type {
  Meeting,
  MeetingPerson,
} from "@/components/meetings/meeting-types";
import { useApiGet } from "@/components/meetings/use-api";
import { apiFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils";

/**
 * Ask for a meeting outside the weekly check-in: choose people you work
 * with and a length. Everyone gets a link to mark when they're free over
 * the next week, and a mentor books a time that works for all.
 */

const LENGTHS = [15, 30, 45, 60];

export function RequestMeeting() {
  const router = useRouter();
  const [people] = useApiGet<MeetingPerson[]>("/meetings/people");
  const [chosen, setChosen] = useState<string[]>([]);
  const [minutes, setMinutes] = useState(30);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (chosen.length === 0) return;
    setBusy(true);
    try {
      const meeting = await apiFetch<Meeting>("/meetings", {
        method: "POST",
        body: {
          peopleIds: chosen,
          minutes,
          title: title.trim(),
          note: note.trim(),
        },
      });
      toast.success("Request sent. Now mark when you're free.");
      router.push(`/app/meetings/${meeting.id}`);
    } catch {
      toast.error("Couldn't send the request. Try again.");
      setBusy(false);
    }
  };

  if (people.state === "loading") {
    return <Skeleton className="h-64 w-full" />;
  }
  const options = people.state === "ready" ? people.data : [];
  if (options.length === 0) {
    return (
      <p className="sheet p-6 text-muted-foreground">
        Once you&rsquo;re connected with a mentor (or on a Premier Fellowship
        team), you can request meetings with them here.
      </p>
    );
  }

  return (
    <form
      onSubmit={send}
      className="sheet flex flex-col gap-7 p-6 shadow-sheet sm:p-8"
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Who</legend>
        {options.map((person) => {
          const id = `person-${person.id}`;
          return (
            <div key={person.id} className="flex items-center gap-2">
              <Checkbox
                id={id}
                checked={chosen.includes(person.id)}
                onCheckedChange={(checked) =>
                  setChosen((list) =>
                    checked === true
                      ? [...list, person.id]
                      : list.filter((p) => p !== person.id),
                  )
                }
              />
              <Label
                htmlFor={id}
                className="cursor-pointer flex-wrap gap-x-2 gap-y-0 font-normal"
              >
                {person.name}
                <span className="text-sm text-muted-foreground">
                  {person.role === "mentor" ? "Mentor" : "Student"}
                </span>
              </Label>
            </div>
          );
        })}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">How long</legend>
        <div className="grid max-w-sm grid-cols-4 gap-2">
          {LENGTHS.map((length) => (
            <label
              key={length}
              className={cn(
                "cursor-pointer rounded-[6px] border border-foreground/15 py-2 text-center text-sm transition-[background-color,border-color] duration-150 ease-out has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                minutes === length
                  ? "border-transparent bg-mark"
                  : "hover:border-foreground/40",
              )}
            >
              <input
                type="radio"
                name="minutes"
                value={length}
                checked={minutes === length}
                onChange={() => setMinutes(length)}
                className="sr-only"
              />
              {length} min
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="meeting-title">Title (optional)</Label>
        <Input
          id="meeting-title"
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Essay plan"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="meeting-note">Note (optional)</Label>
        <Textarea
          id="meeting-note"
          rows={3}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What you'd like to cover."
        />
      </div>
      <div>
        <Button type="submit" disabled={chosen.length === 0 || busy}>
          {busy ? "Sending…" : "Send and mark my times"}
        </Button>
      </div>
    </form>
  );
}
