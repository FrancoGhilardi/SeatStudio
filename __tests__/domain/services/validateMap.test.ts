import { describe, expect, it } from "vitest";
import type { Row, Table } from "@domain/model";
import { validateMap } from "@domain/services/validateMap";
import { makeArea, makeRow, makeSeatMap, makeTable } from "./fixtures";

describe("validateMap – mapa vacío", () => {
  it("retorna ok para un mapa vacío bien formado", () => {
    const map = makeSeatMap();
    const result = validateMap(map);
    expect(result.ok).toBe(true);
  });

  it("falla si meta.name está vacío", () => {
    const map = makeSeatMap({}, "");
    const result = validateMap(map);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === "MAP_NAME_EMPTY")).toBe(true);
    }
  });
});

describe("validateMap – Row", () => {
  it("acepta una fila válida", () => {
    const map = makeSeatMap({ rows: { "row-1": makeRow() } });
    expect(validateMap(map).ok).toBe(true);
  });

  it("falla si la fila tiene label vacío", () => {
    const row = makeRow({ label: "  " });
    const map = makeSeatMap({ rows: { "row-1": row } });
    const result = validateMap(map);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === "ROW_LABEL_EMPTY")).toBe(
        true,
      );
    }
  });

  it("falla si start === end", () => {
    const row = makeRow({ start: { x: 50, y: 50 }, end: { x: 50, y: 50 } });
    const map = makeSeatMap({ rows: { "row-1": row } });
    const result = validateMap(map);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === "ROW_START_EQUALS_END")).toBe(
        true,
      );
    }
  });

  it("falla si seatCount < 1", () => {
    const row = makeRow({ seatCount: 0 });
    const map = makeSeatMap({ rows: { "row-1": row } });
    const result = validateMap(map);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.code === "ROW_SEAT_COUNT_INVALID"),
      ).toBe(true);
    }
  });

  it("falla si seatSpacing <= 0", () => {
    const row = makeRow({ seatSpacing: 0 });
    const map = makeSeatMap({ rows: { "row-1": row } });
    const result = validateMap(map);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.code === "ROW_SEAT_SPACING_INVALID"),
      ).toBe(true);
    }
  });

  it("falla si seatRadius <= 0", () => {
    const row = makeRow({ seatRadius: -1 });
    const map = makeSeatMap({ rows: { "row-1": row } });
    const result = validateMap(map);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.code === "ROW_SEAT_RADIUS_INVALID"),
      ).toBe(true);
    }
  });

  it("falla si el template de etiquetado está vacío", () => {
    const row = makeRow({ labeling: { template: "", startIndex: 1, pad: 0 } });
    const map = makeSeatMap({ rows: { "row-1": row } });
    const result = validateMap(map);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.code === "ROW_LABELING_TEMPLATE_EMPTY"),
      ).toBe(true);
    }
  });

  it("falla si startIndex < 1", () => {
    const row = makeRow({
      labeling: { template: "{row}-{n}", startIndex: 0, pad: 0 },
    });
    const map = makeSeatMap({ rows: { "row-1": row } });
    const result = validateMap(map);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some(
          (e) => e.code === "ROW_LABELING_START_INDEX_INVALID",
        ),
      ).toBe(true);
    }
  });

  it("falla si pad está fuera del rango [0, 8]", () => {
    const row = makeRow({
      labeling: { template: "{row}-{n}", startIndex: 1, pad: 9 },
    });
    const map = makeSeatMap({ rows: { "row-1": row } });
    const result = validateMap(map);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.code === "ROW_LABELING_PAD_INVALID"),
      ).toBe(true);
    }
  });

  it("falla si un índice de override está fuera de rango", () => {
    const row = makeRow({
      seatCount: 3,
      seatOverrides: { 5: { label: "X" } },
    } as unknown as Partial<Row>);
    const map = makeSeatMap({ rows: { "row-1": row } });
    const result = validateMap(map);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.code === "ROW_OVERRIDE_OUT_OF_RANGE"),
      ).toBe(true);
    }
  });

  it("falla si el label de un override está vacío", () => {
    const row = makeRow({ seatOverrides: { 0: { label: "" } } });
    const map = makeSeatMap({ rows: { "row-1": row } });
    const result = validateMap(map);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.code === "ROW_OVERRIDE_LABEL_EMPTY"),
      ).toBe(true);
    }
  });

  it("acumula múltiples errores en una misma fila", () => {
    const row = makeRow({ label: "", seatCount: 0, seatSpacing: -1 });
    const map = makeSeatMap({ rows: { "row-1": row } });
    const result = validateMap(map);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("validateMap – Table", () => {
  it("acepta una mesa válida", () => {
    const map = makeSeatMap({ tables: { "table-1": makeTable() } });
    expect(validateMap(map).ok).toBe(true);
  });

  it("falla si la mesa tiene label vacío", () => {
    const table = makeTable({ label: "" });
    const map = makeSeatMap({ tables: { "table-1": table } });
    const result = validateMap(map);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === "TABLE_LABEL_EMPTY")).toBe(
        true,
      );
    }
  });

  it("falla si radius <= 0", () => {
    const table = makeTable({ radius: 0 });
    const map = makeSeatMap({ tables: { "table-1": table } });
    const result = validateMap(map);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === "TABLE_RADIUS_INVALID")).toBe(
        true,
      );
    }
  });

  it("falla si startIndex < 1 en mesa", () => {
    const table = makeTable({
      labeling: { template: "{table}-{n}", startIndex: 0, pad: 0 },
    });
    const map = makeSeatMap({ tables: { "table-1": table } });
    const result = validateMap(map);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some(
          (e) => e.code === "TABLE_LABELING_START_INDEX_INVALID",
        ),
      ).toBe(true);
    }
  });

  it("falla si seatCount < 1", () => {
    const table = makeTable({ seatCount: 0 });
    const map = makeSeatMap({ tables: { "table-1": table } });
    const result = validateMap(map);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.code === "TABLE_SEAT_COUNT_INVALID"),
      ).toBe(true);
    }
  });

  it("falla si un override de asiento tiene label vacío", () => {
    const table = makeTable({ seatOverrides: { 0: { label: "" } } });
    const map = makeSeatMap({ tables: { "table-1": table } });
    const result = validateMap(map);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.code === "TABLE_OVERRIDE_LABEL_EMPTY"),
      ).toBe(true);
    }
  });

  it("falla si un índice de override está fuera de rango", () => {
    const table = makeTable({
      seatCount: 3,
      seatOverrides: { 10: { label: "x" } },
    } as unknown as Partial<Table>);
    const map = makeSeatMap({ tables: { "table-1": table } });
    const result = validateMap(map);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.code === "TABLE_OVERRIDE_OUT_OF_RANGE"),
      ).toBe(true);
    }
  });
});

