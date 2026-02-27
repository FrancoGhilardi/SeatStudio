import { nanoid } from "nanoid";
import type { CanvasTool, ToolContext } from "./types";

const DEFAULT_TABLE_RADIUS = 60;
const DEFAULT_SEAT_COUNT = 8;
const DEFAULT_SEAT_RADIUS = 14;

export const createTableTool: CanvasTool = {
  onBgClick(ctx: ToolContext): void {
    const n = ctx.getEntityCount("table");
    const tableLabel = `Mesa ${n + 1}`;

    const errors = ctx.dispatch({
      type: "CREATE_TABLE",
      payload: {
        id: nanoid(),
        center: ctx.worldPos,
        radius: DEFAULT_TABLE_RADIUS,
        seatCount: DEFAULT_SEAT_COUNT,
        seatRadius: DEFAULT_SEAT_RADIUS,
        label: tableLabel,
        labeling: {
          template: "{table}-{n}",
          startIndex: 1,
          pad: 0,
        },
      },
    });

    if (errors.length === 0) {
      ctx.setTool("select");
    }
  },

  onEntityClick(): void {
    // Ignorar entidades al colocar mesa
  },
};
