"use client";

import { Check, FunnelSimple, Minus, ShieldCheck, Translate, UserFocus, type Icon as PhosphorIcon, type IconProps, type IconWeight } from "@phosphor-icons/react";

// Íconos que solo usan Cuentas, Ajustes y "Qué puede hacer cada persona". Mismo juego (Phosphor) y mismos pesos que
// src/components/ui/icons.tsx; decorativos por defecto.

function make(C: PhosphorIcon, weight: IconWeight) {
  const Wrapped = (props: IconProps) => <C weight={weight} aria-hidden="true" focusable="false" {...props} />;
  Wrapped.displayName = `Icon(${C.displayName ?? "phosphor"})`;
  return Wrapped;
}

export const IconFilter = make(FunnelSimple, "regular");
export const IconCheck = make(Check, "bold");
export const IconDash = make(Minus, "bold");
export const IconShield = make(ShieldCheck, "duotone");
export const IconLanguage = make(Translate, "duotone");
export const IconPerson = make(UserFocus, "duotone");
