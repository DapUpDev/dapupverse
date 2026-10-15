"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

/**
 * Admin: when the weekly check-in email goes out to Premier Fellowship students.
 * One shared setting; the worker checks it every hour.
 */

type Settings = {
  checkinWeekday: number; // Monday = 0
  checkinTime: string; // "HH:MM"
  timezone: string;
};

const DAYS: Record<string, string> = {
  "0": "Monday",
  "1": "Tuesday",
  "2": "Wednesday",
  "3": "Thursday",
  "4": "Friday",
  "5": "Saturday",
  "6": "Sunday",
};

const ZONES: Record<string, string> = {
  "America/Los_Angeles": "Pacific time (Los Angeles)",
  "America/New_York": "Eastern time (New York)",
  "Pacific/Auckland": "New Zealand (Auckland)",
  "Australia/Sydney": "Sydney",
  "Asia/Singapore": "Singapore",
  "Europe/London": "London",
};

export function CheckInSchedule() {
  const { isLoaded, identity } = useAuthIdentity();
  const signedIn = isLoaded && identity.isAuthenticated;
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!signedIn || !apiBaseUrl()) return;
    apiFetch<Settings>("/admin/settings").then(
      (s) => {
        setSettings(s);
        setSaved(s);
      },
      () => toast.error("Couldn't load the check-in schedule."),
    );
  }, [signedIn]);

  if (!apiBaseUrl()) {
    return (
      <p className="sheet p-5 text-muted-foreground">
        The schedule is set on the live site.
      </p>
    );
  }
  if (!settings) {
    return <Skeleton className="h-40 w-full" />;
  }

  const zones = { [settings.timezone]: settings.timezone, ...ZONES };
  const changed = JSON.stringify(settings) !== JSON.stringify(saved);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const next = await apiFetch<Settings>("/admin/settings", {
        method: "PUT",
        body: settings,
      });
      setSettings(next);
      setSaved(next);
      toast.success("Check-in schedule saved");
    } catch {
      toast.error("Couldn't save the schedule. Check the time and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="sheet flex flex-col gap-5 p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem_1.4fr]">
        <div className="flex flex-col gap-2">
          <Label htmlFor="checkin-day">Day</Label>
          <Select
            items={DAYS}
            value={String(settings.checkinWeekday)}
            onValueChange={(value: string | null) =>
              value &&
              setSettings({ ...settings, checkinWeekday: Number(value) })
            }
          >
            <SelectTrigger id="checkin-day" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DAYS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="checkin-time">Time</Label>
          <Input
            id="checkin-time"
            type="time"
            required
            value={settings.checkinTime}
            onChange={(e) =>
              setSettings({ ...settings, checkinTime: e.target.value })
            }
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="checkin-zone">Time zone</Label>
          <Select
            items={zones}
            value={settings.timezone}
            onValueChange={(value: string | null) =>
              value && setSettings({ ...settings, timezone: value })
            }
          >
            <SelectTrigger id="checkin-zone" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(zones).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Premier Fellowship students get their check-in every{" "}
        {DAYS[String(settings.checkinWeekday)]} at {settings.checkinTime},{" "}
        {zones[settings.timezone]}. It stays open for two days, with one
        reminder after the first.
      </p>
      <div>
        <Button type="submit" disabled={!changed || saving}>
          {saving ? "Saving…" : "Save schedule"}
        </Button>
      </div>
    </form>
  );
}
