"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { mentorInitials } from "@/components/mentors/mentor-card";
import { ImagePlaceholderField } from "@/components/profile/image-placeholder-field";
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
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {options.map((option) => {
          const id = `${idPrefix}-${option.replace(/\s+/g, "-").toLowerCase()}`;
          return (
            <div key={option} className="flex items-center gap-2">
              <Checkbox
                id={id}
                checked={selected.includes(option)}
                onCheckedChange={(checked) =>
                  onToggle(option, checked === true)
                }
              />
              <Label htmlFor={id} className="font-normal">
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
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Your profile</h1>
        <Badge variant="secondary">Mentor</Badge>
      </div>

      {editing ? (
        <form onSubmit={handleSave} noValidate className="flex flex-col gap-5">
          <ImagePlaceholderField
            initials={mentorInitials(form.name)}
            idPrefix="mentor"
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mentor-name">Full name</Label>
              <Input
                id="mentor-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? "mentor-name-error" : undefined}
              />
              {errors.name ? (
                <p
                  id="mentor-name-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {errors.name}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
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
              {errors.university ? (
                <p
                  id="mentor-university-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {errors.university}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
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
              {errors.major ? (
                <p
                  id="mentor-major-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {errors.major}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
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
              {errors.countryRegion ? (
                <p
                  id="mentor-country-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {errors.countryRegion}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mentor-subjects">Subjects &amp; specialties</Label>
            <Input
              id="mentor-subjects"
              value={form.subjects}
              onChange={(e) => set("subjects", e.target.value)}
              aria-describedby="mentor-subjects-hint"
            />
            <p
              id="mentor-subjects-hint"
              className="text-xs text-muted-foreground"
            >
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

          <div className="flex max-w-xs flex-col gap-1.5">
            <Label htmlFor="mentor-price">Session rate (USD)</Label>
            <Input
              id="mentor-price"
              type="number"
              min={0}
              inputMode="decimal"
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
              aria-invalid={Boolean(errors.price)}
              aria-describedby={
                errors.price ? "mentor-price-error" : "mentor-price-hint"
              }
            />
            {errors.price ? (
              <p
                id="mentor-price-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {errors.price}
              </p>
            ) : (
              <p id="mentor-price-hint" className="text-xs text-muted-foreground">
                Private — visible only to you, students you&rsquo;ve accepted,
                and admins. Never shown publicly.
              </p>
            )}
          </div>

          <div className="flex gap-3">
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">{profile.name}</CardTitle>
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit profile
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="font-medium">University / school</p>
              <p className="text-muted-foreground">{profile.university}</p>
            </div>
            <div>
              <p className="font-medium">Major or expertise</p>
              <p className="text-muted-foreground">{profile.major}</p>
            </div>
            <div>
              <p className="font-medium">Country / region</p>
              <p className="text-muted-foreground">{profile.countryRegion}</p>
            </div>
            <div>
              <p className="font-medium">Education systems</p>
              <p className="text-muted-foreground">
                {profile.educationSystems.join(", ")}
              </p>
            </div>
            <div>
              <p className="font-medium">Services</p>
              <p className="text-muted-foreground">
                {profile.services.join(", ")}
              </p>
            </div>
            <div>
              <p className="font-medium">Subjects &amp; specialties</p>
              <p className="text-muted-foreground">
                {profile.subjects.join(", ")}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="font-medium">Biography</p>
              <p className="text-muted-foreground">{profile.biography}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="font-medium">Session rate (private)</p>
              <p className="text-muted-foreground">
                ${profile.privatePriceUsd} USD — visible only to you, connected
                students, and admins.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
