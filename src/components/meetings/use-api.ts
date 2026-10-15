"use client";

import { useEffect, useState } from "react";
import { ApiError, apiBaseUrl, apiFetch } from "@/lib/api/client";
import { useAuthIdentity } from "@/lib/auth/use-auth-identity";

export type Loaded<T> =
  | { state: "loading" }
  | { state: "missing" }
  | { state: "error" }
  | { state: "ready"; data: T };

/**
 * GET a live-API path once sign-in has loaded (before that the request
 * would carry no token and get a 401). No API configured = "missing":
 * meetings only exist on the backend.
 */
export function useApiGet<T>(path: string): [Loaded<T>, (data: T) => void] {
  const { isLoaded, identity } = useAuthIdentity();
  const signedIn = isLoaded && identity.isAuthenticated;
  const [loaded, setLoaded] = useState<Loaded<T>>(() =>
    apiBaseUrl() ? { state: "loading" } : { state: "missing" },
  );

  useEffect(() => {
    if (!signedIn || !apiBaseUrl()) return;
    apiFetch<T>(path).then(
      (data) => setLoaded({ state: "ready", data }),
      (error) =>
        setLoaded({
          state:
            error instanceof ApiError && [403, 404].includes(error.status)
              ? "missing"
              : "error",
        }),
    );
  }, [path, signedIn]);

  return [loaded, (data: T) => setLoaded({ state: "ready", data })];
}
