import { enablePatches, produceWithPatches } from "immer";
import type { Patch } from "immer";
import type { Area, Row, SeatMap, Table } from "@domain/model/seatmap";
import { ENTITY_COLLECTION } from "@domain/model/seatmap";
import { createEmptyMap } from "@domain/services/seatMapFactory";
import { importMap } from "@application/usecases/io";
import { fail, failOne, ok, type Result } from "@domain/services/errors";
import type {
  ApplyLabelRuleCommand,
  CreateAreaCommand,
  CreateRowCommand,
  CreateTableCommand,
  DeleteEntitiesCommand,
  EditorCommand,
  ImportMapCommand,
  SetEntityLabelCommand,
  SetSeatLabelOverrideCommand,
  UpdateAreaCapacityCommand,
  UpdateAreaShapeCommand,
  UpdateRowConfigCommand,
  UpdateRowGeometryCommand,
  UpdateTableConfigCommand,
  UpdateTableGeometryCommand,
} from "@application/commands/types";

// Habilitar el plugin de patches de Immer (requerido en v9+).
// Debe llamarse una sola vez antes de cualquier uso de produceWithPatches.
enablePatches();

// ─── Tipo de retorno ──────────────────────────────────────────────────────────

/**
 * Resultado exitoso de un comando.
 *
 * - `map`           → nuevo estado del mapa (immutable).
 * - `patches`       → cambios aplicados (para redo).
 * - `inversePatches`→ cambios inversos (para undo).
 *
 * El store guarda `inversePatches` en el historial.
 */
export interface CommandResult {
  readonly map: SeatMap;
  readonly patches: readonly Patch[];
  readonly inversePatches: readonly Patch[];
}

/**
 * Ejecuta un comando sobre el mapa actual y devuelve el resultado.
 *
 * @param cmd  - Comando tipado a ejecutar.
 * @param map  - Estado actual del mapa (no se muta; se produce un nuevo estado).
 * @returns    `ok(CommandResult)` si tuvo éxito, `fail(errors)` si hay precondición fallida.
 */
export function executeCommand(
  cmd: EditorCommand,
  map: SeatMap,
): Result<CommandResult> {
  switch (cmd.type) {
    case "RESET_MAP":
      return handleResetMap(map);
    case "IMPORT_MAP":
      return handleImportMap(cmd, map);
    case "CREATE_ROW":
      return handleCreateRow(cmd, map);
    case "UPDATE_ROW_GEOMETRY":
      return handleUpdateRowGeometry(cmd, map);
    case "UPDATE_ROW_CONFIG":
      return handleUpdateRowConfig(cmd, map);
    case "CREATE_TABLE":
      return handleCreateTable(cmd, map);
    case "UPDATE_TABLE_GEOMETRY":
      return handleUpdateTableGeometry(cmd, map);
    case "UPDATE_TABLE_CONFIG":
      return handleUpdateTableConfig(cmd, map);
    case "CREATE_AREA":
      return handleCreateArea(cmd, map);
    case "UPDATE_AREA_SHAPE":
      return handleUpdateAreaShape(cmd, map);
    case "UPDATE_AREA_CAPACITY":
      return handleUpdateAreaCapacity(cmd, map);
    case "SET_ENTITY_LABEL":
      return handleSetEntityLabel(cmd, map);
    case "SET_SEAT_LABEL_OVERRIDE":
      return handleSetSeatLabelOverride(cmd, map);
    case "APPLY_LABEL_RULE":
      return handleApplyLabelRule(cmd, map);
    case "DELETE_ENTITIES":
      return handleDeleteEntities(cmd, map);
  }
}

/** Envuelve la salida de `produceWithPatches` en un `CommandResult` exitoso. */
function toResult(
  produced: readonly [SeatMap, Patch[], Patch[]],
): Result<CommandResult> {
  const [map, patches, inversePatches] = produced;
  return ok({ map, patches, inversePatches });
}

/** Actualiza `meta.updatedAt` al momento actual dentro de un draft. */
function touchUpdatedAt(draft: { meta: { updatedAt: string } }): void {
  draft.meta.updatedAt = new Date().toISOString();
}

