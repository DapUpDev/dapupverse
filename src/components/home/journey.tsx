"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowDown } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Lake to Sky: three chapters read top to bottom. Each photo is taller than
// its chapter and slides at a fraction of the scroll speed, so the ground
// seems to fall away as the visitor climbs.
const CHAPTERS = [
  {
    src: "/journey/lake.jpg",
    number: "01",
    label: "The waterline",
    title: "Where you are now.",
    text: "Exams, essays, applications. From here, every summit looks far away.",
  },
  {
    src: "/journey/ascent.jpg",
    number: "02",
    label: "The ascent",
    title: "People who climbed it last year.",
    text: "DapUp mentors sat the same exams and wrote the same applications. They remember the route.",
  },
  {
    src: "/journey/sky.jpg",
    number: "03",
    label: "Open sky",
    title: "Where you're going.",
    text: "Pick a mentor below, send one request, and climb together.",
  },
];
// How far a photo lags behind the page: 0 glues it to the page, 1 pins it.
const LAG = 0.35;

/** Moves every [data-parallax] photo as the page scrolls. Transform only. */
function useParallax(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const layers = [...el.querySelectorAll<HTMLElement>("[data-parallax]")];
    let frame = 0;
    const place = () => {
      frame = 0;
      const vh = innerHeight;
      for (const layer of layers) {
        const box = layer.parentElement!.getBoundingClientRect();
        if (box.bottom < 0 || box.top > vh) continue;
        // -1 when the chapter is about to enter, +1 when it has just left.
        const progress = (box.top + box.height / 2 - vh / 2) / (vh + box.height);
        layer.style.translate = `0 ${progress * LAG * box.height}px`;
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    place();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
    };
  }, [root]);
}

export function Journey() {
  const ref = useRef<HTMLDivElement>(null);
  useParallax(ref);
  return (
    <div ref={ref} className="-mt-16 bg-[#224f78] text-white">
      {CHAPTERS.map((chapter, i) => (
        <section
          key={chapter.number}
          aria-labelledby={`journey-${chapter.number}`}
          className="relative isolate flex min-h-svh items-end overflow-hidden"
        >
          {/* Taller than the chapter so it has room to slide. */}
          <div
            data-parallax
            className="absolute inset-x-0 -top-[18%] -bottom-[18%] -z-10 will-change-transform"
          >
            <Image
              src={chapter.src}
              alt=""
              fill
              sizes="100vw"
              priority={i === 0}
              className="object-cover"
            />
          </div>
          {/* Legibility for the words; the photos run edge to edge above. */}
          <div className="absolute inset-x-0 bottom-0 -z-10 h-3/4 bg-linear-to-t from-black/55 to-transparent" />
          <div className="mx-auto w-full max-w-7xl px-4 pt-32 pb-16 sm:px-6 sm:pb-24 lg:px-10">
            <p className="text-sm font-medium tracking-[0.12em] uppercase opacity-80">
              {chapter.number} / {chapter.label}
            </p>
            <h2
              id={`journey-${chapter.number}`}
              className="mt-3 max-w-3xl font-display text-[clamp(2.4rem,5vw+0.5rem,5.5rem)] leading-[0.98] font-semibold tracking-[-0.035em] text-balance"
            >
              {chapter.title}
            </h2>
            <p className="mt-5 max-w-xl text-lg text-pretty opacity-90 sm:text-xl">
              {chapter.text}
            </p>
            {i === CHAPTERS.length - 1 && (
              <Link
                href="#find"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "mt-8 bg-white text-foreground hover:bg-white/90",
                )}
              >
                Find your mentor
                <ArrowDown />
              </Link>
            )}
          </div>
          {i === 0 && (
            <p className="absolute right-4 bottom-6 text-sm font-medium tracking-[0.12em] uppercase opacity-70 sm:right-6 lg:right-10">
              Scroll to ascend
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
