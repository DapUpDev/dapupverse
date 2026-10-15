"use client";

import { useState, type ReactNode } from "react";
import { MoreHorizontal, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { formatDate } from "@/lib/format";

/**
 * Accepted connections as one list, LinkedIn-style: a count, sort and
 * search on top; one row per person with Message up front and the
 * destructive actions (Disconnect, Block) tucked behind "⋯".
 */

export type ConnectionRow = {
  /** The connection (request) id. */
  id: string;
  name: string;
  /** The name as shown; a link when the person has a public page. */
  title?: ReactNode;
  avatarUrl?: string | null;
  detail?: string;
  /** ISO time the connection was accepted. */
  since: string;
  chatHref: string;
  menu: { label: string; onSelect: () => void }[];
};

type Sort = "recent" | "name";
const SORTS: Record<Sort, string> = { recent: "Recently added", name: "Name" };

export function ConnectionList({ rows }: { rows: ConnectionRow[] }) {
  const [sort, setSort] = useState<Sort>("recent");
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const shown = rows
    .filter((row) => row.name.toLowerCase().includes(needle))
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : b.since.localeCompare(a.since),
    );

  return (
    <section
      aria-labelledby="connection-count"
      className="sheet overflow-hidden"
    >
      <header className="flex flex-col gap-4 border-b border-foreground/10 p-5 sm:p-6">
        <h2
          id="connection-count"
          className="font-display text-2xl font-normal tracking-[-0.01em]"
        >
          {rows.length} {rows.length === 1 ? "connection" : "connections"}
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span id="connection-sort">Sort by</span>
            <Select
              items={SORTS}
              value={sort}
              onValueChange={(value: string | null) =>
                value && setSort(value as Sort)
              }
            >
              <SelectTrigger
                aria-labelledby="connection-sort"
                className="h-8 border-transparent bg-transparent px-2 text-sm font-medium text-foreground"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SORTS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="relative sm:w-72">
            <span className="sr-only">Search connections by name</span>
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle"
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name"
              className="pl-9"
            />
          </label>
        </div>
      </header>

      {shown.length === 0 ? (
        <p className="px-5 py-6 text-muted-foreground sm:px-6">
          {rows.length === 0
            ? "No connections yet."
            : `No connections match "${query.trim()}".`}
        </p>
      ) : (
        <ul className="divide-y divide-foreground/10">
          {shown.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-4 sm:gap-x-4 sm:px-6"
            >
              <ProfileAvatar
                name={row.name}
                avatarUrl={row.avatarUrl}
                className="size-12 shrink-0 rounded-[4px] sm:size-14"
              />
              {/* On a phone the buttons drop below rather than squeeze the text. */}
              <div className="min-w-0 flex-1 basis-48">
                <h3 className="truncate font-display text-lg leading-tight font-semibold">
                  {row.title ?? row.name}
                </h3>
                {row.detail ? (
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                    {row.detail}
                  </p>
                ) : null}
                <p className="mt-0.5 text-sm text-subtle tabular-nums">
                  Connected on {formatDate(row.since)}
                </p>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1">
                <ButtonLink variant="outline" size="sm" href={row.chatHref}>
                  Message
                </ButtonLink>
                {row.menu.length > 0 ? (
                  <Menu>
                    <MenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`More actions for ${row.name}`}
                          className="-mr-2 shrink-0 text-muted-foreground"
                        />
                      }
                    >
                      <MoreHorizontal aria-hidden="true" />
                    </MenuTrigger>
                    <MenuContent align="end">
                      {row.menu.map((item) => (
                        <MenuItem
                          key={item.label}
                          onClick={item.onSelect}
                          className="text-destructive"
                        >
                          {item.label}
                        </MenuItem>
                      ))}
                    </MenuContent>
                  </Menu>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
