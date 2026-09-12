/**
 * MessageRepository over the DapUp API. The caller is known from the
 * session token, so the user ids the UI passes are ignored.
 */

import { ApiError, apiFetch } from "@/lib/api/client";
import type { Message, MessageThread } from "@/lib/domain/types";
import { notifyRepositoryChange } from "@/lib/repositories/change-signal";
import { MessagingUnavailableError, type MessageRepository } from "@/lib/repositories/types";

function nullOn(statuses: number[], error: unknown): null {
  if (error instanceof ApiError && statuses.includes(error.status)) return null;
  throw error;
}

export function createHttpMessageRepository(): MessageRepository {
  return {
    async listThreads(): Promise<MessageThread[]> {
      return apiFetch<MessageThread[]>("/threads");
    },

    async getThread(threadId: string): Promise<MessageThread | null> {
      try {
        return await apiFetch<MessageThread>(`/threads/${encodeURIComponent(threadId)}`);
      } catch (error) {
        return nullOn([401, 403, 404], error);
      }
    },

    async listMessages(threadId: string): Promise<Message[]> {
      return apiFetch<Message[]>(`/threads/${encodeURIComponent(threadId)}/messages`);
    },

    async sendMessage(threadId: string, _senderId: string, text: string): Promise<Message> {
      try {
        const message = await apiFetch<Message>(
          `/threads/${encodeURIComponent(threadId)}/messages`,
          { method: "POST", body: { text } },
        );
        notifyRepositoryChange();
        return message;
      } catch (error) {
        if (error instanceof ApiError && error.code === "messaging_unavailable") {
          throw new MessagingUnavailableError(error.message);
        }
        if (error instanceof ApiError && error.status === 404) {
          throw new MessagingUnavailableError("Unknown conversation.");
        }
        throw error;
      }
    },

    async markThreadRead(threadId: string): Promise<void> {
      await apiFetch<void>(`/threads/${encodeURIComponent(threadId)}/read`, { method: "POST" });
      // Not announced: read receipts only affect badges, and the caller's
      // own query re-runs on its next render anyway.
    },

    async unreadCount(threadId: string): Promise<number> {
      const result = await apiFetch<{ count: number }>(
        `/threads/${encodeURIComponent(threadId)}/unread`,
      );
      return result.count;
    },
  };
}
