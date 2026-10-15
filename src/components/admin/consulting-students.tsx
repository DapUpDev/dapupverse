"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiBaseUrl, apiFetch } from "@/lib/api/client";
import { useAuthIdentity } from "@/lib/auth/use-auth-identity";
import type { Mentor } from "@/lib/domain/types";
import { mentorRepository } from "@/lib/repositories";

/**
 * Admin: which students are in the Premier Fellowship (the USA applications consulting package, billed monthly) (only they get the
 * weekly check-in) and which mentors are on each one's team. Saves on
 * every change. Live API only: consulting data has no mock.
 */

export type ConsultingStudent = {
  id: string;
  fullName: string;
  school: string;
  yearLevel: string;
  email: string | null;
  consulting: boolean;
  mentorIds: string[];
};

const MAX_MENTORS = 3;

export function ConsultingStudents() {
  const { isLoaded, identity } = useAuthIdentity();
  const signedIn = isLoaded && identity.isAuthenticated;
  const [students, setStudents] = useState<ConsultingStudent[] | null>(null);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!signedIn || !apiBaseUrl()) return;
    Promise.all([
      apiFetch<ConsultingStudent[]>("/admin/consulting/students"),
      mentorRepository.list(),
    ]).then(
      ([s, m]) => {
        setStudents(s);
        setMentors(m);
      },
      () => setFailed(true),
    );
  }, [signedIn]);

  if (!apiBaseUrl() || failed) {
    return (
      <p className="sheet p-5 text-muted-foreground">
        {failed
          ? "Couldn't load students. Refresh to try again."
          : "Premier Fellowship students are managed on the live site."}
      </p>
    );
  }
  if (!students) {
    return (
      <div className="sheet flex flex-col gap-3 p-5">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
      </div>
    );
  }
  if (students.length === 0) {
    return (
      <p className="sheet p-5 text-muted-foreground">
        No students have filled in a profile yet.
      </p>
    );
  }

  const nameOf = (id: string) =>
    mentors.find((m) => m.id === id)?.name ?? "Unlisted mentor";

  const save = async (
    before: ConsultingStudent,
    change: Partial<ConsultingStudent>,
  ) => {
    const next = { ...before, ...change };
    const put = (row: ConsultingStudent) =>
      setStudents((list) =>
        (list ?? []).map((s) => (s.id === row.id ? row : s)),
      );
    put(next);
    try {
      put(
        await apiFetch<ConsultingStudent>(
          `/admin/consulting/students/${encodeURIComponent(before.id)}`,
          {
            method: "PUT",
            body: { consulting: next.consulting, mentorIds: next.mentorIds },
          },
        ),
      );
    } catch {
      put(before);
      toast.error(`Couldn't save ${before.fullName || "that student"}.`);
    }
  };

  return (
    <ul className="sheet divide-y">
      {students.map((student) => {
        const id = `consulting-${student.id}`;
        const addable = mentors.filter(
          (m) => !student.mentorIds.includes(m.id),
        );
        return (
          <li
            key={student.id}
            className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-medium">
                {student.fullName || "Unnamed student"}
              </p>
              <p className="text-sm text-muted-foreground">
                {[student.school, student.yearLevel, student.email]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="flex flex-col gap-2.5 sm:w-80 sm:shrink-0">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={id}
                  checked={student.consulting}
                  onCheckedChange={(checked) =>
                    save(student, { consulting: checked === true })
                  }
                />
                <Label htmlFor={id} className="cursor-pointer font-normal">
                  In the Premier Fellowship
                </Label>
              </div>
              {student.consulting ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {student.mentorIds.map((mentorId) => (
                    <span
                      key={mentorId}
                      className="inline-flex items-center gap-1 rounded-full bg-mark py-1 pr-1 pl-2.5 text-sm"
                    >
                      {nameOf(mentorId)}
                      <button
                        type="button"
                        aria-label={`Remove ${nameOf(mentorId)} from the team`}
                        onClick={() =>
                          save(student, {
                            mentorIds: student.mentorIds.filter(
                              (m) => m !== mentorId,
                            ),
                          })
                        }
                        className="flex size-5 items-center justify-center rounded-full transition-colors duration-150 hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        <X className="size-3.5" aria-hidden />
                      </button>
                    </span>
                  ))}
                  {student.mentorIds.length < MAX_MENTORS &&
                  addable.length > 0 ? (
                    <Select
                      value={null}
                      onValueChange={(value: string | null) => {
                        if (value)
                          save(student, {
                            mentorIds: [...student.mentorIds, value],
                          });
                      }}
                    >
                      <SelectTrigger
                        aria-label={`Add a mentor to ${student.fullName || "this student"}'s team`}
                        className="h-8 text-sm"
                      >
                        <SelectValue placeholder="Add mentor" />
                      </SelectTrigger>
                      <SelectContent>
                        {addable.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                  {student.mentorIds.length === 0 ? (
                    <span className="text-sm text-subtle">No mentors yet</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
