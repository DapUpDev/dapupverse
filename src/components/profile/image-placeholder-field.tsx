"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/**
 * Profile-image placeholder with a local upload PREVIEW only. The selected
 * file never leaves the browser and is not stored anywhere — real image
 * storage arrives with the backend in a later milestone.
 */
export function ImagePlaceholderField({
  initials,
  idPrefix,
}: {
  initials: string;
  idPrefix: string;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-16">
        {previewUrl ? <AvatarImage src={previewUrl} alt="" /> : null}
        <AvatarFallback aria-hidden="true" className="text-lg font-semibold">
          {initials || "?"}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-image`}>Profile image</Label>
        <input
          ref={inputRef}
          id={`${idPrefix}-image`}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setPreviewUrl(file ? URL.createObjectURL(file) : null);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          Choose image
        </Button>
        <p className="text-xs text-muted-foreground">
          Preview only — images aren&rsquo;t uploaded or saved yet.
        </p>
      </div>
    </div>
  );
}
