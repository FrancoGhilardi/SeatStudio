import type { Point, Row, Table } from "@domain/model";

// Utilidades geométricas

/** Distancia euclidiana entre dos puntos */
export function distance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Vector unitario de `a` hacia `b`.
 * Retorna `{x:0, y:0}` si los puntos son idénticos (la validación de dominio
 * lo rechaza antes, pero se maneja defensivamente aquí).
 */
export function unitVector(a: Point, b: Point): Point {
  const d = distance(a, b);
  if (d === 0) return { x: 0, y: 0 };
  return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
}

/** Punto medio entre `a` y `b` */
export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Posición de asientos en fila

/**
 * Calcula la posición 2D del asiento `index` (0-based) dentro de una fila recta.
 *
 * Los asientos se distribuyen **centrados** respecto al segmento start–end,
 * con separación `seatSpacing` entre cada uno.
 *
 * Fórmula:
 *   center   = midpoint(row.start, row.end)
 *   dir      = unitVector(row.start, row.end)
 *   span     = (seatCount - 1) * seatSpacing
 *   offset_i = -span/2 + index * seatSpacing
 *   pos_i    = center + offset_i * dir
 */
export function getRowSeatPosition(row: Row, index: number): Point {
  const dir = unitVector(row.start, row.end);
  const center = midpoint(row.start, row.end);
  const span = (row.seatCount - 1) * row.seatSpacing;
  const offset = -span / 2 + index * row.seatSpacing;

  return {
    x: center.x + offset * dir.x,
    y: center.y + offset * dir.y,
  };
}

// Posición de asientos en mesa circular

/**
 * Calcula la posición 2D del asiento `index` (0-based) alrededor de una mesa.
 *
 * Los asientos se colocan equidistantemente en un círculo de radio
 * `table.radius + table.seatRadius`, comenzando en la parte superior (−π/2).
 *
 * Fórmula:
 *   angle_i  = -π/2 + (2π * index) / seatCount
 *   r        = table.radius + table.seatRadius
 *   pos_i    = center + r * [cos(angle_i), sin(angle_i)]
 */
export function getTableSeatPosition(table: Table, index: number): Point {
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / table.seatCount;
  const r = table.radius + table.seatRadius;

  return {
    x: table.center.x + r * Math.cos(angle),
    y: table.center.y + r * Math.sin(angle),
  };
}
