import type { SeatMap } from "@domain/model/seatmap";
import type {
  SeatMapRepository,
  SeatMapSummary,
} from "@application/ports/seatMap.repo";
import { domainToDto, dtoToDomain } from "@infrastructure/mappers/map.mapper";
import { parseAndMigrate } from "@infrastructure/schemas/migrate";
import { createEmptyMap } from "@domain/services/seatMapFactory";
import { validateMap } from "@domain/services/validateMap";
import { nanoid } from "nanoid";
import { type PrismaClient } from "@prisma-client/client";
import { prisma } from "@infrastructure/db/prismaClient";

/**
 * Tipo del cliente dentro de una transacción interactiva de Prisma.
 * Excluye los métodos no disponibles durante `$transaction`.
 */
type TxClient = Omit<
  PrismaClient,
  "$transaction" | "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

/**
 * Implementación de `SeatMapRepository` con Prisma + SQLite.
 *
 * Diseño:
 *  - Recibe `PrismaClient` por constructor → inyectable y testeable con un
 *    cliente apuntando a :memory: sin tocar el archivo de producción.
 *  - El mapa se serializa como `dtoJson` (TEXT) para roundtrip lossless.
 *  - `setActive` refresca `meta.updatedAt` antes de persistir: la columna
 *    `updatedAt` de Prisma y el campo dentro del JSON quedan siempre sincronizados.
 *  - Sólo puede haber UN documento `isActive = true` simultáneamente (MVP).
 */
export class PrismaMapRepository implements SeatMapRepository {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Deserializa `dtoJson` almacenado → SeatMap de dominio.
   * Lanza si el JSON en DB no supera la validación de schema (no debería
   * ocurrir en condiciones normales; indica corrupción de datos).
   */
  private deserialize(dtoJson: string): SeatMap {
    const raw: unknown = JSON.parse(dtoJson);
    const parsed = parseAndMigrate(raw);
    if (!parsed.ok) {
      const msgs = parsed.errors.map((e) => e.message).join("; ");
      throw new Error(`[PrismaMapRepository] dtoJson inválido en DB: ${msgs}`);
    }
    return dtoToDomain(parsed.value);
  }

  /**
   * Serializa un SeatMap de dominio → `dtoJson`.
   * Recibe el timestamp ya calculado para que JSON y columna queden sincronizados.
   */
  private serialize(map: SeatMap): string {
    const dto = domainToDto(map);
    return JSON.stringify(dto);
  }

  async getActive(): Promise<SeatMap | null> {
    const doc = await this.db.seatMapDocument.findFirst({
      where: { isActive: true },
    });
    if (!doc) return null;
    return this.deserialize(doc.dtoJson);
  }

  async setActive(map: SeatMap): Promise<void> {
    // Refrescar updatedAt para que dtoJson y la columna de DB queden sincronizados.
    const now = new Date().toISOString();
    const freshMap: SeatMap = {
      ...map,
      meta: { ...map.meta, updatedAt: now },
    };
    const dtoJson = this.serialize(freshMap);

    await this.db.$transaction(async (tx: TxClient) => {
      // 1. Desactivar todos los documentos activos previos
      await tx.seatMapDocument.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });

      // 2. Upsert del documento (identidad por map.id)
      await tx.seatMapDocument.upsert({
        where: { id: freshMap.id },
        update: {
          name: freshMap.meta.name,
          schemaVersion: freshMap.schemaVersion,
          dtoJson,
          isActive: true,
        },
        create: {
          id: freshMap.id,
          name: freshMap.meta.name,
          schemaVersion: freshMap.schemaVersion,
          dtoJson,
          isActive: true,
        },
      });
    });
  }

  async resetActive(): Promise<SeatMap> {
    const emptyMap = createEmptyMap();
    // Defensa: validateMap siempre pasa en mapa vacío; falla rápido si hay bug en la fábrica.
    const v = validateMap(emptyMap);
    if (!v.ok) {
      throw new Error(
        "[PrismaMapRepository] createEmptyMap produjo un mapa inválido",
      );
    }
    await this.setActive(emptyMap);
    return emptyMap;
  }

  async list(): Promise<SeatMapSummary[]> {
    const docs = await this.db.seatMapDocument.findMany({
      orderBy: { updatedAt: "desc" },
      // Projection parcial: no cargamos dtoJson en el listado
      select: {
        id: true,
        name: true,
        schemaVersion: true,
        createdAt: true,
        updatedAt: true,
        isActive: true,
      },
    });

    return docs.map((d) => ({
      id: d.id,
      name: d.name,
      schemaVersion: d.schemaVersion,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      isActive: d.isActive,
    }));
  }

  async getById(id: string): Promise<SeatMap | null> {
    const doc = await this.db.seatMapDocument.findUnique({ where: { id } });
    if (!doc) return null;
    return this.deserialize(doc.dtoJson);
  }

  async saveAs(map: SeatMap): Promise<SeatMap> {
    const newMap: SeatMap = {
      ...map,
      id: nanoid(),
      meta: {
        ...map.meta,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };

    const dtoJson = this.serialize(newMap);
    await this.db.seatMapDocument.create({
      data: {
        id: newMap.id,
        name: newMap.meta.name,
        schemaVersion: newMap.schemaVersion,
        dtoJson,
        isActive: false,
      },
    });

    return newMap;
  }
}

/**
 * Singleton del repositorio para usar en Route Handlers / Server Actions.
 *
 * Usa el `prisma` HMR-safe (guarda en globalThis en dev) para evitar múltiples
 * conexiones SQLite durante hot-reload de Next.js.
 * Para tests de integración: `new PrismaMapRepository(testPrismaClient)`.
 */
export const seatMapRepository: SeatMapRepository = new PrismaMapRepository(
  prisma,
);
