import { ZodError, type ZodIssue } from "zod";
import {
  fail,
  failOne,
  ok,
  type Result,
  type DomainError,
} from "@domain/services/errors";
import { SCHEMA_VERSION } from "@domain/model/seatmap";
import {
  type SeatMapDto,
  SeatMapDtoSchema,
  SUPPORTED_SCHEMA_VERSIONS,
} from "./map.schema";

// Helper: convertir ZodError en DomainError[]

function zodErrorsToDomain(error: ZodError): readonly DomainError[] {
  return error.issues.map((issue: ZodIssue) => ({
    code: `SCHEMA_${issue.code.toUpperCase()}`,
    message: issue.message,
    ...(issue.path.length > 0 ? { path: issue.path.join(".") } : {}),
  }));
}

// parseAndMigrate

/**
 * Valida y migra un JSON de entrada desconocido a `SeatMapDto` (v1 actual).
 *
 * Flujo:
 *  1. Verificar que el input sea un objeto (guard básico).
 *  2. Leer `schemaVersion` para seleccionar la ruta de migración.
 *  3. Migrar si es necesario (actualmente no hay versiones anteriores a v1).
 *  4. Validar la forma final con `SeatMapDtoSchema`.
 *
 * @param input - Valor desconocido (p.ej., resultado de `JSON.parse`).
 * @returns `Result<SeatMapDto>` — ok con el DTO validado, o fail con errores.
 */
export function parseAndMigrate(input: unknown): Result<SeatMapDto> {
  // Guard: debe ser un objeto no nulo
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return failOne({
      code: "INVALID_ROOT",
      message: "El JSON raíz debe ser un objeto.",
    });
  }

  // Leer schemaVersion sin validar el resto todavía
  const raw = input as Record<string, unknown>;
  const version = raw["schemaVersion"];

  if (typeof version !== "number") {
    return failOne({
      code: "MISSING_SCHEMA_VERSION",
      message: 'El campo "schemaVersion" es obligatorio y debe ser un número.',
      path: "schemaVersion",
    });
  }

  // Seleccionar ruta de migración
  let normalized: unknown;

  switch (version) {
    case 1:
      // v1 → v1: sin transformación, validar directamente
      normalized = input;
      break;

    default:
      return failOne({
        code: "UNSUPPORTED_SCHEMA_VERSION",
        message: `schemaVersion "${version}" no está soportado. Versiones soportadas: [${SUPPORTED_SCHEMA_VERSIONS.join(", ")}]. Actual: ${SCHEMA_VERSION}.`,
        path: "schemaVersion",
      });
  }

  // Validar con Zod el documento (ya en la versión actual)
  const result = SeatMapDtoSchema.safeParse(normalized);

  if (!result.success) {
    return fail(zodErrorsToDomain(result.error));
  }

  return ok(result.data);
}
