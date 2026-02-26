import type { Area, Row, SeatMap, Table } from "@domain/model";
import { getRowSeatLabel, getTableSeatLabel } from "@domain/services/labeling";
import {
  type DomainError,
  type Result,
  fail,
  ok,
} from "@domain/services/errors";

// Helpers internos reutilizables

/**
 * Valida la `LabelingRule` de cualquier entidad con asientos derivados.
 * Centraliza las reglas de startIndex y pad para evitar duplicación entre Row y Table.
 */
function validateLabelingRule(
  template: string,
  startIndex: number,
  pad: number,
  pathFn: (field: string) => string,
  codePrefix: "ROW" | "TABLE",
): DomainError[] {
  const errors: DomainError[] = [];

  if (template.trim() === "") {
    errors.push({
      code: `${codePrefix}_LABELING_TEMPLATE_EMPTY`,
      message: "El template de etiquetado no puede estar vacío.",
      path: pathFn("labeling.template"),
    });
  }
  if (!Number.isInteger(startIndex) || startIndex < 1) {
    errors.push({
      code: `${codePrefix}_LABELING_START_INDEX_INVALID`,
      message: "startIndex debe ser un entero >= 1.",
      path: pathFn("labeling.startIndex"),
    });
  }
  if (!Number.isInteger(pad) || pad < 0 || pad > 8) {
    errors.push({
      code: `${codePrefix}_LABELING_PAD_INVALID`,
      message: "pad debe ser un entero en el rango [0, 8].",
      path: pathFn("labeling.pad"),
    });
  }

  return errors;
}

/**
 * Valida los overrides de asientos de cualquier entidad (Row o Table).
 * Comprueba que los índices estén en rango [0, seatCount) y los labels no vacíos.
 */
function validateSeatOverrides(
  overrides: Readonly<Record<number, { readonly label: string }>>,
  seatCount: number,
  pathFn: (field: string) => string,
  codePrefix: "ROW" | "TABLE",
): DomainError[] {
  const errors: DomainError[] = [];

  for (const key of Object.keys(overrides)) {
    const idx = Number(key);
    if (!Number.isInteger(idx) || idx < 0 || idx >= seatCount) {
      errors.push({
        code: `${codePrefix}_OVERRIDE_OUT_OF_RANGE`,
        message: `El índice de override ${idx} está fuera del rango [0, ${seatCount}).`,
        path: pathFn(`seatOverrides.${idx}`),
      });
    } else {
      const override = overrides[idx];
      if (override !== undefined && override.label.trim() === "") {
        errors.push({
          code: `${codePrefix}_OVERRIDE_LABEL_EMPTY`,
          message: `El label del override en índice ${idx} no puede estar vacío.`,
          path: pathFn(`seatOverrides.${idx}.label`),
        });
      }
    }
  }

  return errors;
}

// Validadores por entidad

function validateRow(row: Row, id: string): DomainError[] {
  const errors: DomainError[] = [];
  const p = (field: string) => `rows.${id}.${field}`;

  // Label de la fila
  if (row.label.trim() === "") {
    errors.push({
      code: "ROW_LABEL_EMPTY",
      message: "El label de la fila no puede estar vacío.",
      path: p("label"),
    });
  }

  // LabelingRule
  errors.push(
    ...validateLabelingRule(
      row.labeling.template,
      row.labeling.startIndex,
      row.labeling.pad,
      p,
      "ROW",
    ),
  );

  // Invariante geométrica: start !== end
  if (row.start.x === row.end.x && row.start.y === row.end.y) {
    errors.push({
      code: "ROW_START_EQUALS_END",
      message: "El punto de inicio y fin de la fila no pueden ser iguales.",
      path: p("start"),
    });
  }

  // Restricciones numéricas
  if (row.seatCount < 1) {
    errors.push({
      code: "ROW_SEAT_COUNT_INVALID",
      message: "seatCount debe ser >= 1.",
      path: p("seatCount"),
    });
  }
  if (row.seatSpacing <= 0) {
    errors.push({
      code: "ROW_SEAT_SPACING_INVALID",
      message: "seatSpacing debe ser > 0.",
      path: p("seatSpacing"),
    });
  }
  if (row.seatRadius <= 0) {
    errors.push({
      code: "ROW_SEAT_RADIUS_INVALID",
      message: "seatRadius debe ser > 0.",
      path: p("seatRadius"),
    });
  }

  // Overrides de asientos
  errors.push(
    ...validateSeatOverrides(row.seatOverrides, row.seatCount, p, "ROW"),
  );

  // Labels derivados: ninguno puede quedar vacío.
  // Solo se evalúan si no hay errores previos para evitar falsos positivos
  // causados por seatCount inválido o template vacío.
  if (errors.length === 0) {
    for (let i = 0; i < row.seatCount; i++) {
      const label = getRowSeatLabel(row, i);
      if (label.trim() === "") {
        errors.push({
          code: "ROW_SEAT_LABEL_EMPTY",
          message: `El label derivado del asiento ${i} de la fila "${row.label}" está vacío.`,
          path: p(`seat.${i}.label`),
        });
      }
    }
  }

  return errors;
}

