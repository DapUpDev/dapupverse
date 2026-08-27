import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button-link";

/**
 * Shown in place of /app and /admin content on production, where accounts do
 * not exist yet. No role selection or fake authenticated experience is
 * offered there.
 */
export function AccountAccessNotice() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Account access isn&rsquo;t enabled yet</CardTitle>
          <CardDescription>
            Student and mentor accounts are coming soon. Until then, you can
            browse mentors and learn how DapUp works.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center gap-3">
          <ButtonLink href="/mentors">Browse mentors</ButtonLink>
          <ButtonLink variant="outline" href="/">
            Back home
          </ButtonLink>
        </CardContent>
      </Card>
    </main>
  );
}
