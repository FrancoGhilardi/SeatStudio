import type { KonvaEventObject } from "konva/lib/Node";
import type { EntityKind, EntityRef, Point } from "@domain/model/seatmap";
import type { EditorCommand } from "@application/commands/types";
import type { DomainError } from "@domain/services/errors";
import type { EditorTool } from "@store/editor.store";

// ─── Estado de dibujo en curso (transitorio, vive en CanvasStage) ────────────

/**
 * Discriminated union que representa el estado transitorio del tool activo.
 *
 * `idle`           → sin operación de dibujo en progreso.
 * `rowFirstPoint`  → se capturó el punto de inicio de una fila; esperando el final.
 * `areaInProgress` → polígono de área en construcción; esperando más puntos o cierre.
 */
export type DrawingState =
  | { readonly kind: "idle" }
  | { readonly kind: "rowFirstPoint"; readonly start: Point }
  | { readonly kind: "areaInProgress"; readonly points: readonly Point[] };

// ─── Contexto disponible para cada tool ──────────────────────────────────────

/**
 * Snapshot de contexto inmutable pasado a cada handler del tool.
 *
 * Los tools NUNCA deben guardar referencias a este objeto entre llamadas;
 * cada invocación recibe un contexto fresco.
 */
export interface ToolContext {
  /** Posición del puntero en coordenadas mundo (ya desescalada del viewport). */
  readonly worldPos: Point;
  /** `true` si Shift estaba presionado en el evento. */
  readonly isShift: boolean;
  /** Referencias de la selección actual en el momento del evento. */
  readonly selectionRefs: readonly EntityRef[];

  // ── Comandos de dominio ──
  /** Despacha un comando tipado. Devuelve errores vacío si tuvo éxito. */
  dispatch(cmd: EditorCommand): readonly DomainError[];

  // ── Selección ──
  setSelection(refs: readonly EntityRef[]): void;
  /**
   * Alterna una referencia en la selección:
   *  - Si ya está → la quita.
   *  - Si no está → la agrega.
   */
  toggleSelection(ref: EntityRef): void;
  clearSelection(): void;

  // ── Consultas del mapa ──
  /** Cantidad actual de entidades de ese tipo (para generar labels auto). */
  getEntityCount(kind: EntityKind): number;

  // ── Estado de dibujo ──
  readonly drawingState: DrawingState;
  setDrawingState(s: DrawingState): void;

  // ── Herramienta ──
  setTool(t: EditorTool): void;
}

// ─── Interfaz de herramienta (Strategy) ──────────────────────────────────────

export interface CanvasTool {
  /**
   * Clic en el fondo vacío del canvas (el Stage no detectó ninguna entidad).
   * El `select` tool limpia selección; los tools de creación usan esto para
   * capturar puntos de inicio/fin.
   */
  onBgClick(ctx: ToolContext, e: KonvaEventObject<MouseEvent>): void;

  /**
   * Doble-clic en el fondo.
   * Usado por `CreateAreaTool` para cerrar el polígono.
   * Opcional; si no se provee, el canvas no conecta el evento.
   */
  onBgDblClick?(ctx: ToolContext, e: KonvaEventObject<MouseEvent>): void;

  /**
   * Clic sobre una entidad (fila, mesa o área).
   * `SelectTool` modifica la selección; los tools de creación lo ignoran.
   */
  onEntityClick(
    ctx: ToolContext,
    ref: EntityRef,
    e: KonvaEventObject<MouseEvent>,
  ): void;
}
