import { formatLabel } from "@domain/services/labeling";
import {
  isValidLabelingTemplate,
  isValidLabelingStartIndex,
  isValidLabelingPad,
} from "@domain/services/labeling";
import type { LabelingRule } from "@domain/model/seatmap";

/**
 * Formatea un label de entidad aplicando `{n}` con relleno.
 *
 * Reutiliza `formatLabel` del dominio manteniendo startIndex = 1 internamente;
 * el offset real se calcula externamente sumando el índice de iteración.
 *
 * Colocado en el layer de features (no en dominio) porque es un detalle de
 * presentación del inspector, no una regla de negocio reutilizable globalmente.
 */
export function formatEntityLabel(
  template: string,
  n: number,
  pad: number,
): string {
  const rule: LabelingRule = { template, startIndex: 1, pad };
  return formatLabel(rule, { n });
}

/**
 * Valida los parámetros de una LabelingRule ingresados manualmente en el inspector.
 * Devuelve un mapa de errores por campo (vacío si todo es válido).
 */
export function validateLabelRuleInputs(
  template: string,
  startIndexStr: string,
  padStr: string,
): Record<string, string> {
  const errs: Record<string, string> = {};

  if (!isValidLabelingTemplate(template))
    errs["template"] = "No puede estar vacío";

  const si = parseInt(startIndexStr, 10);
  if (isNaN(si) || !isValidLabelingStartIndex(si))
    errs["start"] = "Debe ser ≥ 1";

  const p = parseInt(padStr, 10);
  if (isNaN(p) || !isValidLabelingPad(p)) errs["pad"] = "Entre 0 y 8";

  return errs;
}
