"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiBaseUrl, apiFetch } from "@/lib/api/client";
import { useAuthIdentity } from "@/lib/auth/use-auth-identity";

/**
 * Connect Google Calendar, so DapUp can find times everyone is free and
 * put booked meetings on calendars. Google's consent screen is the
 * redirect; it comes back to /app/profile?calendar=connected|error.
 */

type Connection = {
  available: boolean;
  connected: boolean;
  email: string | null;
};

export function CalendarConnection() {
  const { isLoaded, identity } = useAuthIdentity();
  const signedIn = isLoaded && identity.isAuthenticated;
  const outcome = useSearchParams().get("calendar");
  const [connection, setConnection] = useState<Connection | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!signedIn || !apiBaseUrl()) return;
    apiFetch<Connection>("/google/connection").then(setConnection, () =>
      setConnection(null),
    );
  }, [signedIn]);

  useEffect(() => {
    if (outcome === "connected") toast.success("Google Calendar connected");
    if (outcome === "error")
      toast.error("Google Calendar wasn't connected. Try again.");
  }, [outcome]);

  if (!connection || !connection.available) return null;

  const connect = async () => {
    setBusy(true);
    try {
      const { url } = await apiFetch<{ url: string }>("/google/connect", {
        method: "POST",
      });
      window.location.assign(url);
    } catch {
      toast.error("Couldn't reach Google. Try again.");
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await apiFetch("/google/connection", { method: "DELETE" });
      setConnection({ ...connection, connected: false, email: null });
    } catch {
      toast.error("Couldn't disconnect. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="calendar-heading"
      className="sheet mt-6 flex flex-col gap-4 p-6 shadow-sheet sm:flex-row sm:items-center sm:justify-between sm:p-8"
    >
      <div className="flex gap-4">
        <CalendarCheck
          aria-hidden
          strokeWidth={1.5}
          className="mt-0.5 size-6 shrink-0 text-muted-foreground"
        />
        <div className="flex flex-col gap-1">
          <h2
            id="calendar-heading"
            className="font-display text-xl font-semibold"
          >
            Google Calendar
          </h2>
          <p className="text-pretty text-muted-foreground">
            {connection.connected
              ? `Connected as ${connection.email}. Meetings you book in DapUp land on this calendar.`
              : "Connect it so DapUp can find times you're free. DapUp only sees when you're busy, never what your events are."}
          </p>
        </div>
      </div>
      <div className="shrink-0">
        {connection.connected ? (
          <Button variant="outline" onClick={disconnect} disabled={busy}>
            Disconnect
          </Button>
        ) : (
          <Button onClick={connect} disabled={busy}>
            {busy ? "Opening Google…" : "Connect Google Calendar"}
          </Button>
        )}
      </div>
    </section>
  );
}
