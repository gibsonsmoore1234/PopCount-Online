"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const VIEW = 300; // crop window size in CSS px

type Crop = { x: number; y: number; size: number };

/** Square crop picker: drag the photo to position it, use the slider to zoom. */
export function PhotoCropper({
  file,
  onCancel,
  onDone,
}: {
  file: File | null;
  onCancel: () => void;
  onDone: (crop: Crop) => void;
}) {
  return (
    <Dialog open={Boolean(file)} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent title="Crop photo" description="Drag to move · slide to zoom" size="sm">
        {file && (
          <Cropper
            key={`${file.name}-${file.size}-${file.lastModified}`}
            file={file}
            onCancel={onCancel}
            onDone={onDone}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Cropper({ file, onCancel, onDone }: { file: File; onCancel: () => void; onDone: (crop: Crop) => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = () => setSrc(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
    return () => reader.abort();
  }, [file]);

  const scale = nat ? (VIEW / Math.min(nat.w, nat.h)) * zoom : 1;
  const dispW = nat ? nat.w * scale : VIEW;
  const dispH = nat ? nat.h * scale : VIEW;
  const clamp = (o: { x: number; y: number }) => ({
    x: Math.min(0, Math.max(VIEW - dispW, o.x)),
    y: Math.min(0, Math.max(VIEW - dispH, o.y)),
  });
  const pos = clamp(off);

  const setZoomKeepCentre = (z: number) => {
    if (!nat) return setZoom(z);
    const s0 = VIEW / Math.min(nat.w, nat.h);
    // Keep the point under the window's centre fixed while zooming.
    const cx = (VIEW / 2 - pos.x) / scale;
    const cy = (VIEW / 2 - pos.y) / scale;
    const ns = s0 * z;
    setZoom(z);
    setOff({ x: VIEW / 2 - cx * ns, y: VIEW / 2 - cy * ns });
  };

  const done = () => {
    if (!nat) return;
    onDone({ x: -pos.x / scale, y: -pos.y / scale, size: VIEW / scale });
  };

  return (
    <div className="space-y-4 p-5">
      <div
        className="border-ink relative mx-auto touch-none overflow-hidden rounded-xl border-2 bg-black select-none"
        style={{ width: VIEW, height: VIEW, cursor: "grab" }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { px: e.clientX, py: e.clientY, ox: pos.x, oy: pos.y };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d) setOff({ x: d.ox + e.clientX - d.px, y: d.oy + e.clientY - d.py });
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        {src && (
          <img
            src={src}
            alt=""
            draggable={false}
            onLoad={(e) => {
              const img = e.currentTarget;
              const n = { w: img.naturalWidth, h: img.naturalHeight };
              setNat(n);
              const s = VIEW / Math.min(n.w, n.h);
              setOff({ x: (VIEW - n.w * s) / 2, y: (VIEW - n.h * s) / 2 });
            }}
            className="pointer-events-none absolute max-w-none"
            style={{ left: pos.x, top: pos.y, width: dispW, height: dispH }}
          />
        )}
      </div>
      <input
        type="range"
        min={1}
        max={4}
        step={0.01}
        value={zoom}
        onChange={(e) => setZoomKeepCentre(Number(e.target.value))}
        aria-label="Zoom"
        className="w-full accent-black"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={done} disabled={!nat}>
          Use photo
        </Button>
      </div>
    </div>
  );
}
