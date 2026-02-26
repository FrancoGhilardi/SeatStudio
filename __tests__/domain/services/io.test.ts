import { describe, expect, it } from "vitest";
import { importMap, exportMap } from "@application/usecases/io";
import { makeSeatMap, makeRow, makeTable, makeArea } from "./fixtures";

describe("importMap", () => {
  it("importa un JSON válido y devuelve el SeatMap de dominio", () => {
    const map = makeSeatMap({ rows: { "row-1": makeRow() } });
    const exportResult = exportMap(map);
    if (!exportResult.ok)
      throw new Error(
        `exportMap falló inesperadamente: ${JSON.stringify(exportResult.errors)}`,
      );
    const { json } = exportResult.value;

    const result = importMap(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe(map.id);
      expect(result.value.meta.name).toBe(map.meta.name);
    }
  });

  it("rechaza un string que no es JSON", () => {
    const result = importMap("esto no es json{{{");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe("IMPORT_JSON_PARSE_ERROR");
    }
  });

  it("rechaza un JSON sin schemaVersion", () => {
    const result = importMap(JSON.stringify({ foo: "bar" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.code === "MISSING_SCHEMA_VERSION"),
      ).toBe(true);
    }
  });

  it("rechaza un JSON con schemaVersion no soportada", () => {
    const result = importMap(JSON.stringify({ schemaVersion: 99 }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.code === "UNSUPPORTED_SCHEMA_VERSION"),
      ).toBe(true);
    }
  });

  it("rechaza un JSON con invariantes rotas (row.start === row.end)", () => {
    const dto = JSON.parse(
      (exportMap(makeSeatMap()) as { ok: true; value: { json: string } }).value
        .json,
    ) as Record<string, unknown>;
    // Inyectamos la row inválida directamente en el DTO para saltarnos exportMap
    const invalidJson = JSON.stringify({
      ...dto,
      entities: {
        rows: {
          "row-1": {
            id: "row-1",
            start: { x: 0, y: 0 },
            end: { x: 0, y: 0 },
            seatCount: 4,
            seatSpacing: 50,
            seatRadius: 15,
            label: "A",
            labeling: { template: "{row}-{n}", startIndex: 1, pad: 0 },
            seatOverrides: {},
          },
        },
        tables: {},
        areas: {},
      },
    });

    const result = importMap(invalidJson);
    expect(result.ok).toBe(false);
  });
});

describe("exportMap", () => {
  it("exporta un mapa válido a JSON y lo re-importa sin pérdida (roundtrip)", () => {
    const original = makeSeatMap({
      rows: { "row-1": makeRow({ seatOverrides: { 0: { label: "A1-bis" } } }) },
      tables: { "table-1": makeTable() },
      areas: { "area-1": makeArea() },
    });

    const exportResult = exportMap(original);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    const { json } = exportResult.value;

    const importResult = importMap(json);
    expect(importResult.ok).toBe(true);
    if (!importResult.ok) return;

    const restored = importResult.value;

    // Estructura completa
    expect(restored.id).toBe(original.id);
    expect(restored.schemaVersion).toBe(original.schemaVersion);
    expect(restored.meta).toEqual(original.meta);
    expect(restored.canvas).toEqual(original.canvas);

    // Fila con override
    const row = restored.entities.rows["row-1"];
    expect(row).toBeDefined();
    expect(row?.label).toBe("A");
    expect(row?.seatOverrides[0]?.label).toBe("A1-bis");

    // Mesa
    const table = restored.entities.tables["table-1"];
    expect(table).toBeDefined();
    expect(table?.label).toBe("T1");

    // Área
    const area = restored.entities.areas["area-1"];
    expect(area).toBeDefined();
    expect(area?.capacity).toBe(50);
  });

  it("bloquea el export si hay invariantes rotas (label vacío)", () => {
    const map = makeSeatMap({
      rows: { "row-1": makeRow({ label: "" }) },
    });
    const result = exportMap(map);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path?.includes("rows"))).toBe(true);
    }
  });

  it("el JSON exportado es parseable por JSON.parse sin pérdida de tipos", () => {
    const map = makeSeatMap({
      rows: { "row-1": makeRow() },
    });
    const result = exportMap(map);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const parsed = JSON.parse(result.value.json) as Record<string, unknown>;
    expect(parsed["schemaVersion"]).toBe(1);
    expect(typeof parsed["id"]).toBe("string");
  });
});
