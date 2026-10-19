"use client";

import { useEffect, useRef, useState } from "react";

/** Cifra que cuenta hasta su valor en 500 ms (una vez por cambio). Con "reducir movimiento" se muestra directa. */
export function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  // Parte de 0 al aparecer, y del valor anterior cuando cambia el periodo.
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const start = from.current;
    from.current = value;
    const duration = start === value || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 500;
    let frame = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = duration ? Math.min(1, (now - t0) / duration) : 1;
      const eased = 1 - (1 - p) ** 3;
      setShown(Math.round(start + (value - start) * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{format(shown)}</>;
}
