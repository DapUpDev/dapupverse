/**
 * AvatarRepository over the DapUp API and S3.
 *
 * Three hops, and the file itself never passes through the API:
 *   1. ask the API for a presigned upload URL (it checks type and size),
 *   2. PUT the file straight to S3 with that URL,
 *   3. tell the API the upload landed so it attaches the key to the profile.
 * The API identifies the user from the session token, so `userId` is
 * ignored here (it exists for the mock adapter).
 */

import { ApiError, apiFetch } from "@/lib/api/client";
import { notifyRepositoryChange } from "@/lib/repositories/change-signal";
import type { AvatarRepository } from "@/lib/repositories/types";

type UploadTicket = { uploadUrl: string; key: string; expiresInSeconds: number };

export function createHttpAvatarRepository(): AvatarRepository {
  return {
    async upload(_userId: string, file: File): Promise<string | null> {
      const ticket = await apiFetch<UploadTicket>("/me/avatar/upload-url", {
        method: "POST",
        body: { contentType: file.type, sizeBytes: file.size },
      });
      // The presigned URL pins this exact Content-Type; S3 refuses any other.
      const put = await fetch(ticket.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new ApiError(put.status, "The upload to storage failed.");
      const { avatarUrl } = await apiFetch<{ avatarUrl: string | null }>("/me/avatar", {
        method: "PUT",
        body: { key: ticket.key },
      });
      notifyRepositoryChange();
      return avatarUrl;
    },

    async remove(): Promise<void> {
      await apiFetch<void>("/me/avatar", { method: "DELETE" });
      notifyRepositoryChange();
    },
  };
}
