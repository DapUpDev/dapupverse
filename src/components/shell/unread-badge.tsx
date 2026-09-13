"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { messageRepository } from "@/lib/repositories";
import { useRepositoryQuery } from "@/lib/repositories/use-repository-query";

const REFRESH_MS = 30_000;

/**
 * The red number next to "Messages": unread messages across every
 * conversation. Refreshes every 30 seconds, on every navigation, and
 * after any repository write (reading a thread announces one).
 */
export function UnreadBadge({ userId }: { userId: string }) {
  const pathname = usePathname();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), REFRESH_MS);
    return () => window.clearInterval(id);
  }, []);

  const { data: count } = useRepositoryQuery(
    () => messageRepository.unreadTotal(userId),
    [userId, tick, pathname],
  );

  if (!count) return null;
  return (
    <span
      aria-label={`${count} unread message${count === 1 ? "" : "s"}`}
      data-testid="unread-badge"
      className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 align-middle text-[11px] font-semibold leading-none text-white"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
