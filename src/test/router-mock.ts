import { vi } from "vitest";

/** Shared next/navigation router mock so tests can assert navigation. */
export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

export function resetRouterMock(): void {
  for (const fn of Object.values(routerMock)) fn.mockClear();
}
