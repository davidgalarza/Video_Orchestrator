import { memo, useEffect, useRef, useState } from "react";

// Decode one source at a time and reuse its frames across repeated takes.
const cache = new WeakMap<Blob, Promise<string[]>>();
let queue = Promise.resolve();
function thumbnails(blob: Blob) {
  const existing = cache.get(blob);
  if (existing) return existing;
  const task = queue
    .then(async () => {
      const video = document.createElement("video");
      const url = URL.createObjectURL(blob);
      video.muted = true;
      video.preload = "auto";
      function wait(event: string, action: () => void) {
        return new Promise<void>((resolve, reject) => {
          const done = () => {
            cleanup();
            resolve();
          };
          const fail = () => {
            cleanup();
            reject(new Error("No se pudo leer la miniatura"));
          };
          const timer = window.setTimeout(fail, 8000);
          const cleanup = () => {
            clearTimeout(timer);
            video.removeEventListener(event, done);
            video.removeEventListener("error", fail);
          };
          video.addEventListener(event, done, { once: true });
          video.addEventListener("error", fail, { once: true });
          action();
        });
      }
      try {
        await wait("loadeddata", () => {
          video.src = url;
        });
        if (!Number.isFinite(video.duration) || !video.videoWidth) return [];
        const canvas = document.createElement("canvas");
        canvas.width = 160;
        canvas.height = Math.max(
          1,
          Math.round((160 * video.videoHeight) / video.videoWidth),
        );
        const context = canvas.getContext("2d");
        if (!context) return [];
        const frames: string[] = [];
        for (let i = 0; i < 5; i++) {
          const target =
            ((video.duration - Math.min(0.04, video.duration / 2)) * i) / 4;
          if (Math.abs(target - video.currentTime) > 0.001)
            await wait("seeked", () => {
              video.currentTime = target;
            });
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          frames.push(canvas.toDataURL("image/jpeg", 0.65));
        }
        return frames;
      } finally {
        video.removeAttribute("src");
        video.load();
        URL.revokeObjectURL(url);
      }
    })
    .catch(() => [] as string[]);
  queue = task.then(() => {});
  cache.set(blob, task);
  return task;
}
export const SequenceFilmstrip = memo(function SequenceFilmstrip({
  blob,
  start,
  end,
  duration,
  width,
}: {
  blob?: Blob;
  start: number;
  end: number;
  duration: number;
  width: number;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const [result, setResult] = useState<{ blob: Blob; frames: string[] }>();
  useEffect(() => {
    let live = true;
    const load = () => {
      if (blob)
        void thumbnails(blob).then((frames) => {
          if (live) setResult({ blob, frames });
        });
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: "300px" },
    );
    if (host.current) observer.observe(host.current);
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [blob]);
  const frames = result?.blob === blob ? result?.frames : undefined;
  const count = Math.max(1, Math.min(32, Math.ceil(width / 76)));
  return (
    <span ref={host} className="sequence-filmstrip" aria-hidden="true">
      {frames?.length ? (
        Array.from({ length: count }, (_, i) => {
          const sourceTime = start + ((end - start) * (i + 0.5)) / count;
          const index = Math.max(
            0,
            Math.min(
              frames.length - 1,
              Math.round((sourceTime / duration) * (frames.length - 1)),
            ),
          );
          return <img key={i} src={frames[index]} alt="" draggable={false} />;
        })
      ) : (
        <span className="sequence-filmstrip-loading" />
      )}
    </span>
  );
});
