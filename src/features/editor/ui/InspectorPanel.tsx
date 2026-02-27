"use client";

import { useMemo } from "react";
import { useEditorStore } from "@store/editor.store";
import {
  selectSelectionRefs,
  selectMap,
  selectHasSelection,
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
 * SRP: este componente es exclusivamente un enrutador de selección → sub-inspector.
 * Toda la lógica de edición vive en inspector/ (sub-componentes).
 */
export function InspectorPanel() {
  const map = useEditorStore(selectMap);
  const selected = useEditorStore(selectSelectionRefs);
  const hasSelection = useEditorStore(selectHasSelection);
  const requestDelete = useEditorStore((s) => s.requestDelete);

  // Resuelve referencias de selección a entidades de dominio concretas.
  const { rows, tables, areas } = useMemo(() => {
    if (!map || selected.length === 0)
      return { rows: [] as Row[], tables: [] as Table[], areas: [] as Area[] };

    const rows: Row[] = [];
    const tables: Table[] = [];
    const areas: Area[] = [];

    for (const ref of selected) {
      if (ref.kind === "row") {
        const r = map.entities.rows[ref.id];
        if (r) rows.push(r);
      } else if (ref.kind === "table") {
        const t = map.entities.tables[ref.id];
        if (t) tables.push(t);
      } else if (ref.kind === "area") {
        const a = map.entities.areas[ref.id];
        if (a) areas.push(a);
      }
    }

    return { rows, tables, areas };
  }, [map, selected]);

  const totalSelected = selected.length;
  const isSingle = totalSelected === 1;

  const singleRow = isSingle && rows.length === 1 ? (rows[0] ?? null) : null;
  const singleTable =
    isSingle && tables.length === 1 ? (tables[0] ?? null) : null;
  const singleArea = isSingle && areas.length === 1 ? (areas[0] ?? null) : null;
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
