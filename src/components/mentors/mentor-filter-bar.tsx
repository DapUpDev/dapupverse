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

// A segment of a chip you can press. Feedback is a fill on the press itself;
// the chip clips its children, so the focus ring is drawn inside.
const chipButton =
  "outline-none transition-colors duration-150 ease-out hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset active:bg-secondary data-popup-open:bg-muted";

function ValueItems({
  value,
  values,
  onPick,
}: {
  value: string | undefined;
  values: string[];
  onPick: (value: string) => void;
}) {
  if (values.length === 0)
    return (
      <MenuItem disabled className="text-subtle data-disabled:opacity-100">
        No options yet
      </MenuItem>
    );
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

/**
 * Linear-style filter bar: the Filter menu, then one chip per active filter.
 * Filter stays put so its menu always opens from the same place; a chip is the
 * same height as the buttons beside it and its chosen value is highlighted.
 */
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
      <Menu>
        <MenuTrigger
          ref={filterRef}
          render={<Button variant="outline" size="sm" />}
        >
          <ListFilter aria-hidden="true" />
          Filter
        </MenuTrigger>
        <MenuContent>
          {FIELDS.map(({ key, label, icon: Icon, values }) => (
            <MenuSub key={key}>
              <MenuSubTrigger>
                <Icon aria-hidden="true" className="text-muted-foreground" />
                {label}
              </MenuSubTrigger>
              {/* Offsets are measured from the row, which sits 4px inside its
                  menu: this leaves a 4px gap and lines the first rows up. */}
              <MenuContent sideOffset={8} alignOffset={-4}>
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
      {active.map(({ key, label, icon: Icon, values }) => (
        <div
          key={key}
          className="flex h-8 max-w-full items-stretch overflow-hidden rounded-lg border border-foreground/25 bg-card text-[0.8125rem]"
        >
          <span className="flex shrink-0 items-center gap-1.5 pr-1 pl-2.5 text-muted-foreground">
            <Icon aria-hidden="true" className="size-3.5" />
            {label}
          </span>
          <span className="flex shrink-0 items-center px-1 text-subtle">
            is
          </span>
          <Menu>
            <MenuTrigger
              aria-label={`${label} is ${filters[key]}`}
              className={`${chipButton} flex min-w-0 items-center px-1.5`}
            >
              <span className="truncate rounded-[3px] bg-mark px-1.5 py-0.5 leading-tight font-medium">
                {filters[key]}
              </span>
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
            className={`${chipButton} flex w-8 shrink-0 items-center justify-center border-l border-border text-muted-foreground hover:text-foreground`}
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
          variant="ghost"
          size="sm"
          // The ghost hover fill is the desk's own colour; go one step darker.
          className="hover:bg-secondary"
          onClick={() => {
            onClear();
            filterRef.current?.focus();
          }}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
