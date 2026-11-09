"use client";

/**
 * Cifra del panel. Antes contaba desde 0; ahora se pinta directa con su valor real (brief de diseño, §6.7: las cifras
 * no cuentan). Se conserva el componente para que las pantallas que lo usan no cambien.
 */
export function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  return <>{format(value)}</>;
}
