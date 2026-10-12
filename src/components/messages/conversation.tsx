"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CircleOff } from "lucide-react";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import type { ConnectionRequest, Message } from "@/lib/domain/types";
import { connectionRepository, messageRepository } from "@/lib/repositories";
import { useRepositoryQuery } from "@/lib/repositories/use-repository-query";
import { otherParty } from "@/components/messages/thread-list";

type ConversationData = {
  connection: ConnectionRequest | null;
  messages: Message[];
  other: { name: string; avatarUrl: string | null };
};

// One sheet that fills the window under the site header, so the messages
// scroll inside it and the composer stays at its foot.
const frame =
  "sheet flex h-[calc(100dvh-7rem)] min-h-[26rem] flex-col overflow-hidden sm:h-[calc(100dvh-9rem)]";

export function Conversation({
  threadId,
  userId,
}: {
  threadId: string;
  userId: string;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const { data, ready } = useRepositoryQuery<ConversationData | null>(
    async () => {
      const thread = await messageRepository.getThread(threadId);
      if (!thread) return null;
      const [connection, messages, other] = await Promise.all([
        connectionRepository.get(thread.connectionId),
        messageRepository.listMessages(threadId),
        otherParty(thread, userId),
      ]);
      return { connection, messages, other };
    },
    [threadId, userId],
    4_000, // the other person's messages arrive by asking again
  );

  // Mark the thread read when opened, and again as messages arrive in view.
  const messageCount = data?.messages.length;
  useEffect(() => {
    messageRepository.markThreadRead(threadId, userId);
  }, [threadId, userId, messageCount]);

  // Keep the newest message in view.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messageCount]);

  if (!ready) {
    return (
      <div aria-busy="true" className={cn(frame, "gap-3 p-6")}>
        <Skeleton className="h-7 w-44" />
        <Skeleton className="mt-6 h-10 w-3/5 rounded-2xl" />
        <Skeleton className="h-10 w-2/5 self-end rounded-2xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="sheet flex flex-col items-start gap-4 p-6 sm:p-8">
        <h1 className="font-display text-xl font-semibold">
          Conversation not found
        </h1>
        <ButtonLink variant="outline" href="/app/messages">
          Back to messages
        </ButtonLink>
      </div>
    );
  }

  const { other } = data;
  const readOnly = data.connection?.state !== "accepted";

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || readOnly) return;
    setSending(true);
    try {
      await messageRepository.sendMessage(threadId, userId, text);
      setDraft("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={frame}>
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <ButtonLink
          variant="ghost"
          size="icon"
          className="-ml-2 lg:hidden"
          aria-label="Back to conversations"
          href="/app/messages"
        >
          <ArrowLeft aria-hidden="true" strokeWidth={1.75} />
        </ButtonLink>
        <ProfileAvatar
          name={other.name}
          avatarUrl={other.avatarUrl}
          className="size-9"
        />
        <h1 className="min-w-0 truncate font-display text-xl font-semibold">
          {other.name}
        </h1>
      </div>

      <div
        ref={logRef}
        role="log"
        tabIndex={0}
        aria-label={`Conversation with ${other.name}`}
        className="flex flex-1 flex-col overflow-y-auto px-4 py-5 outline-none [mask-image:linear-gradient(to_bottom,transparent,black_1.25rem,black_calc(100%-1.25rem),transparent)] [scrollbar-color:--alpha(var(--foreground)/25%)_transparent] [scrollbar-width:thin] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-6"
      >
        {data.messages.length === 0 ? (
          <p className="m-auto text-sm text-muted-foreground">
            No messages yet — say hello!
          </p>
        ) : (
          // mt-auto rests a short conversation on the composer, the way
          // justify-end would, without breaking the scroll.
          <div className="mt-auto flex flex-col gap-3">
            {data.messages.map((message) => {
              const mine = message.senderId === userId;
              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex max-w-[85%] flex-col gap-1 sm:max-w-[min(70%,36rem)]",
                    mine ? "items-end self-end" : "items-start self-start",
                  )}
                >
                  <p
                    className={cn(
                      "relative rounded-2xl px-3.5 py-2 break-words whitespace-pre-wrap",
                      mine
                        ? "rounded-br-sm bg-secondary"
                        : "rounded-bl-sm border bg-card",
                    )}
                  >
                    <span className="sr-only">
                      {mine ? "You" : other.name}:{" "}
                    </span>
                    {message.text}
                  </p>
                  <time
                    dateTime={message.sentAt}
                    className="px-1 text-xs text-subtle tabular-nums"
                  >
                    {formatDateTime(message.sentAt)}
                  </time>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {readOnly ? (
        <div
          role="alert"
          className="flex items-start gap-2 px-4 py-4 text-sm text-muted-foreground sm:px-6"
        >
          <CircleOff
            aria-hidden="true"
            strokeWidth={1.75}
            className="mt-0.5 size-4 shrink-0"
          />
          <div>
            <p className="font-medium text-foreground">
              This conversation is read-only
            </p>
            <p>
              The connection has ended, so new messages can&rsquo;t be sent.
            </p>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSend}
          className="flex items-end gap-2 px-4 py-3 sm:px-6"
        >
          <div className="relative flex-1">
            <Label htmlFor="message-composer" className="sr-only">
              Message {other.name}
            </Label>
            <Textarea
              id="message-composer"
              rows={2}
              className="max-h-40 min-h-11 resize-none py-2 md:text-base"
              placeholder={`Message ${other.name}`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={sending || draft.trim() === ""}
          >
            Send
          </Button>
        </form>
      )}
    </div>
  );
}
