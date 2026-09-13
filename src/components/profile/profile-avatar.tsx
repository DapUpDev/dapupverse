import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initialsOf } from "@/lib/domain/initials";
import { cn } from "@/lib/utils";

/**
 * A person's picture, or their initials while there is none. The picture
 * URL is short-lived (an hour), so it always comes fresh from the API with
 * the profile it belongs to; nothing caches it here.
 */
export function ProfileAvatar({
  name,
  avatarUrl,
  className,
  fallbackClassName,
}: {
  name: string;
  avatarUrl: string | null | undefined;
  className?: string;
  fallbackClassName?: string;
}) {
  return (
    <Avatar className={className}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
      <AvatarFallback
        aria-hidden="true"
        className={cn(
          "bg-gradient-to-br from-surface-strong to-card font-mono text-foreground",
          fallbackClassName,
        )}
      >
        {initialsOf(name) || "?"}
      </AvatarFallback>
    </Avatar>
  );
}
