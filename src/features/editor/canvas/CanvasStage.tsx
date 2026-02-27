"use client";

import { useEditorStore } from "@store/editor.store";
import { selectMap, selectTool, selectViewport } from "@store/selectors";

export function CanvasStage() {
  const map = useEditorStore(selectMap);
  const tool = useEditorStore(selectTool);
  const viewport = useEditorStore(selectViewport);

  const rowCount = map ? Object.keys(map.entities.rows).length : 0;
  const tableCount = map ? Object.keys(map.entities.tables).length : 0;
  const areaCount = map ? Object.keys(map.entities.areas).length : 0;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-zinc-950">
      <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-zinc-700 px-8 py-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600">
          Canvas (Fase 6)
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          Herramienta activa:{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-indigo-400">
            {tool}
          </code>
        </p>
        <p className="text-sm text-zinc-500">
          Zoom:{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-indigo-400">
            {Math.round(viewport.zoom * 100)}%
          </code>
        </p>

        {map ? (
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Stat label="Filas" value={rowCount} />
            <Stat label="Mesas" value={tableCount} />
            <Stat label="Áreas" value={areaCount} />
          </div>
        ) : (
          <p className="mt-3 text-xs text-zinc-600">Sin mapa cargado.</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center rounded bg-zinc-900 px-4 py-2">
      <span className="text-xl font-bold tabular-nums text-zinc-200">
        {value}
      </span>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  );
}
