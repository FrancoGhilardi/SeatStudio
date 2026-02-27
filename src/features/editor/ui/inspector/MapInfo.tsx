"use client";

import { useEditorStore } from "@store/editor.store";
import { selectMap } from "@store/selectors";
import { SectionTitle } from "./shared";

/**
 * Resumen del mapa activo: nombre y recuento de entidades.
 *
 * SRP: responsable únicamente de presentar metadatos del mapa.
 */
export function MapInfo() {
  const map = useEditorStore(selectMap);
  if (!map) return null;

  return (
    <section className="flex flex-col gap-1.5">
      <SectionTitle>Mapa</SectionTitle>
      <span className="text-sm text-zinc-200">{map.meta.name}</span>
      <div className="mt-1 grid grid-cols-2 gap-1 text-xs text-zinc-400">
        <span>Filas</span>
        <span className="tabular-nums text-right text-zinc-300">
          {Object.keys(map.entities.rows).length}
        </span>
        <span>Mesas</span>
        <span className="tabular-nums text-right text-zinc-300">
          {Object.keys(map.entities.tables).length}
        </span>
        <span>Áreas</span>
        <span className="tabular-nums text-right text-zinc-300">
          {Object.keys(map.entities.areas).length}
        </span>
      </div>
    </section>
  );
}
