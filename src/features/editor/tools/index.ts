import type { EditorTool } from "@store/editor.store";
import type { CanvasTool } from "./types";
import { selectTool } from "./selectTool";
import { createRowTool } from "./createRowTool";
import { createTableTool } from "./createTableTool";
import { createAreaTool } from "./createAreaTool";

export const TOOL_REGISTRY: Readonly<Record<EditorTool, CanvasTool>> = {
  select: selectTool,
  addRow: createRowTool,
  addTable: createTableTool,
  addArea: createAreaTool,
};

// Re-exportaciones para importaciones directas
export type { CanvasTool, DrawingState, ToolContext } from "./types";
export { selectTool } from "./selectTool";
export { createRowTool } from "./createRowTool";
export { createTableTool } from "./createTableTool";
export { createAreaTool } from "./createAreaTool";
