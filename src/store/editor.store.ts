import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { applyPatches } from "immer";
import type { Patch } from "immer";
import type { SeatMap, EntityRef } from "@domain/model/seatmap";
import type { EditorCommand } from "@application/commands/types";
import { executeCommand } from "@application/commands/execute";
import type { DomainError } from "@domain/services/errors";
import { exportMap } from "@application/usecases/io";

/**
 * Herramienta activa en el canvas.
 * `select`   → selección / mover entidades
 * `addRow`   → dibujar fila recta
 * `addTable` → colocar mesa circular
 * `addArea`  → dibujar área poligonal
 */
export type EditorTool = "select" | "addRow" | "addTable" | "addArea";

/**
 * Estado del guardado automático en background.
 * `idle`    → sin cambios pendientes desde el último guardado
 * `pending` → hay cambios sin persistir (timer en curso)
 * `saved`   → último guardado completado con éxito
 * `error`   → el último intento de guardado falló
 */
export type AutosaveStatus = "idle" | "pending" | "saved" | "error";

/** Tiempo de espera (ms) antes de disparar el autosave tras un cambio. */
const AUTOSAVE_DEBOUNCE_MS = 1_500;

/**
 * Tipos de comandos que pueden ejecutarse sin un mapa previo en el store
 * (crean o reemplazan el estado raíz del mapa).
 * Definido a nivel de módulo para no instanciar un array en cada dispatch.
 */
const SEED_COMMAND_TYPES = new Set<EditorCommand["type"]>([
  "RESET_MAP",
  "IMPORT_MAP",
]);

export interface Viewport {
  /** Factor de escala (1 = 100%). */
  readonly zoom: number;
  /** Desplazamiento en X (px en coordenadas de pantalla). */
  readonly panX: number;
  /** Desplazamiento en Y (px en coordenadas de pantalla). */
  readonly panY: number;
}

/**
 * Una entrada en la pila de historial.
 *
 * `patches`        → cambios que produce el comando (para redo).
 * `inversePatches` → cambios inversos (para undo).
 */
export interface HistoryEntry {
  readonly patches: readonly Patch[];
  readonly inversePatches: readonly Patch[];
}

export interface SelectionState {
  /** Conjunto de entidades seleccionadas (referencias ligeras). */
  readonly refs: readonly EntityRef[];
}

export interface EditorState {
  /** Mapa activo (dominio). */
  map: SeatMap | null;
  /** Selección actual. */
  selection: SelectionState;
  /** Herramienta activa. */
  tool: EditorTool;
  /** Viewport (zoom + pan). */
  viewport: Viewport;
  /** Pila de entradas pasadas (undo). La última entrada es la más reciente. */
  history: {
    past: HistoryEntry[];
    future: HistoryEntry[];
  };
  /** Estado del guardado automático en background. */
  autosaveStatus: AutosaveStatus;
}

export interface EditorActions {
  /**
   * Ejecuta un comando tipado sobre el mapa actual.
   *
   * Si el mapa es `null` y el comando no es RESET_MAP o IMPORT_MAP, lanza
   * un error (el store debe inicializarse con `initMap` antes de despachar
   * comandos de dominio).
   *
   * Si el comando tiene éxito:
   *  - Actualiza `map` con el nuevo estado.
   *  - Añade una `HistoryEntry` a `past`.
   *  - Limpia `future`.
   *
   * @returns Array de errores de dominio si el comando falla; vacío si tuvo éxito.
   */
  dispatch(cmd: EditorCommand): readonly DomainError[];

  /** Deshace la última acción (si hay historial). */
  undo(): void;

  /** Rehace la última acción deshecha (si hay futuro). */
  redo(): void;

  /**
   * Inicializa el store con un mapa (cargado desde repo o creado nuevo).
   * Limpia historial y selección.
   */
  initMap(map: SeatMap): void;

  /** Cambia la herramienta activa. */
  setTool(tool: EditorTool): void;

  /** Actualiza parcialmente el viewport. */
  setViewport(partial: Partial<Viewport>): void;

  /** Reemplaza la selección con las referencias dadas. */
  setSelection(refs: readonly EntityRef[]): void;

  /**
   * Añade referencias a la selección actual.
   * Las duplicadas (mismo kind+id) se ignoran.
   */
  addToSelection(refs: readonly EntityRef[]): void;

  /**
   * Elimina referencias de la selección actual.
   */
  removeFromSelection(refs: readonly EntityRef[]): void;

  /** Vacía la selección. Alias semántico de `clearSelection`. */
  resetSelection(): void;

  /** Vacía la selección. */
  clearSelection(): void;
}

/**
 * Timer module-level para el debounce del autosave.
 * Existe fuera del store para sobrevivir re-renders sin contaminar el estado.
 */
let _autosaveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Serializa `map` y llama PUT /api/seatmap/active debounced.
 *
 * `onStatus` recibe el resultado y actualiza el store.
 * Se cancela cualquier timer pendiente antes de agendar uno nuevo.
 */
function _scheduleAutosave(
  map: SeatMap,
  onStatus: (status: AutosaveStatus) => void,
): void {
  if (_autosaveTimer !== null) clearTimeout(_autosaveTimer);

  _autosaveTimer = setTimeout(() => {
    _autosaveTimer = null;

    const result = exportMap(map);
    if (!result.ok) {
      onStatus("error");
      return;
    }

    void fetch("/api/seatmap/active", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: result.value.json,
    })
      .then((res) => onStatus(res.ok ? "saved" : "error"))
      .catch(() => onStatus("error"));
  }, AUTOSAVE_DEBOUNCE_MS);
}

