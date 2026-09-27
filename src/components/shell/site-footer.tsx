import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="font-display text-xl font-extrabold tracking-tight">
              DapUp
              <span aria-hidden="true" className="text-fog">
                *
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              For students. By students. Truly.
            </p>
          </div>
          <nav aria-label="Footer">
            <ul className="flex items-center gap-6 text-sm">
              <li>
                <Link
                  href="/terms"
                  className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Terms
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Privacy
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        <div
          aria-hidden="true"
          className="h-px w-full bg-gradient-to-r from-chrome/60 via-border to-transparent"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span aria-hidden="true" className="tech-label block">DAPUP — MENTORSHIP NETWORK</span>
          <span aria-hidden="true" className="tech-label block">EST. 2024 / VER. M3</span>
        </div>
      </div>
    </footer>
  );
}
