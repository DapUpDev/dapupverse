"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// The saved square. The largest a photo is drawn is 112px, so this covers
// a 3x phone screen with room to spare.
const OUTPUT = 640;
const MAX_ZOOM = 4;
const FRAME = 280; // the square the photo is framed in, in CSS pixels

type Crop = { x: number; y: number; zoom: number }; // x, y: centre, in photo pixels

/**
 * Cut the chosen square out of the full-size photo. Shrinking in halves
 * keeps far more detail than one big squeeze from camera size.
 */
function cut(image: HTMLImageElement, crop: Crop): Promise<Blob | null> {
  const side = Math.min(image.naturalWidth, image.naturalHeight) / crop.zoom;
  const size = Math.min(OUTPUT, Math.round(side));
  let step = size;
  while (step * 2 <= side) step *= 2;

  let canvas = document.createElement("canvas");
  canvas.width = canvas.height = step;
  let context = canvas.getContext("2d")!;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#fff"; // JPEG has no transparency
  context.fillRect(0, 0, step, step);
  context.drawImage(
    image,
    crop.x - side / 2,
    crop.y - side / 2,
    side,
    side,
    0,
    0,
    step,
    step,
  );
  while (step > size) {
    step /= 2;
    const half = document.createElement("canvas");
    half.width = half.height = step;
    context = half.getContext("2d")!;
    context.imageSmoothingQuality = "high";
    context.drawImage(canvas, 0, 0, step, step);
    canvas = half;
  }
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
}

/**
 * Frame a profile photo: drag to move, slide to zoom, then save a square.
 * Open while `file` is set.
 */
export function PhotoCropDialog({
  file,
  onCancel,
  onSave,
}: {
  file: File | null;
  onCancel: () => void;
  onSave: (photo: File) => void;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>({ x: 0, y: 0, zoom: 1 });
  const [failed, setFailed] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const loading = new Image();
    loading.onload = () => {
      setImage(loading);
      setCrop({
        x: loading.naturalWidth / 2,
        y: loading.naturalHeight / 2,
        zoom: 1,
      });
    };
    loading.onerror = () => setFailed(true);
    loading.src = url;
    return () => {
      URL.revokeObjectURL(url);
      setImage(null);
      setFailed(false);
    };
  }, [file]);

  const width = image?.naturalWidth ?? 1;
  const height = image?.naturalHeight ?? 1;
  // Screen pixels per photo pixel.
  const scale = (FRAME / Math.min(width, height)) * crop.zoom;

  // Keep the frame inside the photo.
  const move = (next: Crop) => {
    const half = Math.min(width, height) / next.zoom / 2;
    setCrop({
      zoom: next.zoom,
      x: Math.min(Math.max(next.x, half), width - half),
      y: Math.min(Math.max(next.y, half), height - half),
    });
  };
  const nudge = (dx: number, dy: number) =>
    move({ ...crop, x: crop.x - dx / scale, y: crop.y - dy / scale });

  const save = async () => {
    if (!image) return;
    const blob = await cut(image, crop);
    if (!blob) return setFailed(true);
    onSave(new File([blob], "photo.jpg", { type: blob.type }));
  };

  return (
    <Dialog open={file !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Frame your photo</DialogTitle>
          <DialogDescription>
            Drag to move it. Use the slider to zoom.
          </DialogDescription>
        </DialogHeader>
        {failed ? (
          <p role="alert">That photo could not be opened. Try another one.</p>
        ) : (
          <>
            <div
              role="img"
              aria-label="Photo preview. Arrow keys move it."
              tabIndex={0}
              style={{ width: FRAME, height: FRAME }}
              className="relative mx-auto max-w-full cursor-grab touch-none overflow-hidden rounded-[4px] bg-secondary outline-none select-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { x: e.clientX, y: e.clientY };
              }}
              onPointerMove={(e) => {
                if (!drag.current) return;
                nudge(e.clientX - drag.current.x, e.clientY - drag.current.y);
                drag.current = { x: e.clientX, y: e.clientY };
              }}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
              onKeyDown={(e) => {
                const step = { ArrowLeft: [16, 0], ArrowRight: [-16, 0], ArrowUp: [0, 16], ArrowDown: [0, -16] }[e.key];
                if (!step) return;
                e.preventDefault();
                nudge(step[0], step[1]);
              }}
            >
              {image && (
                // eslint-disable-next-line @next/next/no-img-element -- a local preview of the picked file
                <img
                  src={image.src}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute top-0 left-0 max-w-none origin-top-left"
                  style={{
                    width: width * scale,
                    height: height * scale,
                    translate: `${FRAME / 2 - crop.x * scale}px ${FRAME / 2 - crop.y * scale}px`,
                  }}
                />
              )}
            </div>
            <input
              type="range"
              aria-label="Zoom"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={crop.zoom}
              onChange={(e) => move({ ...crop, zoom: Number(e.target.value) })}
              className="mx-auto w-full max-w-[280px] accent-foreground"
            />
          </>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={!image || failed} onClick={save}>
            Save photo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
