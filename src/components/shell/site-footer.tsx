import Link from "next/link";

export function SiteFooter() {
  return (
    <footer>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-end sm:justify-between sm:px-6 lg:px-10">
        <div>
          <p className="font-display text-lg font-semibold">
            DapUp
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            For students. By students. Truly.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex items-center gap-6 text-sm">
            <li>
              <Link
                href="/terms"
                className="text-muted-foreground hover:text-foreground hover:underline"
              >
                Terms
              </Link>
            </li>
            <li>
              <Link
                href="/privacy"
                className="text-muted-foreground hover:text-foreground hover:underline"
              >
                Privacy
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
