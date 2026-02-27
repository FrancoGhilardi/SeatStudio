import { nanoid } from "nanoid";
import type { CanvasTool, ToolContext } from "./types";

const DEFAULT_SEAT_COUNT = 8;
const DEFAULT_SEAT_SPACING = 40;
const DEFAULT_SEAT_RADIUS = 14;

export const createRowTool: CanvasTool = {
  onBgClick(ctx: ToolContext): void {
    const { drawingState, worldPos } = ctx;

    if (drawingState.kind === "idle") {
      // Primer clic: marca el punto de inicio
      ctx.setDrawingState({ kind: "rowFirstPoint", start: worldPos });
      return;
    }

    if (drawingState.kind === "rowFirstPoint") {
      const { start } = drawingState;

      // Evitar fila de longitud cero (doble-clic accidental en el mismo punto)
      const dx = worldPos.x - start.x;
      const dy = worldPos.y - start.y;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

      const n = ctx.getEntityCount("row");
      const rowLabel = `Fila ${n + 1}`;

      const errors = ctx.dispatch({
        type: "CREATE_ROW",
        payload: {
          id: nanoid(),
          start,
          end: worldPos,
          seatCount: DEFAULT_SEAT_COUNT,
          seatSpacing: DEFAULT_SEAT_SPACING,
          seatRadius: DEFAULT_SEAT_RADIUS,
          label: rowLabel,
          labeling: {
            template: "{row}-{n}",
            startIndex: 1,
            pad: 0,
          },
        },
      });

      // Siempre reseteamos el estado de dibujo
      ctx.setDrawingState({ kind: "idle" });

      if (errors.length === 0) {
        // Tras crear exitosamente, volver a la herramienta de selección
        ctx.setTool("select");
      }
    }
  },

  onEntityClick(): void {
    // Los tools de creación ignoran clics sobre entidades existentes
  },
};
