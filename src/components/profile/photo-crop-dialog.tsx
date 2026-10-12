"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  // Fingers (or the mouse) on the photo: one drags, two pinch.
  const touches = useRef(new Map<number, { x: number; y: number }>());

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
  // Screen pixels per photo pixel, before and after zoom.
  const fit = FRAME / Math.min(width, height);
  const scale = fit * crop.zoom;

  // Every change goes through here: it works from the latest crop (two
  // fingers report separately) and keeps the frame inside the photo.
  // While a finger holds it, the photo may go a little past its edge with
  // growing resistance (Apple's rubber band); it settles back on release.
  const adjust = (
    dx: number,
    dy: number,
    factor = 1,
    zoomTo?: number,
    held = false,
  ) =>
    setCrop((c) => {
      const zoom = Math.min(Math.max(zoomTo ?? c.zoom * factor, 1), MAX_ZOOM);
      const side = Math.min(width, height) / zoom;
      const clamp = (v: number, size: number) => {
        const inside = Math.min(Math.max(v, side / 2), size - side / 2);
        const over = v - inside;
        return held
          ? inside + (over * side * 0.55) / (side + 0.55 * Math.abs(over))
          : inside;
      };
      return {
        zoom,
        x: clamp(c.x - dx / (fit * c.zoom), width),
        y: clamp(c.y - dy / (fit * c.zoom), height),
      };
    });
  const [held, setHeld] = useState(false);
  const lift = (e: React.PointerEvent) => {
    touches.current.delete(e.pointerId);
    if (touches.current.size > 0) return;
    setHeld(false);
    adjust(0, 0); // settle back inside the edges
  };

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
            Drag to move it. Pinch or use the slider to zoom.
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
                touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
                setHeld(true);
              }}
              onPointerMove={(e) => {
                const last = touches.current.get(e.pointerId);
                if (!last) return;
                const here = { x: e.clientX, y: e.clientY };
                const other = [...touches.current].find(
                  ([id]) => id !== e.pointerId,
                )?.[1];
                touches.current.set(e.pointerId, here);
                if (!other)
                  return adjust(here.x - last.x, here.y - last.y, 1, undefined, true);
                // Two fingers: zoom by how far apart they moved, and follow
                // their midpoint (this finger moved, so it moved by half).
                const spread = (p: { x: number; y: number }) =>
                  Math.hypot(p.x - other.x, p.y - other.y) || 1;
                adjust(
                  (here.x - last.x) / 2,
                  (here.y - last.y) / 2,
                  spread(here) / spread(last),
                  undefined,
                  true,
                );
              }}
              onPointerUp={lift}
              onPointerCancel={lift}
              onKeyDown={(e) => {
                const step = { ArrowLeft: [16, 0], ArrowRight: [-16, 0], ArrowUp: [0, 16], ArrowDown: [0, -16] }[e.key];
                if (!step) return;
                e.preventDefault();
                adjust(step[0], step[1]);
              }}
            >
              {image && (
                // eslint-disable-next-line @next/next/no-img-element -- a local preview of the picked file
                <img
                  src={image.src}
                  alt=""
                  draggable={false}
                  className={cn(
                    "pointer-events-none absolute top-0 left-0 max-w-none origin-top-left will-change-transform",
                    // Glued to the finger while held; eases home once let go.
                    !held && "transition-[translate,scale] duration-300 ease-desk",
                  )}
                  // Zoomed with a transform, not by resizing, so the phone
                  // does not lay the photo out again on every frame.
                  style={{
                    width: width * fit,
                    height: height * fit,
                    translate: `${FRAME / 2 - crop.x * scale}px ${FRAME / 2 - crop.y * scale}px`,
                    scale: crop.zoom,
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
              onChange={(e) => adjust(0, 0, 1, Number(e.target.value))}
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