// ─── Estado inicial ───────────────────────────────────────────────────────────

const INITIAL_STATE: EditorState = {
  map: null,
  selection: { refs: [] },
  tool: "select",
  viewport: { zoom: 1, panX: 0, panY: 0 },
  history: { past: [], future: [] },
  autosaveStatus: "idle",
};

export const useEditorStore = create<EditorState & EditorActions>()(
  immer((set, get) => ({
    ...INITIAL_STATE,

    dispatch(cmd) {
      const currentMap = get().map;

      if (currentMap === null && !SEED_COMMAND_TYPES.has(cmd.type)) {
        return [
          {
            code: "STORE_NOT_INITIALIZED",
            message:
              "El mapa no está inicializado. Llama a initMap() o despacha RESET_MAP primero.",
          },
        ];
      }

      // Para RESET_MAP/IMPORT_MAP sin mapa previo usamos un mapa vacío temporal
      // que executeCommand ignora en favor del nuevo estado generado.
      const mapForCmd = currentMap ?? ({} as SeatMap);

      const result = executeCommand(cmd, mapForCmd);

      if (!result.ok) {
        return result.errors;
      }

      const { map: nextMap, patches, inversePatches } = result.value;

      set((state) => {
        state.map = nextMap as unknown as typeof state.map;

        // RESET_MAP / IMPORT_MAP reemplazan el mapa completo: limpiar historia
        // y selección sin guardar entrada (no tiene sentido deshacer un reset).
        if (SEED_COMMAND_TYPES.has(cmd.type)) {
          state.selection = { refs: [] };
          state.history.past = [];
          state.history.future = [];
        } else {
          // Guardar en historial sólo si hubo cambios reales.
          if (patches.length > 0) {
            state.history.past.push({
              patches: [...patches],
              inversePatches: [...inversePatches],
            });
            state.history.future = [];
          }

          if (cmd.type === "DELETE_ENTITIES") {
            const deletedIds = new Set(cmd.payload.refs.map((r) => r.id));
            state.selection = {
              refs: state.selection.refs.filter((r) => !deletedIds.has(r.id)),
            };
          }
        }

        // Marcar como pendiente antes de que el debounce se dispare.
        state.autosaveStatus = "pending";
      });

      // Programar autosave fuera del bloque Immer (operación async).
      _scheduleAutosave(nextMap, (status) =>
        set((state) => {
          state.autosaveStatus = status;
        }),
      );

      return [];
    },

    undo() {
      const { history, map } = get();

      if (history.past.length === 0 || map === null) return;

      const entry = history.past[history.past.length - 1]!;
      // applyPatches es puro: devuelve un nuevo objeto sin mutar map.
      const prevMap = applyPatches(map, [...entry.inversePatches]);

      set((state) => {
        state.map = prevMap as unknown as typeof state.map;
        state.history.past = state.history.past.slice(0, -1);
        state.history.future.unshift({
          patches: [...entry.patches],
          inversePatches: [...entry.inversePatches],
        });
        state.selection = { refs: [] };
        state.autosaveStatus = "pending";
      });

      _scheduleAutosave(prevMap as SeatMap, (status) =>
        set((state) => {
          state.autosaveStatus = status;
        }),
      );
    },

    redo() {
      const { history, map } = get();

      if (history.future.length === 0 || map === null) return;

      const entry = history.future[0]!;
      const nextMap = applyPatches(map, [...entry.patches]);

      set((state) => {
        state.map = nextMap as unknown as typeof state.map;
        state.history.future = state.history.future.slice(1);
        state.history.past.push({
          patches: [...entry.patches],
          inversePatches: [...entry.inversePatches],
        });
        state.selection = { refs: [] };
        state.autosaveStatus = "pending";
      });

      _scheduleAutosave(nextMap as SeatMap, (status) =>
        set((state) => {
          state.autosaveStatus = status;
        }),
      );
    },

    initMap(map) {
      if (_autosaveTimer !== null) {
        clearTimeout(_autosaveTimer);
        _autosaveTimer = null;
      }
      set((state) => {
        state.map = map as unknown as typeof state.map;
        state.selection = { refs: [] };
        state.history = { past: [], future: [] };
        state.autosaveStatus = "idle";
      });
    },

    setTool(tool) {
      set((state) => {
        state.tool = tool;
      });
    },

    setViewport(partial) {
      set((state) => {
        state.viewport = { ...state.viewport, ...partial };
      });
    },

    setSelection(refs) {
      set((state) => {
        state.selection = { refs: refs as typeof state.selection.refs };
      });
    },

    addToSelection(refs) {
      set((state) => {
        const existing = new Set(
          state.selection.refs.map((r) => `${r.kind}:${r.id}`),
        );
        const toAdd = refs.filter((r) => !existing.has(`${r.kind}:${r.id}`));
        state.selection = {
          refs: [
            ...state.selection.refs,
            ...toAdd,
          ] as typeof state.selection.refs,
        };
      });
    },

    removeFromSelection(refs) {
      set((state) => {
        const toRemove = new Set(refs.map((r) => `${r.kind}:${r.id}`));
        state.selection = {
          refs: state.selection.refs.filter(
            (r) => !toRemove.has(`${r.kind}:${r.id}`),
          ),
        };
      });
    },

    resetSelection() {
      // Alias semántico de clearSelection; delega para mantener un único punto de cambio.
      get().clearSelection();
    },

    clearSelection() {
      set((state) => {
        state.selection = { refs: [] };
      });
    },
  })),
);
