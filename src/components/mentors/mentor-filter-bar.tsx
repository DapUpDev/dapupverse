"use client";

import { useRef } from "react";
import {
  BookOpen,
  Globe,
  GraduationCap,
  Handshake,
  Landmark,
  ListFilter,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSub,
  MenuSubTrigger,
  MenuTrigger,
} from "@/components/ui/menu";
import type { MentorFilters } from "@/lib/domain/types";
import { EDUCATION_SYSTEMS, SERVICE_TYPES } from "@/lib/domain/types";

export type MentorFilterOptions = {
  subjects: string[];
  countries: string[];
  universities: string[];
};

type FieldKey = Exclude<keyof MentorFilters, "query">;

const FIELDS: {
  key: FieldKey;
  label: string;
  icon: LucideIcon;
  values: (options: MentorFilterOptions) => string[];
}[] = [
  {
    key: "educationSystem",
    label: "Education system",
    icon: GraduationCap,
    values: () => EDUCATION_SYSTEMS,
  },
  {
    key: "subject",
    label: "Subject or specialty",
    icon: BookOpen,
    values: (options) => options.subjects,
  },
  {
    key: "countryRegion",
    label: "Country or region",
    icon: Globe,
    values: (options) => options.countries,
  },
  {
    key: "university",
    label: "University or school",
    icon: Landmark,
    values: (options) => options.universities,
  },
  {
    key: "serviceType",
    label: "Service type",
    icon: Handshake,
    values: () => SERVICE_TYPES,
  },
];

const chipButton =
  "px-2 outline-none transition duration-150 ease-out hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset active:scale-[0.97] data-popup-open:bg-muted";

function ValueItems({
  value,
  values,
  onPick,
}: {
  value: string | undefined;
  values: string[];
  onPick: (value: string) => void;
}) {
  if (values.length === 0) return <MenuItem disabled>No options yet</MenuItem>;
  // ponytail: menu typeahead only, no search box. Swap the value list for Base UI Combobox when a field passes ~15 options.
  return (
    <MenuRadioGroup value={value ?? null} onValueChange={onPick}>
      {values.map((option) => (
        <MenuRadioItem key={option} value={option} closeOnClick>
          {option}
        </MenuRadioItem>
      ))}
    </MenuRadioGroup>
  );
}

/** Linear-style filter bar: one chip per active filter, plus a Filter menu. */
export function MentorFilterBar({
  filters,
  options,
  onChange,
  onClear,
}: {
  filters: MentorFilters;
  options: MentorFilterOptions;
  onChange: (filters: MentorFilters) => void;
  onClear: () => void;
}) {
  // Removing a chip unmounts the focused button; hand focus to Filter.
  const filterRef = useRef<HTMLButtonElement>(null);
  const active = FIELDS.filter((field) => filters[field.key]);
  const set = (key: FieldKey, value: string | undefined) =>
    onChange({ ...filters, [key]: value });

  return (
    <div
      role="group"
      aria-label="Mentor filters"
      className="flex flex-wrap items-center gap-2"
    >
      {active.map(({ key, label, icon: Icon, values }) => (
        <div
          key={key}
          className="flex h-7 max-w-full items-stretch divide-x divide-border overflow-hidden rounded-lg border border-border bg-muted/50 text-[0.8rem]"
        >
          <span className="flex shrink-0 items-center gap-1.5 px-2 text-muted-foreground">
            <Icon aria-hidden="true" className="size-3.5" />
            {label}
          </span>
          <span className="flex shrink-0 items-center px-2 text-muted-foreground">
            is
          </span>
          <Menu>
            <MenuTrigger
              aria-label={`${label} is ${filters[key]}`}
              className={`${chipButton} min-w-0 truncate font-medium`}
            >
              {filters[key]}
            </MenuTrigger>
            <MenuContent>
              <ValueItems
                value={filters[key]}
                values={values(options)}
                onPick={(value) => set(key, value)}
              />
            </MenuContent>
          </Menu>
          <button
            type="button"
            aria-label={`Remove ${label} filter`}
            className={`${chipButton} shrink-0 text-muted-foreground hover:text-foreground`}
            onClick={() => {
              set(key, undefined);
              filterRef.current?.focus();
            }}
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        </div>
      ))}
      {active.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="active:scale-[0.97]"
          onClick={() => {
            onClear();
            filterRef.current?.focus();
          }}
        >
          Clear
        </Button>
      )}
      <Menu>
        <MenuTrigger
          ref={filterRef}
          render={
            <Button
              variant="outline"
              size="sm"
              className="active:scale-[0.97]"
            />
          }
        >
          <ListFilter aria-hidden="true" />
          Filter
        </MenuTrigger>
        <MenuContent>
          {FIELDS.map(({ key, label, icon: Icon, values }) => (
            <MenuSub key={key}>
              <MenuSubTrigger>
                <Icon aria-hidden="true" />
                {label}
              </MenuSubTrigger>
              <MenuContent>
                <ValueItems
                  value={filters[key]}
                  values={values(options)}
                  onPick={(value) => set(key, value)}
                />
              </MenuContent>
            </MenuSub>
          ))}
        </MenuContent>
      </Menu>
    </div>
  );
}
