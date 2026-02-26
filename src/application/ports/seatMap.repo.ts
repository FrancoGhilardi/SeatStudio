import type { SeatMap } from "@domain/model/seatmap";

/**
 * Puerto del repositorio de mapas de asientos.
 *
 * La implementación concreta vive en infrastructure/repos/seatMap.repo.impl.ts
 * y accede a SQLite vía Prisma. Los casos de uso y el store sólo dependen
 * de este contrato; nunca importan Prisma directamente.
 *
 * Invariantes del repositorio:
 *  - Sólo puede haber UN documento activo simultáneamente (MVP).
 *  - `setActive` persiste un mapa ya validado (validación = responsabilidad del caller).
 *  - `resetActive` crea y persiste un mapa vacío válido como activo.
 */
export interface SeatMapRepository {
  /**
   * Devuelve el mapa activo actual o `null` si no existe ninguno.
   */
  getActive(): Promise<SeatMap | null>;

  /**
   * Persiste `map` como el documento activo.
   * Reemplaza cualquier activo anterior.
   *
   * @param map - Mapa de dominio ya validado.
   */
  setActive(map: SeatMap): Promise<void>;

  /**
   * Crea un mapa vacío válido, lo persiste como activo y lo devuelve.
   * Usado por "Nuevo mapa" y para el bootstrap inicial cuando no
   * existe ningún documento.
   */
  resetActive(): Promise<SeatMap>;

  /**
   * Devuelve todos los documentos guardados (sin cargar el JSON completo).
   * @returns Lista de mapas con metadatos básicos.
   */
  list(): Promise<SeatMapSummary[]>;

  /**
   * Carga un mapa por id.
   * @returns El mapa o `null` si no existe.
   */
  getById(id: string): Promise<SeatMap | null>;

  /**
   * Guarda `map` con un nuevo id (copia/guardado como).
   */
  saveAs(map: SeatMap): Promise<SeatMap>;
}

/**
 * Vista resumida de un documento guardado.
 * Se usa en listados sin necesidad de deserializar el JSON completo.
 */
export interface SeatMapSummary {
  readonly id: string;
  readonly name: string;
  readonly schemaVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly isActive: boolean;
}
