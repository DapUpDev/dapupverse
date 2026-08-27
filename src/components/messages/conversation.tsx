"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import type {
  ConnectionRequest,
  Message,
  MessageThread,
} from "@/lib/domain/types";
import {
  connectionRepository,
  mentorRepository,
  messageRepository,
  studentProfileRepository,
} from "@/lib/repositories";
import { useRepositoryQuery } from "@/lib/repositories/use-repository-query";

type ConversationData = {
  thread: MessageThread;
  connection: ConnectionRequest | null;
  messages: Message[];
  otherPartyName: string;
};

export function Conversation({
  threadId,
  userId,
}: {
  threadId: string;
  userId: string;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const { data, ready } = useRepositoryQuery<ConversationData | null>(
    async () => {
      const thread = await messageRepository.getThread(threadId);
      if (!thread) return null;
      const [connection, messages] = await Promise.all([
        connectionRepository.get(thread.connectionId),
        messageRepository.listMessages(threadId),
      ]);
      let otherPartyName = thread.mentorId === userId ? "Student" : "Mentor";
      if (thread.mentorId === userId) {
        const student = await studentProfileRepository.get(thread.studentId);
        if (student?.fullName.trim()) otherPartyName = student.fullName;
      } else {
        const mentors = await mentorRepository.list();
        const mentor = mentors.find((m) => m.id === thread.mentorId);
        if (mentor) otherPartyName = mentor.name;
      }
      return { thread, connection, messages, otherPartyName };
    },
    [threadId, userId],
  );

  // Mark the thread read when opened.
  useEffect(() => {
    messageRepository.markThreadRead(threadId, userId);
  }, [threadId, userId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [data?.messages.length]);

  if (!ready) return <Skeleton className="h-96 rounded-xl" />;

  if (!data) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-8">
        <p className="font-medium">Conversation not found</p>
        <ButtonLink variant="outline" href="/app/messages">
          Back to messages
        </ButtonLink>
      </div>
    );
  }

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
    <div className="flex h-full min-h-96 flex-col">
      <div className="flex items-center gap-3 border-b pb-3">
        <ButtonLink
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Back to conversations"
          href="/app/messages"
        >
          <ArrowLeft aria-hidden="true" />
        </ButtonLink>
        <h2 className="text-lg font-semibold">{data.otherPartyName}</h2>
      </div>

      <div
        className="flex flex-1 flex-col gap-3 overflow-y-auto py-4"
        aria-label={`Conversation with ${data.otherPartyName}`}
      >
        {data.messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No messages yet — say hello!
          </p>
        ) : (
          data.messages.map((message) => {
            const mine = message.senderId === userId;
            return (
              <div
                key={message.id}
                className={cn(
                  "flex max-w-[85%] flex-col gap-0.5 sm:max-w-[70%]",
                  mine ? "self-end items-end" : "self-start items-start",
                )}
              >
                <div
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm",
                    mine
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  {message.text}
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {formatDateTime(message.sentAt)}
                </span>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {readOnly ? (
        <Alert>
          <AlertTitle>This conversation is read-only</AlertTitle>
          <AlertDescription>
            The connection has ended, so new messages can&rsquo;t be sent.
          </AlertDescription>
        </Alert>
      ) : (
        <form
          onSubmit={handleSend}
          className="flex items-end gap-2 border-t pt-3"
        >
          <div className="flex-1">
            <Label htmlFor="message-composer" className="sr-only">
              Message {data.otherPartyName}
            </Label>
            <Textarea
              id="message-composer"
              rows={2}
              placeholder={`Message ${data.otherPartyName}`}
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
          <Button type="submit" disabled={sending || draft.trim() === ""}>
            Send
          </Button>
        </form>
      )}
    </div>
  );
}
