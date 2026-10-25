"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { DecoratedLogoMarkup, DECORATED_VIEWBOX } from "./decorated-logo-svg";
import "./decorated-logo.css";

/**
 * The TMII logo with its decorations (design-system §8.3). Use only on light surfaces.
 * `animated` plays the intro then idle loops; `birdsOnly` plays the flying-birds loop once.
 */
export function DecoratedLogo({
  animated = false,
  birdsOnly = false,
  className,
}: {
  animated?: boolean;
  birdsOnly?: boolean;
  className?: string;
}) {
  const prefix = useId().replace(/:/g, "");
  const ref = useRef<SVGSVGElement>(null);
  const [paused, setPaused] = useState(false);

  // Pause idle loops when the tab is hidden or the logo is off-screen (§9.2).
  useEffect(() => {
    if (!animated) return;
    const el = ref.current;
    let visible = true;
    const update = () => setPaused(document.hidden || !visible);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    if (el) observer.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [animated]);

  return (
    <svg
      ref={ref}
      viewBox={DECORATED_VIEWBOX}
      role="img"
      aria-label="TMII — Taman Mini Indonesia Indah"
      className={cn("tmii-decorated h-auto w-full", className)}
      data-animated={animated || undefined}
      data-birds-only={birdsOnly || undefined}
      data-paused={paused || undefined}
    >
      <DecoratedLogoMarkup p={prefix} />
    </svg>
  );
}
