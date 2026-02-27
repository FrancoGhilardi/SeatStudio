import type { LabelingRule, Row, Table } from "@domain/model";

// Tipos de variables de sustitución

export interface LabelVars {
  /** Label de la fila (disponible para {row}) */
  readonly row?: string;
  /** Label de la mesa (disponible para {table}) */
  readonly table?: string;
  /** Número de asiento (antes de aplicar pad) */
  readonly n: number;
}

/**
 * `true` si el template de una LabelingRule es estructuralmente válido.
 * Regla: no puede ser una cadena vacía o de sólo espacios.
 */
export function isValidLabelingTemplate(template: string): boolean {
  return template.trim() !== "";
}

/**
 * `true` si `startIndex` es válido.
 * Regla: debe ser un entero >= 1.
 */
export function isValidLabelingStartIndex(startIndex: number): boolean {
  return Number.isInteger(startIndex) && startIndex >= 1;
}

/**
 * `true` si `pad` es válido.
 * Regla: debe ser un entero en el rango [0, 8].
 */
export function isValidLabelingPad(pad: number): boolean {
  return Number.isInteger(pad) && pad >= 0 && pad <= 8;
}

// Formateo de label a partir de una regla

/**
 * Aplica la `LabelingRule` a las variables dadas y retorna el label resultante.
 *
 * Marcadores soportados en `rule.template`:
 *   `{row}`   → vars.row   (omite el marcador si no se provee)
 *   `{table}` → vars.table (omite el marcador si no se provee)
 *   `{n}`     → número de asiento visible, calculado como `vars.n + startIndex - 1`
 *
 * Convención de `vars.n`:
 *   Los callers deben pasar `n = seatIndex + 1` (1-based).
 *   `startIndex` desplaza el número de inicio: con `startIndex=1` y `n=1` → "1";
 *   con `startIndex=5` y `n=1` → "5". Esto permite que filas distintas
 *   continúen la numeración (ej. fila B arranca en 11).
 */
export function formatLabel(rule: LabelingRule, vars: LabelVars): string {
  const n = vars.n + rule.startIndex - 1;
  const nStr = rule.pad > 0 ? String(n).padStart(rule.pad, "0") : String(n);

  return rule.template
    .replace(/\{row\}/g, vars.row ?? "")
    .replace(/\{table\}/g, vars.table ?? "")
    .replace(/\{n\}/g, nStr);
}

// Labels de asientos derivados

/**
 * Devuelve el label del asiento `index` (0-based) para una fila.
 * Si existe un override para ese índice, lo retorna directamente;
 * en caso contrario aplica la `LabelingRule` de la fila.
 */
export function getRowSeatLabel(row: Row, index: number): string {
  const override = row.seatOverrides[index];
  if (override !== undefined) return override.label;

  return formatLabel(row.labeling, {
    row: row.label,
    n: index + 1,
  });
}

/**
 * Devuelve el label del asiento `index` (0-based) para una mesa.
 * Si existe un override para ese índice, lo retorna directamente;
 * en caso contrario aplica la `LabelingRule` de la mesa.
 */
export function getTableSeatLabel(table: Table, index: number): string {
  const override = table.seatOverrides[index];
  if (override !== undefined) return override.label;

  return formatLabel(table.labeling, {
    table: table.label,
    n: index + 1,
  });
}
