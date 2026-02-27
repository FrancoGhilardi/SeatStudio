"use client";

import { useEditorStore } from "@store/editor.store";
import {
  selectMap,
  selectHasSelection,
  selectSelectionCount,
} from "@store/selectors";
import type { Row, Table, Area } from "@domain/model/seatmap";
import {
  Divider,
  MapInfo,
  MapValidationSummary,
  RowInspector,
  TableInspector,
  AreaInspector,
  MultiInspector,
} from "./inspector";

/**
 * Panel de propiedades derecho.
 *
 * SRP: exclusivamente un enrutador de selección → sub-inspector.
 * Toda la lógica de edición vive en inspector/ (sub-componentes).
 */
export function InspectorPanel() {
  const map = useEditorStore(selectMap);
  const hasSelection = useEditorStore(selectHasSelection);
  const totalSelected = useEditorStore(selectSelectionCount);
  const requestDelete = useEditorStore((s) => s.requestDelete);

  // Selectores individuales por tipo: devuelven la referencia de la entidad
  // tal cual vive en el store (Immer garantiza estabilidad si no cambió),
  // o null. Object.is estable → no hay bucle infinito en useSyncExternalStore.
  const singleRow = useEditorStore((s): Row | null => {
    if (s.selection.refs.length !== 1) return null;
    const ref = s.selection.refs[0];
    if (!ref || ref.kind !== "row") return null;
    return s.map?.entities.rows[ref.id] ?? null;
  });

  const singleTable = useEditorStore((s): Table | null => {
    if (s.selection.refs.length !== 1) return null;
    const ref = s.selection.refs[0];
    if (!ref || ref.kind !== "table") return null;
    return s.map?.entities.tables[ref.id] ?? null;
  });

  const singleArea = useEditorStore((s): Area | null => {
    if (s.selection.refs.length !== 1) return null;
    const ref = s.selection.refs[0];
    if (!ref || ref.kind !== "area") return null;
    return s.map?.entities.areas[ref.id] ?? null;
  });

  const isMulti = totalSelected > 1;

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-3 overflow-y-auto border-l border-zinc-800 bg-zinc-900 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
        Inspector
      </h2>

      {!map && <p className="text-xs text-zinc-500">Sin mapa activo.</p>}

      {map && <MapInfo />}
      {map && <MapValidationSummary />}

      <Divider />

      {map && totalSelected === 0 && (
        <p className="text-xs text-zinc-500">
          Selecciona una entidad en el canvas para ver sus propiedades.
        </p>
      )}

      {singleRow && <RowInspector key={singleRow.id} row={singleRow} />}
      {singleTable && (
        <TableInspector key={singleTable.id} table={singleTable} />
      )}
      {singleArea && <AreaInspector key={singleArea.id} area={singleArea} />}
      {isMulti && <MultiInspector />}

      {hasSelection && (
        <div className="mt-auto border-t border-zinc-800 pt-3">
          <button
            onClick={requestDelete}
            className="w-full rounded px-3 py-1.5 text-sm font-medium text-red-400 transition hover:bg-red-950 hover:text-red-300"
          >
            Eliminar selección ({totalSelected})
          </button>
        </div>
      )}
    </aside>
  );
}
