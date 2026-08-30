"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Show, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { navItemsForIdentity } from "@/components/shell/navigation";
import { useAuthIdentity } from "@/lib/auth/use-auth-identity";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const { identity } = useAuthIdentity();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = navItemsForIdentity(identity);

  const isActive = (href: string) =>
    href !== "/" && !href.includes("#")
      ? pathname.startsWith(href)
      : pathname === "/" && href === "/";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="font-display text-lg font-extrabold tracking-tight"
          >
            DapUp
            <span aria-hidden="true" className="text-fog">
              *
            </span>
          </Link>
          <nav aria-label="Primary" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "relative rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                      isActive(item.href) &&
                        "text-foreground after:absolute after:inset-x-3 after:bottom-0.5 after:h-px after:bg-gradient-to-r after:from-chrome after:to-transparent",
                    )}
                    aria-current={isActive(item.href) ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Show when="signed-out">
            <ButtonLink
              variant="ghost"
              size="sm"
              href="/sign-in"
              className="hidden sm:inline-flex"
            >
              Sign in
            </ButtonLink>
            <ButtonLink size="sm" href="/sign-up">
              Create account
            </ButtonLink>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label="Open navigation menu"
                />
              }
            >
              <Menu aria-hidden="true" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <nav aria-label="Mobile" className="px-4">
                <ul className="flex flex-col gap-1">
                  {items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "block rounded-md px-3 py-2 text-base font-medium text-muted-foreground hover:bg-accent hover:text-foreground",
                          isActive(item.href) && "text-foreground",
                        )}
                        aria-current={isActive(item.href) ? "page" : undefined}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                  <Show when="signed-out">
                    <li>
                      <Link
                        href="/sign-in"
                        onClick={() => setMobileOpen(false)}
                        className="block rounded-md px-3 py-2 text-base font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        Sign in
                      </Link>
                    </li>
                  </Show>
                </ul>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
