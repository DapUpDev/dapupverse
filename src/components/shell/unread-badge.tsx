"use client";

import { usePathname } from "next/navigation";
import { messageRepository } from "@/lib/repositories";
import { useRepositoryQuery } from "@/lib/repositories/use-repository-query";

const REFRESH_MS = 10_000;

/**
 * The red number next to "Messages": unread messages across every
 * conversation. Refreshes every 10 seconds, on every navigation, and
 * after any repository write (reading a thread announces one).
 */
export function UnreadBadge({ userId }: { userId: string }) {
  const pathname = usePathname();
  const { data: count } = useRepositoryQuery(
    () => messageRepository.unreadTotal(userId),
    [userId, pathname],
    REFRESH_MS,
  );

  if (!count) return null;
  return (
    <span
      aria-label={`${count} unread message${count === 1 ? "" : "s"}`}
      data-testid="unread-badge"
      className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 align-middle text-xs leading-none font-semibold text-white tabular-nums"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