/**
 * Valida una `LabelingRule` dentro de un payload de comando.
 *
 * Centraliza las 3 reglas (template, startIndex, pad) para evitar
 * duplicación entre CREATE_ROW, CREATE_TABLE y APPLY_LABEL_RULE.
 * Retorna `null` si es válida, o un fallo `Result` accionable si no lo es.
 *
 * @param template   - Valor del campo `template` de la regla.
 * @param startIndex - Valor del campo `startIndex` de la regla.
 * @param pad        - Valor del campo `pad` de la regla.
 * @param pathPrefix - Prefijo del path de error (e.g. "payload.labeling" o "payload.rule").
 */
function validateLabelingRuleCmd(
  template: string,
  startIndex: number,
  pad: number,
  pathPrefix: string,
): Result<never> | null {
  if (template.trim() === "") {
    return failOne<never>({
      code: "CMD_LABELING_TEMPLATE_EMPTY",
      message: "El template de etiquetado no puede estar vacío.",
      path: `${pathPrefix}.template`,
    });
  }
  if (!Number.isInteger(startIndex) || startIndex < 1) {
    return failOne<never>({
      code: "CMD_LABELING_START_INDEX_INVALID",
      message: "startIndex debe ser un entero >= 1.",
      path: `${pathPrefix}.startIndex`,
    });
  }
  if (!Number.isInteger(pad) || pad < 0 || pad > 8) {
    return failOne<never>({
      code: "CMD_LABELING_PAD_INVALID",
      message: "pad debe ser un entero en el rango [0, 8].",
      path: `${pathPrefix}.pad`,
    });
  }
  return null;
}

function handleResetMap(map: SeatMap): Result<CommandResult> {
  const newMap = createEmptyMap();
  // produce(map, () => newMap) reemplaza el estado completo; los patches
  // describen la sustitución completa (el store puede ignorarlos y limpiar historia).
  const produced = produceWithPatches(map, () => newMap);
  return toResult(produced as readonly [SeatMap, Patch[], Patch[]]);
}

// IMPORT_MAP

function handleImportMap(
  cmd: ImportMapCommand,
  map: SeatMap,
): Result<CommandResult> {
  const result = importMap(cmd.payload.json);
  if (!result.ok) return fail(result.errors);

  const importedMap = result.value;
  const produced = produceWithPatches(map, () => importedMap);
  return toResult(produced as readonly [SeatMap, Patch[], Patch[]]);
}

// CREATE_ROW

function handleCreateRow(
  cmd: CreateRowCommand,
  map: SeatMap,
): Result<CommandResult> {
  const {
    id,
    start,
    end,
    seatCount,
    seatSpacing,
    seatRadius,
    label,
    labeling,
  } = cmd.payload;

  // Precondiciones
  if (label.trim() === "") {
    return failOne({
      code: "CMD_ROW_LABEL_EMPTY",
      message: "El label de la fila no puede estar vacío.",
      path: "payload.label",
    });
  }
  if (start.x === end.x && start.y === end.y) {
    return failOne({
      code: "CMD_ROW_START_EQUALS_END",
      message: "El punto de inicio y fin no pueden ser iguales.",
      path: "payload.start",
    });
  }
  if (seatCount < 1) {
    return failOne({
      code: "CMD_ROW_SEAT_COUNT_INVALID",
      message: "seatCount debe ser >= 1.",
      path: "payload.seatCount",
    });
  }
  if (seatSpacing <= 0) {
    return failOne({
      code: "CMD_ROW_SEAT_SPACING_INVALID",
      message: "seatSpacing debe ser > 0.",
      path: "payload.seatSpacing",
    });
  }
  if (seatRadius <= 0) {
    return failOne({
      code: "CMD_ROW_SEAT_RADIUS_INVALID",
      message: "seatRadius debe ser > 0.",
      path: "payload.seatRadius",
    });
  }
  const labelingError = validateLabelingRuleCmd(
    labeling.template,
    labeling.startIndex,
    labeling.pad,
    "payload.labeling",
  );
  if (labelingError !== null) return labelingError;
  if (id in map.entities.rows) {
    return failOne({
      code: "CMD_ROW_DUPLICATE_ID",
      message: `Ya existe una fila con id "${id}".`,
      path: "payload.id",
    });
  }

  const newRow: Row = {
    id,
    start,
    end,
    seatCount,
    seatSpacing,
    seatRadius,
    label,
    labeling,
    seatOverrides: {},
  };

  const produced = produceWithPatches(map, (draft) => {
    draft.entities.rows[id] = newRow as (typeof draft.entities.rows)[string];
    touchUpdatedAt(draft);
  });
  return toResult(produced as readonly [SeatMap, Patch[], Patch[]]);
}

