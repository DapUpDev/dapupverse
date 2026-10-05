"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PhotoCropDialog } from "@/components/profile/photo-crop-dialog";
import { idPhoto, ProfileAvatar } from "@/components/profile/profile-avatar";
import { avatarRepository } from "@/lib/repositories";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
/**
 * Profile picture chooser. The picture saves the moment it has been framed,
 * independently of the surrounding form: the repository uploads it and the
 * profile query re-runs, so `avatarUrl` arrives back through props.
 */
export function AvatarUploadField({
  name,
  idPrefix,
  userId,
  avatarUrl,
}: {
  name: string;
  idPrefix: string;
  userId: string;
  avatarUrl: string | null;
}) {
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [picked, setPicked] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow picking the same file again later
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Use a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Images must be 5 MB or smaller.");
      return;
    }
    setPicked(file);
  };

  const handleSave = async (photo: File) => {
    setPicked(null);
    setBusy("upload");
    try {
      await avatarRepository.upload(userId, photo);
      toast.success("Photo updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async () => {
    setBusy("remove");
    try {
      await avatarRepository.remove(userId);
      toast.success("Photo removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove the photo.");
    } finally {
      setBusy(null);
    }
  };

  const inputId = `${idPrefix}-image`;

  return (
    // Perforated off from the fields below: the photo saves on its own.
    <div className="flex items-start gap-5 border-b border-dashed border-foreground/25 pb-5">
      <ProfileAvatar
        name={name}
        avatarUrl={avatarUrl}
        className={cn(
          idPhoto,
          "transition-opacity duration-200",
          busy && "opacity-50",
        )}
      />
      <PhotoCropDialog
        file={picked}
        onCancel={() => setPicked(null)}
        onSave={handleSave}
      />
      <div className="flex min-w-0 flex-col gap-2 pt-0.5">
        <Label htmlFor={inputId}>Profile photo</Label>
        {/* The button below opens this picker, so it is not a second tab stop. */}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          disabled={busy !== null}
          onChange={handleFile}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => inputRef.current?.click()}
          >
            {busy === "upload" ? "Uploading…" : avatarUrl ? "Change photo" : "Choose photo"}
          </Button>
          {avatarUrl ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={busy !== null}
              onClick={handleRemove}
            >
              {busy === "remove" ? "Removing…" : "Remove"}
            </Button>
          ) : null}
        </div>
        <p className="text-sm text-subtle">
          JPEG, PNG, or WebP up to 5 MB. Saves right away.
        </p>
      </div>
    </div>
  );
}
