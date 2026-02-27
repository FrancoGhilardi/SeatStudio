"use client";

import { useMemo, useState } from "react";
import { useEditorStore } from "@store/editor.store";
import { selectMap } from "@store/selectors";
import { validateMap } from "@domain/services/validateMap";

/**
 * Muestra el estado de validación del mapa activo.
 *
 * SRP: responsable únicamente de presentar los errores de `validateMap`.
 * `validateMap` se memoriza con `useMemo` porque itera todas las entidades.
 */
export function MapValidationSummary() {
  const map = useEditorStore(selectMap);
  const [expanded, setExpanded] = useState(false);

  const result = useMemo(() => (map ? validateMap(map) : null), [map]);

  if (!map || !result) return null;

  if (result.ok) {
    return (
      <div className="flex items-center gap-1.5 rounded border border-emerald-800/40 bg-emerald-950/20 px-2 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span className="text-[0.65rem] text-emerald-400">
          Mapa válido para exportar
        </span>
      </div>
    );
  }

  const count = result.errors.length;
  return (
    <div className="flex flex-col gap-1 rounded border border-amber-700/40 bg-amber-950/20 p-2">
      <button
        className="flex items-center gap-1.5 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        <span className="flex-1 text-[0.65rem] font-medium text-amber-400">
          {count}{" "}
          {count === 1 ? "error de validación" : "errores de validación"}
        </span>
        <span className="text-[0.6rem] text-zinc-600">
          {expanded ? "▲" : "▼"}
        </span>
      </button>
      {expanded && (
        <ul className="mt-1 flex flex-col gap-0.5">
          {result.errors.slice(0, 8).map((err, i) => (
            <li key={i} className="text-[0.6rem] text-amber-300/80">
              • {err.message}
            </li>
          ))}
          {count > 8 && (
            <li className="text-[0.6rem] text-zinc-600">…y {count - 8} más</li>
          )}
        </ul>
      )}
    </div>
  );
}