// UPDATE_ROW_GEOMETRY

function handleUpdateRowGeometry(
  cmd: UpdateRowGeometryCommand,
  map: SeatMap,
): Result<CommandResult> {
  const { id, start, end } = cmd.payload;

  const row = map.entities.rows[id];
  if (row === undefined) {
    return failOne({
      code: "CMD_ROW_NOT_FOUND",
      message: `No existe una fila con id "${id}".`,
      path: "payload.id",
    });
  }
  if (start.x === end.x && start.y === end.y) {
    return failOne({
      code: "CMD_ROW_START_EQUALS_END",
      message: "El punto de inicio y fin no pueden ser iguales.",
      path: "payload.start",
    });
  }

  const produced = produceWithPatches(map, (draft) => {
    const draftRow = draft.entities.rows[id];
    if (draftRow) {
      draftRow.start = start;
      draftRow.end = end;
    }
    touchUpdatedAt(draft);
  });
  return toResult(produced as readonly [SeatMap, Patch[], Patch[]]);
}

// UPDATE_ROW_CONFIG

function handleUpdateRowConfig(
  cmd: UpdateRowConfigCommand,
  map: SeatMap,
): Result<CommandResult> {
  const { id, seatCount, seatSpacing, seatRadius } = cmd.payload;

  const row = map.entities.rows[id];
  if (row === undefined) {
    return failOne({
      code: "CMD_ROW_NOT_FOUND",
      message: `No existe una fila con id "${id}".`,
      path: "payload.id",
    });
  }
  if (seatCount !== undefined && seatCount < 1) {
    return failOne({
      code: "CMD_ROW_SEAT_COUNT_INVALID",
      message: "seatCount debe ser >= 1.",
      path: "payload.seatCount",
    });
  }
  if (seatSpacing !== undefined && seatSpacing <= 0) {
    return failOne({
      code: "CMD_ROW_SEAT_SPACING_INVALID",
      message: "seatSpacing debe ser > 0.",
      path: "payload.seatSpacing",
    });
  }
  if (seatRadius !== undefined && seatRadius <= 0) {
    return failOne({
      code: "CMD_ROW_SEAT_RADIUS_INVALID",
      message: "seatRadius debe ser > 0.",
      path: "payload.seatRadius",
    });
  }

  const produced = produceWithPatches(map, (draft) => {
    const draftRow = draft.entities.rows[id];
    if (!draftRow) return;

    if (seatCount !== undefined) {
      draftRow.seatCount = seatCount;
      // Eliminar overrides fuera del nuevo rango
      for (const key of Object.keys(draftRow.seatOverrides)) {
        if (Number(key) >= seatCount) {
          delete draftRow.seatOverrides[Number(key)];
        }
      }
    }
    if (seatSpacing !== undefined) draftRow.seatSpacing = seatSpacing;
    if (seatRadius !== undefined) draftRow.seatRadius = seatRadius;
    touchUpdatedAt(draft);
  });
  return toResult(produced as readonly [SeatMap, Patch[], Patch[]]);
}

// CREATE_TABLE

