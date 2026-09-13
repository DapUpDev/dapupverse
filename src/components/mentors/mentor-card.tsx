import Link from "next/link";
import type { Mentor } from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { ProfileAvatar } from "@/components/profile/profile-avatar";

export { initialsOf as mentorInitials } from "@/lib/domain/initials";

/**
 * Public mentor card. Receives the public `Mentor` type, which contains no
 * pricing — pricing must never appear here.
 */
export function MentorCard({ mentor }: { mentor: Mentor }) {
  return (
    <Card className="relative h-full border-border transition-all hover:border-chrome/60 hover:shadow-lg hover:shadow-background/60 has-focus-visible:border-chrome">
      <CardHeader>
        <div className="flex items-center gap-3">
          <ProfileAvatar
            name={mentor.name}
            avatarUrl={mentor.avatarUrl}
            className="size-12 border border-chrome/30"
          />
          <div className="min-w-0">
            <CardTitle className="truncate text-base">
              <Link
                href={`/mentors/${mentor.slug}`}
                className="after:absolute after:inset-0"
              >
                {mentor.name}
              </Link>
            </CardTitle>
            <CardDescription className="truncate">
              {mentor.major} · {mentor.university}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {mentor.biography}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {mentor.educationSystems.map((system) => (
            <Badge key={system} variant="secondary">
              {system}
            </Badge>
          ))}
          {mentor.subjects.slice(0, 3).map((subject) => (
            <Badge key={subject} variant="outline">
              {subject}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{mentor.countryRegion}</p>
      </CardContent>
    </Card>
  );
}
