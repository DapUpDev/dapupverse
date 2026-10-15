import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// Clerk not loaded yet, then loaded: the state right after signing in.
const auth = vi.hoisted(() => ({ isLoaded: false }));
vi.mock("@/lib/auth/use-auth-identity", () => ({
  useAuthIdentity: () => ({ identity: {}, isLoaded: auth.isLoaded }),
}));

import { useRepositoryQuery } from "@/lib/repositories/use-repository-query";

describe("useRepositoryQuery", () => {
  it("waits for Clerk before asking (an earlier request has no token and gets a 401)", async () => {
    const query = vi.fn(async () => "rows");
    const { result, rerender } = renderHook(() =>
      useRepositoryQuery(query, []),
    );
    expect(query).not.toHaveBeenCalled();
    expect(result.current.ready).toBe(false);

    auth.isLoaded = true;
    rerender();
    await waitFor(() =>
      expect(result.current).toEqual({ data: "rows", ready: true }),
    );
    expect(query).toHaveBeenCalledTimes(1);
  });
});