function handleCreateTable(
  cmd: CreateTableCommand,
  map: SeatMap,
): Result<CommandResult> {
  const { id, center, radius, seatCount, seatRadius, label, labeling } =
    cmd.payload;

  if (label.trim() === "") {
    return failOne({
      code: "CMD_TABLE_LABEL_EMPTY",
      message: "El label de la mesa no puede estar vacío.",
      path: "payload.label",
    });
  }
  if (radius <= 0) {
    return failOne({
      code: "CMD_TABLE_RADIUS_INVALID",
      message: "El radio de la mesa debe ser > 0.",
      path: "payload.radius",
    });
  }
  if (seatCount < 1) {
    return failOne({
      code: "CMD_TABLE_SEAT_COUNT_INVALID",
      message: "seatCount debe ser >= 1.",
      path: "payload.seatCount",
    });
  }
  if (seatRadius <= 0) {
    return failOne({
      code: "CMD_TABLE_SEAT_RADIUS_INVALID",
      message: "seatRadius debe ser > 0.",
      path: "payload.seatRadius",
    });
  }
  const tableLabelingError = validateLabelingRuleCmd(
    labeling.template,
    labeling.startIndex,
    labeling.pad,
    "payload.labeling",
  );
  if (tableLabelingError !== null) return tableLabelingError;
  if (id in map.entities.tables) {
    return failOne({
      code: "CMD_TABLE_DUPLICATE_ID",
      message: `Ya existe una mesa con id "${id}".`,
      path: "payload.id",
    });
  }

  const newTable: Table = {
    id,
    center,
    radius,
    seatCount,
    seatRadius,
    label,
    labeling,
    seatOverrides: {},
  };

  const produced = produceWithPatches(map, (draft) => {
    draft.entities.tables[id] =
      newTable as (typeof draft.entities.tables)[string];
    touchUpdatedAt(draft);
  });
  return toResult(produced as readonly [SeatMap, Patch[], Patch[]]);
}

// UPDATE_TABLE_GEOMETRY

function handleUpdateTableGeometry(
  cmd: UpdateTableGeometryCommand,
  map: SeatMap,
): Result<CommandResult> {
  const { id, center, radius } = cmd.payload;

  const table = map.entities.tables[id];
  if (table === undefined) {
    return failOne({
      code: "CMD_TABLE_NOT_FOUND",
      message: `No existe una mesa con id "${id}".`,
      path: "payload.id",
    });
  }
  if (radius <= 0) {
    return failOne({
      code: "CMD_TABLE_RADIUS_INVALID",
      message: "El radio de la mesa debe ser > 0.",
      path: "payload.radius",
    });
  }

  const produced = produceWithPatches(map, (draft) => {
    const draftTable = draft.entities.tables[id];
    if (draftTable) {
      draftTable.center = center;
      draftTable.radius = radius;
    }
    touchUpdatedAt(draft);
  });
  return toResult(produced as readonly [SeatMap, Patch[], Patch[]]);
}

// UPDATE_TABLE_CONFIG

function handleUpdateTableConfig(
  cmd: UpdateTableConfigCommand,
  map: SeatMap,
): Result<CommandResult> {
  const { id, seatCount, seatRadius } = cmd.payload;

  const table = map.entities.tables[id];
  if (table === undefined) {
    return failOne({
      code: "CMD_TABLE_NOT_FOUND",
      message: `No existe una mesa con id "${id}".`,
      path: "payload.id",
    });
  }
  if (seatCount !== undefined && seatCount < 1) {
    return failOne({
      code: "CMD_TABLE_SEAT_COUNT_INVALID",
      message: "seatCount debe ser >= 1.",
      path: "payload.seatCount",
    });
  }
  if (seatRadius !== undefined && seatRadius <= 0) {
    return failOne({
      code: "CMD_TABLE_SEAT_RADIUS_INVALID",
      message: "seatRadius debe ser > 0.",
      path: "payload.seatRadius",
    });
  }

  const produced = produceWithPatches(map, (draft) => {
    const draftTable = draft.entities.tables[id];
    if (!draftTable) return;

    if (seatCount !== undefined) {
      draftTable.seatCount = seatCount;
      // Eliminar overrides fuera del nuevo rango
      for (const key of Object.keys(draftTable.seatOverrides)) {
        if (Number(key) >= seatCount) {
          delete draftTable.seatOverrides[Number(key)];
        }
      }
    }
    if (seatRadius !== undefined) draftTable.seatRadius = seatRadius;
    touchUpdatedAt(draft);
  });
  return toResult(produced as readonly [SeatMap, Patch[], Patch[]]);
}

// CREATE_AREA

