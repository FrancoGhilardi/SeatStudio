"use client";

import { useEditorStore } from "@store/editor.store";
import {
  selectSelectionRefs,
  selectMap,
  selectHasSelection,
} from "@store/selectors";

export function InspectorPanel() {
  const map = useEditorStore(selectMap);
  const selected = useEditorStore(selectSelectionRefs);
  const hasSelection = useEditorStore(selectHasSelection);
  const requestDelete = useEditorStore((s) => s.requestDelete);

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-3 overflow-y-auto border-l border-zinc-800 bg-zinc-900 p-4">
      {/*  Cabecera  */}
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
        Inspector
      </h2>

      {/*  Sin mapa  */}
      {!map && <p className="text-xs text-zinc-500">Sin mapa activo.</p>}

      {/*  Info del mapa  */}
      {map && (
        <section className="flex flex-col gap-1.5">
          <Label>Mapa</Label>
          <Value>{map.meta.name}</Value>

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
      )}

      {/*  Selección  */}
      <div className="h-px bg-zinc-800" />

      {selected.length === 0 ? (
        <p className="text-xs text-zinc-500">
          Selecciona una entidad en el canvas para ver sus propiedades.
        </p>
      ) : (
        <section className="flex flex-col gap-1.5">
          <Label>Selección</Label>
          <Value>
            {selected.length} entidad{selected.length !== 1 ? "es" : ""}
          </Value>
          <ul className="mt-1 flex flex-col gap-1">
            {selected.map((ref) => (
              <li
                key={`${ref.kind}-${ref.id}`}
                className="flex gap-2 text-xs text-zinc-400"
              >
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono capitalize text-zinc-300">
                  {ref.kind}
                </span>
                <span className="truncate font-mono text-zinc-500">
                  {ref.id}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/*  Placeholder  */}
      <p className="text-[0.65rem] text-zinc-700">
        Propiedades y etiquetado — próximamente
      </p>

      {/*  Zona de peligro: eliminar selección  */}
      {hasSelection && (
        <div className="mt-auto border-t border-zinc-800 pt-3">
          <button
            onClick={() => requestDelete()}
            className="w-full rounded px-3 py-1.5 text-sm font-medium text-red-400 transition hover:bg-red-950 hover:text-red-300"
          >
            Eliminar selección ({selected.length})
          </button>
        </div>
      )}
    </aside>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[0.65rem] font-semibold uppercase tracking-widest text-zinc-500">
      {children}
    </span>
  );
}

function Value({ children }: { children: React.ReactNode }) {
  return <span className="text-sm text-zinc-200">{children}</span>;
}
