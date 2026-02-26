import { dtoToDomain, domainToDto } from "@infrastructure/mappers/map.mapper";
import { parseAndMigrate } from "@infrastructure/schemas/migrate";
import type { SeatMap } from "@domain/model/seatmap";
import type { SeatMapDto } from "@infrastructure/schemas/map.schema";
import { validateMap } from "@domain/services/validateMap";
import { fail, failOne, ok, type Result } from "@domain/services/errors";

// importMap

/**
 * Importa un JSON externo y devuelve un `SeatMap` validado.
 *
 * @param input - Acepta:
 *   - `string`  → se aplica `JSON.parse` antes de validar (caso file/textarea)
 *   - cualquier otro valor → se valida directamente (caso API/test)
 */
export function importMap(input: unknown): Result<SeatMap> {
  // Paso 1: parsear string si hace falta
  let raw: unknown;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input) as unknown;
    } catch {
      return failOne({
        code: "IMPORT_JSON_PARSE_ERROR",
        message: "El texto proporcionado no es JSON válido.",
      });
    }
  } else {
    raw = input;
  }

  // Paso 2: validar schema + migrar versión
  const dtoResult = parseAndMigrate(raw);
  if (!dtoResult.ok) {
    return fail(dtoResult.errors);
  }

  // Paso 3: DTO → dominio
  const map = dtoToDomain(dtoResult.value);

  // Paso 4: validar invariantes de negocio
  const validationResult = validateMap(map);
  if (!validationResult.ok) {
    return fail(validationResult.errors);
  }

  return ok(map);
}

// exportMap

export interface ExportMapSuccess {
  /** DTO listo para ser re-importado o persistido */
  readonly dto: SeatMapDto;
  /** JSON serializado con indentación legible */
  readonly json: string;
}

/**
 * Serializa un `SeatMap` a JSON lossless.
 * Bloquea el export si el mapa tiene invariantes rotas.
 */
export function exportMap(map: SeatMap): Result<ExportMapSuccess> {
  // Paso 1: validar invariantes antes de exportar
  const validationResult = validateMap(map);
  if (!validationResult.ok) {
    return fail(validationResult.errors);
  }

  // Paso 2: dominio → DTO
  const dto = domainToDto(map);

  // Paso 3: serializar
  const json = JSON.stringify(dto, null, 2);

  return ok({ dto, json });
}
