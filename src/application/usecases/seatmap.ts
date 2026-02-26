import type { SeatMap } from "@domain/model/seatmap";
import type { SeatMapRepository } from "@application/ports/seatMap.repo";
import { importMap } from "@application/usecases/io";
import type { Result } from "@domain/services/errors";
import { ok } from "@domain/services/errors";

// Lectura

/**
 * Devuelve el mapa activo desde el repositorio o `null` si no existe ninguno.
 *
 * No re-valida el mapa al leer: los datos en DB ya fueron validados en el momento
 * de escritura. Re-validar añadiría overhead sin valor.
 */
export async function getActiveSeatMap(
  repo: SeatMapRepository,
): Promise<SeatMap | null> {
  return repo.getActive();
}

// Escritura desde input externo

/**
 * Parsea, valida e importa un JSON externo como mapa activo.
 *
 * Pipeline completo:
 *   parse JSON → validar Zod schema → migrar versión → DTO→ dominio
 *   → validar invariantes → persistir como activo.
 *
 * Devuelve el mapa persistido para que el caller pueda actualizar el store.
 */
export async function saveActiveSeatMap(
  repo: SeatMapRepository,
  input: unknown,
): Promise<Result<SeatMap>> {
  const result = importMap(input);
  if (!result.ok) return result;

  await repo.setActive(result.value);
  return ok(result.value);
}

// Reset / nuevo mapa

/**
 * Crea un mapa vacío válido, lo persiste como activo y lo devuelve.
 *
 * Usado por "Nuevo mapa" y por el bootstrap inicial si la DB está vacía.
 */
export async function resetActiveSeatMap(
  repo: SeatMapRepository,
): Promise<SeatMap> {
  return repo.resetActive();
}