function handleCreateArea(
  cmd: CreateAreaCommand,
  map: SeatMap,
): Result<CommandResult> {
  const { id, points, label, capacity } = cmd.payload;

  if (label.trim() === "") {
    return failOne({
      code: "CMD_AREA_LABEL_EMPTY",
      message: "El label del área no puede estar vacío.",
      path: "payload.label",
    });
  }
  if (points.length < 3) {
    return failOne({
      code: "CMD_AREA_POLYGON_TOO_FEW_POINTS",
      message: "El polígono del área debe tener al menos 3 puntos.",
      path: "payload.points",
    });
  }
  if (capacity < 0) {
    return failOne({
      code: "CMD_AREA_CAPACITY_INVALID",
      message: "La capacidad del área debe ser >= 0.",
      path: "payload.capacity",
    });
  }
  if (id in map.entities.areas) {
    return failOne({
      code: "CMD_AREA_DUPLICATE_ID",
      message: `Ya existe un área con id "${id}".`,
      path: "payload.id",
    });
  }

  const newArea: Area = { id, points, label, capacity };

  const produced = produceWithPatches(map, (draft) => {
    draft.entities.areas[id] = newArea as (typeof draft.entities.areas)[string];
    touchUpdatedAt(draft);
  });
  return toResult(produced as readonly [SeatMap, Patch[], Patch[]]);
}

// UPDATE_AREA_SHAPE

function handleUpdateAreaShape(
  cmd: UpdateAreaShapeCommand,
  map: SeatMap,
): Result<CommandResult> {
  const { id, points } = cmd.payload;

  const area = map.entities.areas[id];
  if (area === undefined) {
    return failOne({
      code: "CMD_AREA_NOT_FOUND",
      message: `No existe un área con id "${id}".`,
      path: "payload.id",
    });
  }
  if (points.length < 3) {
    return failOne({
      code: "CMD_AREA_POLYGON_TOO_FEW_POINTS",
      message: "El polígono del área debe tener al menos 3 puntos.",
      path: "payload.points",
    });
  }

  const produced = produceWithPatches(map, (draft) => {
    const draftArea = draft.entities.areas[id];
    if (draftArea) {
      draftArea.points = points as typeof draftArea.points;
    }
    touchUpdatedAt(draft);
  });
  return toResult(produced as readonly [SeatMap, Patch[], Patch[]]);
}

// UPDATE_AREA_CAPACITY

function handleUpdateAreaCapacity(
  cmd: UpdateAreaCapacityCommand,
  map: SeatMap,
): Result<CommandResult> {
  const { id, capacity } = cmd.payload;

  const area = map.entities.areas[id];
  if (area === undefined) {
    return failOne({
      code: "CMD_AREA_NOT_FOUND",
      message: `No existe un área con id "${id}".`,
      path: "payload.id",
    });
  }
  if (capacity < 0) {
    return failOne({
      code: "CMD_AREA_CAPACITY_INVALID",
      message: "La capacidad del área debe ser >= 0.",
      path: "payload.capacity",
    });
  }

  const produced = produceWithPatches(map, (draft) => {
    const draftArea = draft.entities.areas[id];
    if (draftArea) draftArea.capacity = capacity;
    touchUpdatedAt(draft);
  });
  return toResult(produced as readonly [SeatMap, Patch[], Patch[]]);
}

// SET_ENTITY_LABEL

function handleSetEntityLabel(
  cmd: SetEntityLabelCommand,
  map: SeatMap,
): Result<CommandResult> {
  const { kind, id, label } = cmd.payload;

  if (label.trim() === "") {
    return failOne({
      code: "CMD_ENTITY_LABEL_EMPTY",
      message: "El label de la entidad no puede estar vacío.",
      path: "payload.label",
    });
  }

  const collection = ENTITY_COLLECTION[kind];
  const entity = (map.entities[collection] as Record<string, unknown>)[id];
  if (entity === undefined) {
    return failOne({
      code: "CMD_ENTITY_NOT_FOUND",
      message: `No existe una entidad de tipo "${kind}" con id "${id}".`,
      path: "payload.id",
    });
  }

  const produced = produceWithPatches(map, (draft) => {
    const col = draft.entities[collection] as Record<string, { label: string }>;
    const draftEntity = col[id];
    if (draftEntity) draftEntity.label = label;
    touchUpdatedAt(draft);
  });
  return toResult(produced as readonly [SeatMap, Patch[], Patch[]]);
}

