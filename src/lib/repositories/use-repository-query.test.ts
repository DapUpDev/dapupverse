import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useRepositoryQuery } from "@/lib/repositories/use-repository-query";

describe("useRepositoryQuery", () => {
  afterEach(() => vi.useRealTimers());

  it("asks again on the refresh interval, and only while the tab is visible", async () => {
    vi.useFakeTimers();
    const query = vi.fn().mockResolvedValue("data");
    renderHook(() => useRepositoryQuery(query, [], 4_000));
    expect(query).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(4_000));
    expect(query).toHaveBeenCalledTimes(2);

    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    await act(() => vi.advanceTimersByTimeAsync(8_000));
    expect(query).toHaveBeenCalledTimes(2);
    hidden.mockRestore();
  });

  it("does not poll without a refresh interval", async () => {
    vi.useFakeTimers();
    const query = vi.fn().mockResolvedValue("data");
    renderHook(() => useRepositoryQuery(query, []));
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(query).toHaveBeenCalledTimes(1);
  });
});
