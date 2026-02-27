import { nanoid } from "nanoid";
import type { CanvasTool, ToolContext } from "./types";
import type { Polygon } from "@domain/model/seatmap";

export const createAreaTool: CanvasTool = {
  onBgClick(ctx: ToolContext): void {
    const { drawingState, worldPos } = ctx;

    if (drawingState.kind === "idle") {
      // Comenzar un nuevo polígono con el primer punto
      ctx.setDrawingState({ kind: "areaInProgress", points: [worldPos] });
      return;
    }

    if (drawingState.kind === "areaInProgress") {
      // Agregar el siguiente vértice
      ctx.setDrawingState({
        kind: "areaInProgress",
        points: [...drawingState.points, worldPos],
      });
    }
  },

  onBgDblClick(ctx: ToolContext): void {
    const { drawingState } = ctx;
    if (drawingState.kind !== "areaInProgress") return;

    // El `click` que precede al `dblclick` ya añadió un punto duplicado;
    // lo eliminamos para obtener los vértices reales.
    const pointsWithoutExtra = drawingState.points.slice(0, -1);

    if (pointsWithoutExtra.length < 3) {
      // Polígono insuficiente → cancelar sin crear
      ctx.setDrawingState({ kind: "idle" });
      ctx.setTool("select");
      return;
    }

    // Validamos que el array tiene al menos 3 elementos para satisfacer el tipo
    const [p0, p1, p2, ...rest] = pointsWithoutExtra as [
      (typeof pointsWithoutExtra)[0],
      (typeof pointsWithoutExtra)[0],
      (typeof pointsWithoutExtra)[0],
      ...(typeof pointsWithoutExtra)[0][],
    ];
    const polygon: Polygon = [p0!, p1!, p2!, ...rest];

    const n = ctx.getEntityCount("area");
    const errors = ctx.dispatch({
      type: "CREATE_AREA",
      payload: {
        id: nanoid(),
        points: polygon,
        label: `Área ${n + 1}`,
        capacity: 0,
      },
    });

    ctx.setDrawingState({ kind: "idle" });
    if (errors.length === 0) {
      ctx.setTool("select");
    }
  },

  onEntityClick(): void {
    // Ignorar entidades al dibujar área
  },
};
