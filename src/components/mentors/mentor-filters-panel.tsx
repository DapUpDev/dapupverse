"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  EducationSystem,
  MentorFilters,
  ServiceType,
} from "@/lib/domain/types";
import { EDUCATION_SYSTEMS, SERVICE_TYPES } from "@/lib/domain/types";

export type MentorFilterOptions = {
  subjects: string[];
  countries: string[];
  universities: string[];
};

const ALL = "all";

function SelectFilter({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string | undefined;
  options: string[];
  onChange: (value: string | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value ?? ALL}
        onValueChange={(next: string | null) =>
          onChange(!next || next === ALL ? undefined : next)
        }
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Filter controls shared by the desktop sidebar and the mobile sheet. */
export function MentorFiltersPanel({
  idPrefix,
  filters,
  options,
  onChange,
}: {
  /** Keeps element ids unique when the panel renders twice (sidebar + sheet). */
  idPrefix: string;
  filters: MentorFilters;
  options: MentorFilterOptions;
  onChange: (filters: MentorFilters) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <SelectFilter
        id={`${idPrefix}-education-system`}
        label="Education system"
        value={filters.educationSystem}
        options={EDUCATION_SYSTEMS}
        onChange={(value) =>
          onChange({
            ...filters,
            educationSystem: value as EducationSystem | undefined,
          })
        }
      />
      <SelectFilter
        id={`${idPrefix}-subject`}
        label="Subject or specialty"
        value={filters.subject}
        options={options.subjects}
        onChange={(value) => onChange({ ...filters, subject: value })}
      />
      <SelectFilter
        id={`${idPrefix}-country`}
        label="Country or region"
        value={filters.countryRegion}
        options={options.countries}
        onChange={(value) => onChange({ ...filters, countryRegion: value })}
      />
      <SelectFilter
        id={`${idPrefix}-university`}
        label="University or school"
        value={filters.university}
        options={options.universities}
        onChange={(value) => onChange({ ...filters, university: value })}
      />
      <SelectFilter
        id={`${idPrefix}-service`}
        label="Service type"
        value={filters.serviceType}
        options={SERVICE_TYPES}
        onChange={(value) =>
          onChange({ ...filters, serviceType: value as ServiceType | undefined })
        }
      />
    </div>
  );
}
