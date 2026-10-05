import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initialsOf } from "@/lib/domain/initials";

// A square ID photo, not a round avatar: on a card or a form the picture is a
// credential. Avatar takes its radius from the root, so this is all it needs.
export const idPhoto =
  "size-20 rounded-[4px] [&_[data-slot=avatar-fallback]]:text-xl";

// Term on the left, value on the right; stacked on a phone.
export const facts =
  "mt-6 grid gap-4 border-t border-border pt-6 sm:gap-3 [&_dt]:text-subtle [&>div]:grid [&>div]:gap-x-6 sm:[&>div]:grid-cols-[11rem_1fr]";

/**
 * A person's picture, or their initials while there is none. The picture
 * URL is short-lived (an hour), so it always comes fresh from the API with
 * the profile it belongs to; nothing caches it here.
 */
export function ProfileAvatar({
  name,
  avatarUrl,
  className,
}: {
  name: string;
  avatarUrl: string | null | undefined;
  className?: string;
}) {
  return (
    <Avatar className={className}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
      <AvatarFallback aria-hidden="true" className="font-medium">
        {initialsOf(name) || "?"}
      </AvatarFallback>
    </Avatar>
  );
}