describe("validateMap – Area", () => {
  it("acepta un área válida", () => {
    const map = makeSeatMap({ areas: { "area-1": makeArea() } });
    expect(validateMap(map).ok).toBe(true);
  });

  it("falla si el área tiene label vacío", () => {
    const area = makeArea({ label: "" });
    const map = makeSeatMap({ areas: { "area-1": area } });
    const result = validateMap(map);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === "AREA_LABEL_EMPTY")).toBe(
        true,
      );
    }
  });

  it("falla si capacity < 0", () => {
    const area = makeArea({ capacity: -5 });
    const map = makeSeatMap({ areas: { "area-1": area } });
    const result = validateMap(map);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.code === "AREA_CAPACITY_INVALID"),
      ).toBe(true);
    }
  });
});

describe("validateMap – múltiples entidades", () => {
  it("retorna ok con varias entidades válidas simultáneas", () => {
    const map = makeSeatMap({
      rows: {
        r1: makeRow({ id: "r1" }),
        r2: makeRow({
          id: "r2",
          label: "B",
          start: { x: 0, y: 100 },
          end: { x: 200, y: 100 },
        }),
      },
      tables: { t1: makeTable({ id: "t1" }) },
      areas: { a1: makeArea({ id: "a1" }) },
    });
    expect(validateMap(map).ok).toBe(true);
  });

  it("acumula errores de entidades distintas", () => {
    const map = makeSeatMap({
      rows: { r1: makeRow({ label: "" }) },
      tables: { t1: makeTable({ label: "" }) },
      areas: { a1: makeArea({ label: "" }) },
    });
    const result = validateMap(map);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const codes = result.errors.map((e) => e.code);
      expect(codes).toContain("ROW_LABEL_EMPTY");
      expect(codes).toContain("TABLE_LABEL_EMPTY");
      expect(codes).toContain("AREA_LABEL_EMPTY");
    }
  });
});
