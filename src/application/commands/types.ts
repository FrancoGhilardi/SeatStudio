import type {
  EntityKind,
  EntityRef,
  LabelingRule,
  Point,
  Polygon,
} from "@domain/model/seatmap";

export interface ResetMapCommand {
  readonly type: "RESET_MAP";
}

export interface ImportMapCommand {
  readonly type: "IMPORT_MAP";
  readonly payload: {
    /** JSON sin parsear proveniente de un archivo o textarea. */
    readonly json: unknown;
  };
}

export interface CreateRowCommand {
  readonly type: "CREATE_ROW";
  readonly payload: {
    readonly id: string;
    readonly start: Point;
    readonly end: Point;
    readonly seatCount: number;
    readonly seatSpacing: number;
    readonly seatRadius: number;
    readonly label: string;
    readonly labeling: LabelingRule;
  };
}

export interface UpdateRowGeometryCommand {
  readonly type: "UPDATE_ROW_GEOMETRY";
  readonly payload: {
    readonly id: string;
    readonly start: Point;
    readonly end: Point;
  };
}

export interface UpdateRowConfigCommand {
  readonly type: "UPDATE_ROW_CONFIG";
  readonly payload: {
    readonly id: string;
    readonly seatCount?: number;
    readonly seatSpacing?: number;
    readonly seatRadius?: number;
  };
}

export interface CreateTableCommand {
  readonly type: "CREATE_TABLE";
  readonly payload: {
    readonly id: string;
    readonly center: Point;
    readonly radius: number;
    readonly seatCount: number;
    readonly seatRadius: number;
    readonly label: string;
    readonly labeling: LabelingRule;
  };
}

export interface UpdateTableGeometryCommand {
  readonly type: "UPDATE_TABLE_GEOMETRY";
  readonly payload: {
    readonly id: string;
    readonly center: Point;
    readonly radius: number;
  };
}

export interface UpdateTableConfigCommand {
  readonly type: "UPDATE_TABLE_CONFIG";
  readonly payload: {
    readonly id: string;
    readonly seatCount?: number;
    readonly seatRadius?: number;
  };
}

// ─── AREAS ───────────────────────────────────────────────────────────────────

export interface CreateAreaCommand {
  readonly type: "CREATE_AREA";
  readonly payload: {
    readonly id: string;
    readonly points: Polygon;
    readonly label: string;
    readonly capacity: number;
  };
}

export interface UpdateAreaShapeCommand {
  readonly type: "UPDATE_AREA_SHAPE";
  readonly payload: {
    readonly id: string;
    readonly points: Polygon;
  };
}

export interface UpdateAreaCapacityCommand {
  readonly type: "UPDATE_AREA_CAPACITY";
  readonly payload: {
    readonly id: string;
    readonly capacity: number;
  };
}

export interface SetEntityLabelCommand {
  readonly type: "SET_ENTITY_LABEL";
  readonly payload: {
    readonly kind: EntityKind;
    readonly id: string;
    readonly label: string;
  };
}

export interface SetSeatLabelOverrideCommand {
  readonly type: "SET_SEAT_LABEL_OVERRIDE";
  readonly payload: {
    /** Solo filas y mesas tienen asientos derivados. */
    readonly kind: "row" | "table";
    readonly id: string;
    /** Índice 0-based del asiento. */
    readonly seatIndex: number;
    readonly label: string;
  };
}

export interface ApplyLabelRuleCommand {
  readonly type: "APPLY_LABEL_RULE";
  readonly payload: {
    readonly kind: "row" | "table";
    readonly id: string;
    readonly rule: LabelingRule;
  };
}

export interface DeleteEntitiesCommand {
  readonly type: "DELETE_ENTITIES";
  readonly payload: {
    /** Referencias a las entidades a eliminar (puede mezclar rows/tables/areas). */
    readonly refs: readonly EntityRef[];
  };
}

/**
 * Aplica un label a múltiples entidades en una sola operación atómica.
 * Genera una sola entrada en el historial de undo/redo.
 */
export interface BatchSetEntityLabelsCommand {
  readonly type: "BATCH_SET_ENTITY_LABELS";
  readonly payload: {
    readonly items: ReadonlyArray<{
      readonly kind: EntityKind;
      readonly id: string;
      readonly label: string;
    }>;
  };
}

/**
 * Aplica una LabelingRule a múltiples filas o mesas en una sola operación atómica.
 * Limpia todos los seatOverrides de cada entidad afectada.
 * Genera una sola entrada en el historial de undo/redo.
 */
export interface BatchApplyLabelRuleCommand {
  readonly type: "BATCH_APPLY_LABEL_RULE";
  readonly payload: {
    readonly items: ReadonlyArray<{
      readonly kind: "row" | "table";
      readonly id: string;
      readonly rule: LabelingRule;
    }>;
  };
}

/**
 * Unión de todos los comandos del MVP.
 * Usar en `executeCommand(cmd: EditorCommand, map: SeatMap)`.
 */
export type EditorCommand =
  | ResetMapCommand
  | ImportMapCommand
  | CreateRowCommand
  | UpdateRowGeometryCommand
  | UpdateRowConfigCommand
  | CreateTableCommand
  | UpdateTableGeometryCommand
  | UpdateTableConfigCommand
  | CreateAreaCommand
  | UpdateAreaShapeCommand
  | UpdateAreaCapacityCommand
  | SetEntityLabelCommand
  | SetSeatLabelOverrideCommand
  | ApplyLabelRuleCommand
  | DeleteEntitiesCommand
  | BatchSetEntityLabelsCommand
  | BatchApplyLabelRuleCommand;

/** Extrae el `type` de cualquier EditorCommand. Útil para switches exhaustivos. */
export type EditorCommandType = EditorCommand["type"];
