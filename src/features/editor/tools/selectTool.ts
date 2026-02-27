import type { CanvasTool, ToolContext } from "./types";
import type { EntityRef } from "@domain/model/seatmap";
import type { KonvaEventObject } from "konva/lib/Node";

export const selectTool: CanvasTool = {
  onBgClick(ctx: ToolContext, e: KonvaEventObject<MouseEvent>): void {
    // Shift+clic en fondo → no romper selección existente
    if (e.evt.shiftKey) return;
    ctx.clearSelection();
  },

  onEntityClick(
    ctx: ToolContext,
    ref: EntityRef,
    e: KonvaEventObject<MouseEvent>,
  ): void {
    if (e.evt.shiftKey) {
      ctx.toggleSelection(ref);
    } else {
      ctx.setSelection([ref]);
    }
  },
};