function validateTable(table: Table, id: string): DomainError[] {
  const errors: DomainError[] = [];
  const p = (field: string) => `tables.${id}.${field}`;

  if (table.label.trim() === "") {
    errors.push({
      code: "TABLE_LABEL_EMPTY",
      message: "El label de la mesa no puede estar vacío.",
      path: p("label"),
    });
  }

  // LabelingRule
  errors.push(
    ...validateLabelingRule(
      table.labeling.template,
      table.labeling.startIndex,
      table.labeling.pad,
      p,
      "TABLE",
    ),
  );

  if (table.radius <= 0) {
    errors.push({
      code: "TABLE_RADIUS_INVALID",
      message: "El radio de la mesa debe ser > 0.",
      path: p("radius"),
    });
  }
  if (table.seatCount < 1) {
    errors.push({
      code: "TABLE_SEAT_COUNT_INVALID",
      message: "seatCount debe ser >= 1.",
      path: p("seatCount"),
    });
  }
  if (table.seatRadius <= 0) {
    errors.push({
      code: "TABLE_SEAT_RADIUS_INVALID",
      message: "seatRadius debe ser > 0.",
      path: p("seatRadius"),
    });
  }

  // Overrides de asientos
  errors.push(
    ...validateSeatOverrides(table.seatOverrides, table.seatCount, p, "TABLE"),
  );

  // Labels derivados: ninguno puede quedar vacío.
  // Solo se evalúan si no hay errores previos para evitar falsos positivos.
  if (errors.length === 0) {
    for (let i = 0; i < table.seatCount; i++) {
      const label = getTableSeatLabel(table, i);
      if (label.trim() === "") {
        errors.push({
          code: "TABLE_SEAT_LABEL_EMPTY",
          message: `El label derivado del asiento ${i} de la mesa "${table.label}" está vacío.`,
          path: p(`seat.${i}.label`),
        });
      }
    }
  }

  return errors;
}

function validateArea(area: Area, id: string): DomainError[] {
  const errors: DomainError[] = [];
  const p = (field: string) => `areas.${id}.${field}`;

  if (area.label.trim() === "") {
    errors.push({
      code: "AREA_LABEL_EMPTY",
      message: "El label del área no puede estar vacío.",
      path: p("label"),
    });
  }
  if (area.capacity < 0) {
    errors.push({
      code: "AREA_CAPACITY_INVALID",
      message: "La capacidad del área debe ser >= 0.",
      path: p("capacity"),
    });
  }
  // El tipo Polygon garantiza >= 3 puntos en tiempo de compilación,
  // pero validamos en runtime para datos provenientes de JSON externo.
  if (area.points.length < 3) {
    errors.push({
      code: "AREA_POLYGON_TOO_FEW_POINTS",
      message: "El polígono del área debe tener al menos 3 puntos.",
      path: p("points"),
    });
  }

  return errors;
}

// Validador principal del mapa

/**
 * Valida todas las invariantes del dominio sobre un `SeatMap`.
 *
 * Retorna `ok(map)` si todo es válido, o `fail(errors)` con la lista
 * completa y accionable de problemas encontrados.
 */
export function validateMap(map: SeatMap): Result<SeatMap> {
  const errors: DomainError[] = [];

  // Meta
  if (map.meta.name.trim() === "") {
    errors.push({
      code: "MAP_NAME_EMPTY",
      message: "El nombre del mapa no puede estar vacío.",
      path: "meta.name",
    });
  }

  // Entidades
  for (const [id, row] of Object.entries(map.entities.rows)) {
    errors.push(...validateRow(row, id));
  }
  for (const [id, table] of Object.entries(map.entities.tables)) {
    errors.push(...validateTable(table, id));
  }
  for (const [id, area] of Object.entries(map.entities.areas)) {
    errors.push(...validateArea(area, id));
  }

  return errors.length > 0 ? fail(errors) : ok(map);
}