// SET_SEAT_LABEL_OVERRIDE

function handleSetSeatLabelOverride(
  cmd: SetSeatLabelOverrideCommand,
  map: SeatMap,
): Result<CommandResult> {
  const { kind, id, seatIndex, label } = cmd.payload;

  if (label.trim() === "") {
    return failOne({
      code: "CMD_SEAT_OVERRIDE_LABEL_EMPTY",
      message: "El label del override no puede estar vacío.",
      path: "payload.label",
    });
  }

  const entity =
    kind === "row" ? map.entities.rows[id] : map.entities.tables[id];

  if (entity === undefined) {
    return failOne({
      code: "CMD_ENTITY_NOT_FOUND",
      message: `No existe una entidad de tipo "${kind}" con id "${id}".`,
      path: "payload.id",
    });
  }
  if (seatIndex < 0 || seatIndex >= entity.seatCount) {
    return failOne({
      code: "CMD_SEAT_INDEX_OUT_OF_RANGE",
      message: `El índice ${seatIndex} está fuera del rango [0, ${entity.seatCount}).`,
      path: "payload.seatIndex",
    });
  }

  const produced = produceWithPatches(map, (draft) => {
    const col = kind === "row" ? draft.entities.rows : draft.entities.tables;
    const draftEntity = col[id];
    if (draftEntity) {
      draftEntity.seatOverrides[seatIndex] = { label };
    }
    touchUpdatedAt(draft);
  });
  return toResult(produced as readonly [SeatMap, Patch[], Patch[]]);
}

// APPLY_LABEL_RULE

function handleApplyLabelRule(
  cmd: ApplyLabelRuleCommand,
  map: SeatMap,
): Result<CommandResult> {
  const { kind, id, rule } = cmd.payload;

  const labelRuleError = validateLabelingRuleCmd(
    rule.template,
    rule.startIndex,
    rule.pad,
    "payload.rule",
  );
  if (labelRuleError !== null) return labelRuleError;

  const entity =
    kind === "row" ? map.entities.rows[id] : map.entities.tables[id];

  if (entity === undefined) {
    return failOne({
      code: "CMD_ENTITY_NOT_FOUND",
      message: `No existe una entidad de tipo "${kind}" con id "${id}".`,
      path: "payload.id",
    });
  }

  const produced = produceWithPatches(map, (draft) => {
    const col = kind === "row" ? draft.entities.rows : draft.entities.tables;
    const draftEntity = col[id];
    if (draftEntity) {
      draftEntity.labeling = rule;
      // Limpiar overrides: la nueva regla aplica a todos los asientos
      draftEntity.seatOverrides = {};
    }
    touchUpdatedAt(draft);
  });
  return toResult(produced as readonly [SeatMap, Patch[], Patch[]]);
}

// DELETE_ENTITIES

function handleDeleteEntities(
  cmd: DeleteEntitiesCommand,
  map: SeatMap,
): Result<CommandResult> {
  const { refs } = cmd.payload;

  if (refs.length === 0) {
    // No-op: devolvemos el mismo mapa sin patches
    const produced = produceWithPatches(map, () => {
      /* sin cambios */
    });
    return toResult(produced as readonly [SeatMap, Patch[], Patch[]]);
  }

  // Verificar que todos los refs existen (si alguno no existe → error)
  for (const ref of refs) {
    const collection = ENTITY_COLLECTION[ref.kind];
    const entity = (map.entities[collection] as Record<string, unknown>)[
      ref.id
    ];
    if (entity === undefined) {
      return failOne({
        code: "CMD_ENTITY_NOT_FOUND",
        message: `No existe la entidad "${ref.kind}" con id "${ref.id}".`,
        path: `payload.refs[${ref.kind}:${ref.id}]`,
      });
    }
  }

  const produced = produceWithPatches(map, (draft) => {
    for (const ref of refs) {
      const collection = ENTITY_COLLECTION[ref.kind];
      delete (draft.entities[collection] as Record<string, unknown>)[ref.id];
    }
    touchUpdatedAt(draft);
  });
  return toResult(produced as readonly [SeatMap, Patch[], Patch[]]);
}
