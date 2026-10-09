"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AvatarUploadField } from "@/components/profile/avatar-upload-field";
import { facts, idPhoto, ProfileAvatar } from "@/components/profile/profile-avatar";
import {
  EDUCATION_SYSTEMS,
  SERVICE_TYPES,
  type EducationSystem,
  type MentorProfile,
  type ServiceType,
} from "@/lib/domain/types";
import { mentorRepository } from "@/lib/repositories";

type FormState = {
  name: string;
  university: string;
  major: string;
  countryRegion: string;
  biography: string;
  services: ServiceType[];
  subjects: string;
  educationSystems: EducationSystem[];
  price: string;
};

type FormErrors = Partial<
  Record<"name" | "university" | "major" | "countryRegion" | "price", string>
>;

function toFormState(profile: MentorProfile): FormState {
  return {
    name: profile.name,
    university: profile.university,
    major: profile.major,
    countryRegion: profile.countryRegion,
    biography: profile.biography,
    services: profile.services,
    subjects: profile.subjects.join(", "),
    educationSystems: profile.educationSystems,
    price: String(profile.privatePriceUsd),
  };
}

function CheckboxGroup<T extends string>({
  legend,
  options,
  selected,
  onToggle,
  idPrefix,
}: {
  legend: string;
  options: readonly T[];
  selected: T[];
  onToggle: (option: T, checked: boolean) => void;
  idPrefix: string;
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm leading-none font-medium">
        {legend}
      </legend>
      <div className="grid gap-x-4 sm:grid-cols-2 md:grid-cols-3">
        {options.map((option) => {
          const id = `${idPrefix}-${option.replace(/\s+/g, "-").toLowerCase()}`;
          return (
            // The whole row toggles (the label covers it); a chosen option
            // gets a highlighter stroke over its words.
            <div
              key={option}
              className="group relative flex min-h-10 items-center gap-1.5"
            >
              <Checkbox
                id={id}
                className="group-hover:border-foreground"
                checked={selected.includes(option)}
                onCheckedChange={(checked) =>
                  onToggle(option, checked === true)
                }
              />
              <Label
                htmlFor={id}
                className="cursor-pointer rounded-[3px] px-1 py-0.5 leading-snug font-normal transition-colors duration-150 peer-data-checked:bg-mark after:absolute after:inset-0"
              >
                {option}
              </Label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

export function MentorProfileForm({ profile }: { profile: MentorProfile }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(() => toFormState(profile));
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!form.name.trim()) next.name = "Enter your full name.";
    if (!form.university.trim()) next.university = "Enter your university or school.";
    if (!form.major.trim()) next.major = "Enter your major or expertise.";
    if (!form.countryRegion.trim())
      next.countryRegion = "Enter your country or region.";
    const price = Number(form.price);
    if (form.price.trim() === "" || Number.isNaN(price) || price < 0) {
      next.price = "Enter a price of 0 or more.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await mentorRepository.updateProfile({
        mentorId: profile.id,
        name: form.name.trim(),
        university: form.university.trim(),
        major: form.major.trim(),
        countryRegion: form.countryRegion.trim(),
        biography: form.biography.trim(),
        services: form.services,
        subjects: form.subjects
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        educationSystems: form.educationSystems,
        privatePriceUsd: Number(form.price),
      });
      toast.success("Profile saved");
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="page-title">
          Your profile
        </h1>
        <Badge variant="secondary">Mentor</Badge>
      </div>

      {editing ? (
        <form
          onSubmit={handleSave}
          noValidate
          className="sheet flex flex-col gap-5 p-6 shadow-sheet sm:p-8"
        >
          <AvatarUploadField
            name={form.name}
            idPrefix="mentor"
            userId={profile.id}
            avatarUrl={profile.avatarUrl}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="mentor-name">Full name</Label>
              <Input
                id="mentor-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? "mentor-name-error" : undefined}
              />
              <FieldError id="mentor-name-error" message={errors.name} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="mentor-university">University / school</Label>
              <Input
                id="mentor-university"
                value={form.university}
                onChange={(e) => set("university", e.target.value)}
                aria-invalid={Boolean(errors.university)}
                aria-describedby={
                  errors.university ? "mentor-university-error" : undefined
                }
              />
              <FieldError id="mentor-university-error" message={errors.university} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="mentor-major">Major or expertise</Label>
              <Input
                id="mentor-major"
                value={form.major}
                onChange={(e) => set("major", e.target.value)}
                aria-invalid={Boolean(errors.major)}
                aria-describedby={
                  errors.major ? "mentor-major-error" : undefined
                }
              />
              <FieldError id="mentor-major-error" message={errors.major} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="mentor-country">Country / region</Label>
              <Input
                id="mentor-country"
                value={form.countryRegion}
                onChange={(e) => set("countryRegion", e.target.value)}
                aria-invalid={Boolean(errors.countryRegion)}
                aria-describedby={
                  errors.countryRegion ? "mentor-country-error" : undefined
                }
              />
              <FieldError id="mentor-country-error" message={errors.countryRegion} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="mentor-bio">Biography</Label>
            <Textarea
              id="mentor-bio"
              rows={4}
              value={form.biography}
              onChange={(e) => set("biography", e.target.value)}
            />
          </div>

          <CheckboxGroup
            legend="Services"
            options={SERVICE_TYPES}
            selected={form.services}
            idPrefix="service"
            onToggle={(option, checked) =>
              set(
                "services",
                checked
                  ? [...form.services, option]
                  : form.services.filter((s) => s !== option),
              )
            }
          />

          <div className="flex flex-col gap-2">
            <Label htmlFor="mentor-subjects">Subjects &amp; specialties</Label>
            <Input
              id="mentor-subjects"
              value={form.subjects}
              onChange={(e) => set("subjects", e.target.value)}
              aria-describedby="mentor-subjects-hint"
            />
            <p id="mentor-subjects-hint" className="text-sm text-subtle">
              Separate with commas.
            </p>
          </div>

          <CheckboxGroup
            legend="Education systems supported"
            options={EDUCATION_SYSTEMS}
            selected={form.educationSystems}
            idPrefix="system"
            onToggle={(option, checked) =>
              set(
                "educationSystems",
                checked
                  ? [...form.educationSystems, option]
                  : form.educationSystems.filter((s) => s !== option),
              )
            }
          />

          {/* Perforated off: everything above is public, this part is not. */}
          <div className="flex flex-col gap-2 border-t border-dashed border-foreground/25 pt-5">
            <Label htmlFor="mentor-price">Session rate (USD)</Label>
            <Input
              id="mentor-price"
              type="number"
              min={0}
              inputMode="decimal"
              className="max-w-40 tabular-nums"
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
              aria-invalid={Boolean(errors.price)}
              aria-describedby={
                errors.price ? "mentor-price-error" : "mentor-price-hint"
              }
            />
            <FieldError id="mentor-price-error" message={errors.price} />
            {!errors.price && (
              <p
                id="mentor-price-hint"
                className="flex items-start gap-1.5 text-sm text-subtle"
              >
                <Lock
                  strokeWidth={1.75}
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                />
                <span>
                  Private — visible only to you, students you&rsquo;ve
                  accepted, and admins. Never shown publicly.
                </span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </Button>
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
          </div>
        </form>
      ) : (
        <div className="sheet p-6 shadow-sheet sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <ProfileAvatar
                name={profile.name}
                avatarUrl={profile.avatarUrl}
                className={idPhoto}
              />
              <h2 className="font-display text-xl font-semibold">
                {profile.name}
              </h2>
            </div>
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit profile
            </Button>
          </div>
          <dl className={facts}>
            <div>
              <dt>University / school</dt>
              <dd>{profile.university}</dd>
            </div>
            <div>
              <dt>Major or expertise</dt>
              <dd>{profile.major}</dd>
            </div>
            <div>
              <dt>Country / region</dt>
              <dd>{profile.countryRegion}</dd>
            </div>
            <div>
              <dt>Education systems</dt>
              <dd>{profile.educationSystems.join(", ")}</dd>
            </div>
            <div>
              <dt>Services</dt>
              <dd>{profile.services.join(", ")}</dd>
            </div>
            <div>
              <dt>Subjects &amp; specialties</dt>
              <dd>{profile.subjects.join(", ")}</dd>
            </div>
            <div>
              <dt>Biography</dt>
              <dd className="text-pretty">{profile.biography}</dd>
            </div>
            {/* Perforated off, as in the form: this part is not public. */}
            <div className="mt-1 border-t border-dashed border-foreground/25 pt-4">
              <dt className="flex items-center gap-1.5 self-start">
                <Lock
                  strokeWidth={1.75}
                  aria-hidden="true"
                  className="size-4 shrink-0"
                />
                Session rate (private)
              </dt>
              <dd className="tabular-nums">
                ${profile.privatePriceUsd} USD — visible only to you, connected
                students, and admins.
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
