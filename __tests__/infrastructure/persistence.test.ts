import { describe, expect, it } from "vitest";
import { domainToDto, dtoToDomain } from "@infrastructure/mappers/map.mapper";
import { parseAndMigrate } from "@infrastructure/schemas/migrate";
import {
  makeRow,
  makeSeatMap,
  makeTable,
  makeArea,
} from "../domain/services/fixtures";

/**
 * Suite de persistencia — roundtrip lossless.
 *
 * Simula el ciclo completo que ocurre cuando el mapa se guarda en SQLite
 * (domain → dto → JSON.stringify) y luego se lee (JSON.parse → dto → domain):
 *
 *   domainToDto → JSON.stringify → JSON.parse → parseAndMigrate → dtoToDomain
 *
 * Propósito: verificar que la capa de persistencia no pierde ni corrompe datos.
 * No requiere una base de datos real ni Prisma en tiempo de test.
 */
describe("Persistencia — roundtrip lossless mapper", () => {
  it("mapa vacío (solo meta): serialize → deserialize sin pérdida", () => {
    const original = makeSeatMap();

    const dto = domainToDto(original);
    const json = JSON.stringify(dto);
    const parsed: unknown = JSON.parse(json);

    const dtoResult = parseAndMigrate(parsed);
    expect(dtoResult.ok).toBe(true);
    if (!dtoResult.ok) return;

    const restored = dtoToDomain(dtoResult.value);

    expect(restored.id).toBe(original.id);
    expect(restored.schemaVersion).toBe(original.schemaVersion);
    expect(restored.meta.name).toBe(original.meta.name);
    expect(restored.canvas.width).toBe(original.canvas.width);
    expect(restored.canvas.height).toBe(original.canvas.height);
    expect(Object.keys(restored.entities.rows)).toHaveLength(0);
    expect(Object.keys(restored.entities.tables)).toHaveLength(0);
    expect(Object.keys(restored.entities.areas)).toHaveLength(0);
  });

  it("fila con seatOverrides: los índices numéricos sobreviven la conversión string↔number", () => {
    const row = makeRow({
      seatOverrides: {
        0: { label: "A1-override" },
        3: { label: "A4-override" },
      },
    });
    const original = makeSeatMap({ rows: { "row-1": row } });

    const dto = domainToDto(original);
    // Los overrides se serializan con claves string en JSON
    const json = JSON.stringify(dto);
    const parsed: unknown = JSON.parse(json);

    const dtoResult = parseAndMigrate(parsed);
    expect(dtoResult.ok).toBe(true);
    if (!dtoResult.ok) return;

    const restored = dtoToDomain(dtoResult.value);
    const restoredRow = restored.entities.rows["row-1"];

    expect(restoredRow).toBeDefined();
    // Claves numéricas restauradas correctamente
    expect(restoredRow?.seatOverrides[0]?.label).toBe("A1-override");
    expect(restoredRow?.seatOverrides[3]?.label).toBe("A4-override");
    // Clave no existente → undefined (no contamina con defaults)
    expect(restoredRow?.seatOverrides[1]).toBeUndefined();
  });

  it("labeling rule completa (template, startIndex, pad) preservada", () => {
    const row = makeRow({
      labeling: { template: "Platea {row}-{n}", startIndex: 5, pad: 2 },
    });
    const original = makeSeatMap({ rows: { "row-1": row } });

    const dto = domainToDto(original);
    const dtoResult = parseAndMigrate(
      JSON.parse(JSON.stringify(dto)) as unknown,
    );
    expect(dtoResult.ok).toBe(true);
    if (!dtoResult.ok) return;

    const restored = dtoToDomain(dtoResult.value);
    const restoredRow = restored.entities.rows["row-1"];

    expect(restoredRow?.labeling.template).toBe("Platea {row}-{n}");
    expect(restoredRow?.labeling.startIndex).toBe(5);
    expect(restoredRow?.labeling.pad).toBe(2);
  });

  it("mapa completo (rows + tables + areas): roundtrip preserva todas las entidades", () => {
    const original = makeSeatMap({
      rows: {
        "row-1": makeRow({ label: "Fila A", seatCount: 10 }),
        "row-2": makeRow({
          label: "Fila B",
          seatOverrides: { 5: { label: "VIP" } },
        }),
      },
      tables: {
        "table-1": makeTable({ label: "Mesa 1", seatCount: 6 }),
      },
      areas: {
        "area-1": makeArea({ label: "Platea", capacity: 200 }),
      },
    });

    const dto = domainToDto(original);
    const json = JSON.stringify(dto);
    const dtoResult = parseAndMigrate(JSON.parse(json) as unknown);
    expect(dtoResult.ok).toBe(true);
    if (!dtoResult.ok) return;

    const restored = dtoToDomain(dtoResult.value);

    // Conteo de entidades
    expect(Object.keys(restored.entities.rows)).toHaveLength(2);
    expect(Object.keys(restored.entities.tables)).toHaveLength(1);
    expect(Object.keys(restored.entities.areas)).toHaveLength(1);

    // Fila A
    expect(restored.entities.rows["row-1"]?.label).toBe("Fila A");
    expect(restored.entities.rows["row-1"]?.seatCount).toBe(10);

    // Fila B con override
    expect(restored.entities.rows["row-2"]?.seatOverrides[5]?.label).toBe(
      "VIP",
    );

    // Mesa
    expect(restored.entities.tables["table-1"]?.label).toBe("Mesa 1");
    expect(restored.entities.tables["table-1"]?.seatCount).toBe(6);

    // Área
    expect(restored.entities.areas["area-1"]?.label).toBe("Platea");
    expect(restored.entities.areas["area-1"]?.capacity).toBe(200);
  });

  it("mesa con seatOverrides: los índices sobreviven el roundtrip", () => {
    const table = makeTable({
      seatOverrides: { 0: { label: "VIP-1" }, 2: { label: "VIP-3" } },
    });
    const original = makeSeatMap({ tables: { "table-1": table } });

    const dto = domainToDto(original);
    const dtoResult = parseAndMigrate(
      JSON.parse(JSON.stringify(dto)) as unknown,
    );
    expect(dtoResult.ok).toBe(true);
    if (!dtoResult.ok) return;

    const restored = dtoToDomain(dtoResult.value);
    const restoredTable = restored.entities.tables["table-1"];

    expect(restoredTable?.seatOverrides[0]?.label).toBe("VIP-1");
    expect(restoredTable?.seatOverrides[2]?.label).toBe("VIP-3");
    expect(restoredTable?.seatOverrides[1]).toBeUndefined();
  });

  it("meta (name) y canvas sobreviven el roundtrip", () => {
    const original = makeSeatMap({}, "Sala Principal");

    const dto = domainToDto(original);
    const json = JSON.stringify(dto);
    const dtoResult = parseAndMigrate(JSON.parse(json) as unknown);
    expect(dtoResult.ok).toBe(true);
    if (!dtoResult.ok) return;

    const restored = dtoToDomain(dtoResult.value);

    expect(restored.meta.name).toBe("Sala Principal");
    // Las fechas ISO sobreviven sin distorsión
    expect(restored.meta.createdAt).toBe(original.meta.createdAt);
    expect(restored.meta.updatedAt).toBe(original.meta.updatedAt);
    // Canvas preservado
    expect(restored.canvas.width).toBe(original.canvas.width);
    expect(restored.canvas.height).toBe(original.canvas.height);
    expect(restored.canvas.grid.size).toBe(original.canvas.grid.size);
  });
});
