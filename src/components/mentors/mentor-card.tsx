import Link from "next/link";
import type { Mentor } from "@/lib/domain/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function mentorInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Public mentor card. Receives the public `Mentor` type, which contains no
 * pricing — pricing must never appear here.
 */
export function MentorCard({ mentor }: { mentor: Mentor }) {
  return (
    <Card className="relative h-full transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Avatar className="size-12">
            <AvatarFallback aria-hidden="true">
              {mentorInitials(mentor.name)}
            </AvatarFallback>
          </Avatar>
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
