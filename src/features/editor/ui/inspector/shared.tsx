"use client";

import React from "react";

/**
 * Primitivos de UI compartidos entre todos los sub-componentes del inspector.
 *
 * ISP: cada componente exporta únicamente su interfaz pública, sin acoplar
 * lógica de dominio ni estado del store.
 */

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[0.65rem] font-semibold uppercase tracking-widest text-zinc-500">
      {children}
    </span>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[0.65rem] font-medium uppercase tracking-wide text-zinc-500">
      {children}
    </label>
  );
}

export function ErrorMsg({ msg }: { msg: string }) {
  return <span className="text-[0.65rem] text-red-400">{msg}</span>;
}

export function Divider() {
  return <div className="h-px bg-zinc-800" />;
}
