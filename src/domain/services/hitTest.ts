import type { Area, Row, Table } from "@domain/model";
import { getRowSeatPosition } from "./geometry";

export interface AABB {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** `true` si los dos AABB se superponen (al menos un punto en común). */
export function aabbIntersects(a: AABB, b: AABB): boolean {
  return (
    a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
  );
}

/**
 * AABB de una fila recta.
 *
 * Calcula las posiciones extremas de los asientos (índice 0 y último) y las
 * expande por `seatRadius`, que es el radio de cada círculo de asiento.
 * Esto produce un AABB ajustado sin recorrer todos los asientos.
 */
export function rowBBox(row: Row): AABB {
  const first = getRowSeatPosition(row, 0);
  const last = getRowSeatPosition(row, row.seatCount - 1);
  const r = row.seatRadius;

  return {
    minX: Math.min(first.x, last.x) - r,
    minY: Math.min(first.y, last.y) - r,
    maxX: Math.max(first.x, last.x) + r,
    maxY: Math.max(first.y, last.y) + r,
  };
}

/**
 * AABB de una mesa circular.
 *
 * El radio efectivo incluye el radio de la mesa más el de los asientos
 * perimetrales.
 */
export function tableBBox(table: Table): AABB {
  const r = table.radius + table.seatRadius;
  return {
    minX: table.center.x - r,
    minY: table.center.y - r,
    maxX: table.center.x + r,
    maxY: table.center.y + r,
  };
}

/**
 * AABB de un área poligonal.
 *
 * Simplemente el rectángulo envolvente de todos los vértices.
 */
export function areaBBox(area: Area): AABB {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of area.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  return { minX, minY, maxX, maxY };
}
