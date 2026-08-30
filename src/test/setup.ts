import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { mockDataStore } from "@/lib/mock/store";

// Next.js runtime pieces aren't available under Vitest; stub the router and
// render links as plain anchors.
vi.mock("next/navigation", async () => {
  const { routerMock } = await import("@/test/router-mock");
  return {
    useRouter: () => routerMock,
    usePathname: () => "/",
    useSearchParams: () => new URLSearchParams(),
    redirect: (url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    },
  };
});

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.ComponentProps<"a"> & { href: string }) =>
    React.createElement("a", { href, ...props }, children),
}));

// Identity comes from test fixtures, not Clerk, in unit/component tests.
vi.mock("@/lib/auth/use-auth-identity", async () => {
  const { getTestIdentity } = await import("@/test/auth-fixtures");
  return {
    useAuthIdentity: () => ({ identity: getTestIdentity(), isLoaded: true }),
  };
});

afterEach(async () => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
  mockDataStore.reset();
  const { resetRouterMock } = await import("@/test/router-mock");
  resetRouterMock();
  const { resetTestIdentity } = await import("@/test/auth-fixtures");
  resetTestIdentity();
});

// jsdom lacks a few browser APIs that Base UI / app code touch.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

if (!("ResizeObserver" in window)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (window as unknown as Record<string, unknown>).ResizeObserver =
    ResizeObserverStub;
}

if (!("IntersectionObserver" in window)) {
  class IntersectionObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  (window as unknown as Record<string, unknown>).IntersectionObserver =
    IntersectionObserverStub;
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
