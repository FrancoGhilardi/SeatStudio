import { nanoid } from "nanoid";
import type { SeatMap } from "@domain/model/seatmap";
import { SCHEMA_VERSION } from "@domain/model/seatmap";

/**
 * Crea un `SeatMap` vacío y válido.
 *
 * Se usa en:
 *  - Bootstrap inicial (ningún documento en DB).
 *  - Comando RESET_MAP ("Nuevo mapa").
 *  - `SeatMapRepository.resetActive()`.
 *
 * El mapa cumple todos los invariantes de dominio:
 *  - Sin entidades → `validateMap` pasa sin errores.
 *  - Metadatos con timestamps ISO válidos.
 *  - Canvas con dimensiones y grid por defecto.
 */
export function createEmptyMap(name = "Nuevo mapa"): SeatMap {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: nanoid(),
    meta: {
      name,
      createdAt: now,
      updatedAt: now,
    },
    canvas: {
      width: 1200,
      height: 800,
      grid: {
        enabled: true,
        size: 40,
        snap: false,
      },
    },
    entities: {
      rows: {},
      tables: {},
      areas: {},
    },
  };
}
