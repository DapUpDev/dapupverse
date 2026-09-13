"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AvatarUploadField } from "@/components/profile/avatar-upload-field";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import {
  loadConnectionIntent,
  useHasConnectionIntent,
} from "@/lib/connection-intent";
import {
  EDUCATION_SYSTEMS,
  isStudentProfileComplete,
  type EducationSystem,
  type StudentProfile,
} from "@/lib/domain/types";
import { studentProfileRepository } from "@/lib/repositories";

type FormState = {
  fullName: string;
  school: string;
  yearLevel: string;
  educationSystem: EducationSystem | null;
  subjects: string;
  biography: string;
};

type FormErrors = Partial<Record<"fullName" | "school" | "yearLevel" | "educationSystem", string>>;

function toFormState(profile: StudentProfile): FormState {
  return {
    fullName: profile.fullName,
    school: profile.school,
    yearLevel: profile.yearLevel,
    educationSystem: profile.educationSystem,
    subjects: profile.subjects.join(", "),
    biography: profile.biography,
  };
}

export function StudentProfileForm({ profile }: { profile: StudentProfile }) {
  const router = useRouter();
  const complete = isStudentProfileComplete(profile);
  const [editing, setEditing] = useState(!complete);
  const [form, setForm] = useState<FormState>(() => toFormState(profile));
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const pendingIntent = useHasConnectionIntent();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!form.fullName.trim()) next.fullName = "Enter your full name.";
    if (!form.school.trim()) next.school = "Enter your school.";
    if (!form.yearLevel.trim()) next.yearLevel = "Enter your year level.";
    if (!form.educationSystem)
      next.educationSystem = "Choose your education system.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await studentProfileRepository.update({
        studentId: profile.id,
        fullName: form.fullName.trim(),
        school: form.school.trim(),
        yearLevel: form.yearLevel.trim(),
        educationSystem: form.educationSystem,
        subjects: form.subjects
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        biography: form.biography.trim(),
      });
      toast.success("Profile saved");
      setEditing(false);
      const intent = loadConnectionIntent();
      if (intent) {
        toast("Continuing your request", {
          description: "Taking you back to the mentor you picked.",
        });
        router.push(intent.returnTo);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Your profile</h1>
        {complete ? (
          <Badge>Profile complete</Badge>
        ) : (
          <Badge variant="secondary">Profile incomplete</Badge>
        )}
      </div>

      {pendingIntent && !complete ? (
        <Alert>
          <AlertTitle>Finish your profile to send your request</AlertTitle>
          <AlertDescription>
            Complete the required fields below and we&rsquo;ll take you back to
            the mentor you picked.
          </AlertDescription>
        </Alert>
      ) : null}

      {editing ? (
        <form onSubmit={handleSave} noValidate className="flex flex-col gap-5">
          <AvatarUploadField
            name={form.fullName}
            idPrefix="student"
            userId={profile.id}
            avatarUrl={profile.avatarUrl}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="student-name">Full name</Label>
              <Input
                id="student-name"
                value={form.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                aria-invalid={Boolean(errors.fullName)}
                aria-describedby={
                  errors.fullName ? "student-name-error" : undefined
                }
              />
              {errors.fullName ? (
                <p
                  id="student-name-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {errors.fullName}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="student-school">School</Label>
              <Input
                id="student-school"
                value={form.school}
                onChange={(e) => set("school", e.target.value)}
                aria-invalid={Boolean(errors.school)}
                aria-describedby={
                  errors.school ? "student-school-error" : undefined
                }
              />
              {errors.school ? (
                <p
                  id="student-school-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {errors.school}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="student-year">Year level</Label>
              <Input
                id="student-year"
                placeholder="e.g. Year 13, Grade 12, DP2"
                value={form.yearLevel}
                onChange={(e) => set("yearLevel", e.target.value)}
                aria-invalid={Boolean(errors.yearLevel)}
                aria-describedby={
                  errors.yearLevel ? "student-year-error" : undefined
                }
              />
              {errors.yearLevel ? (
                <p
                  id="student-year-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {errors.yearLevel}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="student-system">Education system</Label>
              <Select
                value={form.educationSystem}
                onValueChange={(value: string | null) =>
                  set(
                    "educationSystem",
                    (value as EducationSystem | null) ?? null,
                  )
                }
              >
                <SelectTrigger
                  id="student-system"
                  className="w-full"
                  aria-invalid={Boolean(errors.educationSystem)}
                  aria-describedby={
                    errors.educationSystem ? "student-system-error" : undefined
                  }
                >
                  <SelectValue placeholder="Choose a system" />
                </SelectTrigger>
                <SelectContent>
                  {EDUCATION_SYSTEMS.map((system) => (
                    <SelectItem key={system} value={system}>
                      {system}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.educationSystem ? (
                <p
                  id="student-system-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {errors.educationSystem}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="student-subjects">Subjects &amp; interests</Label>
            <Input
              id="student-subjects"
              placeholder="e.g. Mathematics, Physics"
              value={form.subjects}
              onChange={(e) => set("subjects", e.target.value)}
              aria-describedby="student-subjects-hint"
            />
            <p
              id="student-subjects-hint"
              className="text-xs text-muted-foreground"
            >
              Separate with commas.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="student-bio">Short biography</Label>
            <Textarea
              id="student-bio"
              rows={4}
              value={form.biography}
              onChange={(e) => set("biography", e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </Button>
            {complete ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setForm(toFormState(profile));
                  setErrors({});
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <ProfileAvatar
                name={profile.fullName}
                avatarUrl={profile.avatarUrl}
                className="size-12 border border-chrome/30"
              />
              <CardTitle className="text-lg">{profile.fullName}</CardTitle>
            </div>
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit profile
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="font-medium">School</p>
              <p className="text-muted-foreground">{profile.school}</p>
            </div>
            <div>
              <p className="font-medium">Year level</p>
              <p className="text-muted-foreground">{profile.yearLevel}</p>
            </div>
            <div>
              <p className="font-medium">Education system</p>
              <p className="text-muted-foreground">
                {profile.educationSystem ?? "—"}
              </p>
            </div>
            <div>
              <p className="font-medium">Subjects &amp; interests</p>
              <p className="text-muted-foreground">
                {profile.subjects.length > 0
                  ? profile.subjects.join(", ")
                  : "—"}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="font-medium">Biography</p>
              <p className="text-muted-foreground">
                {profile.biography || "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
