import type {
  Area,
  EntityKind,
  EntityRef,
  Row,
  SeatMap,
  Table,
} from "@domain/model/seatmap";
import type {
  EditorState,
  EditorActions,
  EditorTool,
  AutosaveStatus,
  Viewport,
} from "@store/editor.store";

type S = EditorState & EditorActions;

/** Mapa activo o `null` si aún no se inicializó. */
export const selectMap = (s: S): SeatMap | null => s.map;

/** `true` si el mapa ya está cargado. */
export const selectIsReady = (s: S): boolean => s.map !== null;

/** Record de todas las filas indexadas por id. */
export const selectRows = (s: S): Readonly<Record<string, Row>> =>
  s.map?.entities.rows ?? {};

/** Record de todas las mesas indexadas por id. */
export const selectTables = (s: S): Readonly<Record<string, Table>> =>
  s.map?.entities.tables ?? {};

/** Record de todas las áreas indexadas por id. */
export const selectAreas = (s: S): Readonly<Record<string, Area>> =>
  s.map?.entities.areas ?? {};

/**
 * Array de filas para iteración en render.
 *
 * IMPORTANTE: devuelve un nuevo array en cada llamada.
 * Usar siempre con `useShallow` para evitar re-renders innecesarios:
 * ```ts
 * const rows = useEditorStore(useShallow(selectRowList));
 * ```
 */
export const selectRowList = (s: S): Row[] => Object.values(selectRows(s));

/**
 * Array de mesas para iteración en render.
 * Usar con `useShallow` — ver `selectRowList`.
 */
export const selectTableList = (s: S): Table[] =>
  Object.values(selectTables(s));

/**
 * Array de áreas para iteración en render.
 * Usar con `useShallow` — ver `selectRowList`.
 */
export const selectAreaList = (s: S): Area[] => Object.values(selectAreas(s));

/** Referencias de las entidades seleccionadas actualmente. */
export const selectSelectionRefs = (s: S): readonly EntityRef[] =>
  s.selection.refs;

/** Número de entidades seleccionadas. */
export const selectSelectionCount = (s: S): number => s.selection.refs.length;

/** `true` si hay al menos una entidad seleccionada. */
export const selectHasSelection = (s: S): boolean =>
  s.selection.refs.length > 0;

/**
 * Objetos de dominio completos de las entidades seleccionadas.
 * Devuelve sólo las que existen en el mapa (ignora refs obsoletas).
 *
 * IMPORTANTE: devuelve un nuevo objeto `{ rows, tables, areas }` en cada llamada.
 * Usar con `useShallow`:
 * ```ts
 * const { rows, tables } = useEditorStore(useShallow(selectSelectedEntities));
 * ```
 */
export const selectSelectedEntities = (
  s: S,
): { rows: Row[]; tables: Table[]; areas: Area[] } => {
  if (!s.map) return { rows: [], tables: [], areas: [] };

  const rows: Row[] = [];
  const tables: Table[] = [];
  const areas: Area[] = [];

  for (const ref of s.selection.refs) {
    switch (ref.kind) {
      case "row": {
        const row = s.map.entities.rows[ref.id];
        if (row) rows.push(row);
        break;
      }
      case "table": {
        const table = s.map.entities.tables[ref.id];
        if (table) tables.push(table);
        break;
      }
      case "area": {
        const area = s.map.entities.areas[ref.id];
        if (area) areas.push(area);
        break;
      }
    }
  }

  return { rows, tables, areas };
};

/**
 * Factoría de selectors: `true` si la selección contiene sólo entidades del kind dado.
 *
 * IMPORTANTE: retorna una nueva función en cada llamada.
 * No usar directamente con `useEditorStore(selectSelectionIsOnly("row"))`
 * porque crea una nueva referencia en cada render y siempre dispara updates.
 * Preferir los helpers pre-currificados `selectSelectionIsRow/Table/Area` o
 * estabilizar con `useCallback`:
 * ```ts
 * const selector = useCallback(() => selectSelectionIsOnly("row"), []);
 * const isRowOnly = useEditorStore(selector);
 * ```
 */
export const selectSelectionIsOnly =
  (kind: EntityKind) =>
  (s: S): boolean =>
    s.selection.refs.length > 0 &&
    s.selection.refs.every((r) => r.kind === kind);

/** `true` si la selección contiene sólo filas (y al menos una). */
export const selectSelectionIsRow = (s: S): boolean =>
  selectSelectionIsOnly("row")(s);

/** `true` si la selección contiene sólo mesas (y al menos una). */
export const selectSelectionIsTable = (s: S): boolean =>
  selectSelectionIsOnly("table")(s);

/** `true` si la selección contiene sólo áreas (y al menos una). */
export const selectSelectionIsArea = (s: S): boolean =>
  selectSelectionIsOnly("area")(s);

/**
 * Id de la entidad seleccionada si exactamente una está seleccionada, o `null`.
 * Útil para el inspector de prop simplificado.
 */
export const selectSingleSelectedId = (s: S): string | null =>
  s.selection.refs.length === 1 ? (s.selection.refs[0]?.id ?? null) : null;

export const selectTool = (s: S): EditorTool => s.tool;

export const selectIsSelectTool = (s: S): boolean => s.tool === "select";

export const selectViewport = (s: S): Viewport => s.viewport;

export const selectZoom = (s: S): number => s.viewport.zoom;

/** `true` si hay acciones que deshacer. */
export const selectCanUndo = (s: S): boolean => s.history.past.length > 0;

/** `true` si hay acciones que rehacer. */
export const selectCanRedo = (s: S): boolean => s.history.future.length > 0;

export const selectAutosaveStatus = (s: S): AutosaveStatus => s.autosaveStatus;

/** Nombre del mapa activo o cadena vacía si no hay mapa. */
export const selectMapName = (s: S): string => s.map?.meta.name ?? "";
