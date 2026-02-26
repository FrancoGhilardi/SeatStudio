import { describe, expect, it } from "vitest";
import { applyPatches } from "immer";
import { executeCommand } from "@application/commands/execute";
import { getRowSeatLabel, getTableSeatLabel } from "@domain/services/labeling";
import {
  makeArea,
  makeRow,
  makeSeatMap,
  makeTable,
} from "../../../__tests__/domain/services/fixtures";

/** Ejecuta un comando y falla el test si devuelve error. */
function exec(cmd: Parameters<typeof executeCommand>[0], map = makeSeatMap()) {
  const result = executeCommand(cmd, map);
  if (!result.ok) {
    throw new Error(
      `executeCommand falló inesperadamente: ${JSON.stringify(result.errors)}`,
    );
  }
  return result.value;
}

/** Ejecuta un comando y falla el test si devuelve éxito. */
function execFail(
  cmd: Parameters<typeof executeCommand>[0],
  map = makeSeatMap(),
) {
  const result = executeCommand(cmd, map);
  if (result.ok) {
    throw new Error("executeCommand debería haber fallado pero tuvo éxito.");
  }
  return result.errors;
}

describe("RESET_MAP", () => {
  it("devuelve un mapa vacío con entidades limpias", () => {
    const mapWithData = makeSeatMap({ rows: { "row-1": makeRow() } });
    const { map } = exec({ type: "RESET_MAP" }, mapWithData);

    expect(Object.keys(map.entities.rows)).toHaveLength(0);
    expect(Object.keys(map.entities.tables)).toHaveLength(0);
    expect(Object.keys(map.entities.areas)).toHaveLength(0);
  });

  it("genera patches e inversePatches", () => {
    const { patches, inversePatches } = exec({ type: "RESET_MAP" });

    expect(patches.length).toBeGreaterThan(0);
    expect(inversePatches.length).toBeGreaterThan(0);
  });
});

describe("CREATE_ROW", () => {
  const validPayload = {
    id: "row-new",
    start: { x: 0, y: 0 },
    end: { x: 300, y: 0 },
    seatCount: 5,
    seatSpacing: 50,
    seatRadius: 15,
    label: "A",
    labeling: { template: "{row}-{n}", startIndex: 1, pad: 0 },
  } as const;

  it("crea la fila y la agrega al mapa", () => {
    const { map } = exec({ type: "CREATE_ROW", payload: validPayload });

    expect(map.entities.rows["row-new"]).toBeDefined();
    expect(map.entities.rows["row-new"]?.label).toBe("A");
    expect(map.entities.rows["row-new"]?.seatCount).toBe(5);
  });

  it("inicializa seatOverrides vacío", () => {
    const { map } = exec({ type: "CREATE_ROW", payload: validPayload });
    expect(map.entities.rows["row-new"]?.seatOverrides).toEqual({});
  });

  it("actualiza meta.updatedAt", () => {
    const before = makeSeatMap();
    const { map } = exec({ type: "CREATE_ROW", payload: validPayload }, before);
    expect(map.meta.updatedAt).not.toBe(before.meta.updatedAt);
  });

  it("genera patches e inversePatches (soporte undo/redo)", () => {
    const { patches, inversePatches, map } = exec({
      type: "CREATE_ROW",
      payload: validPayload,
    });

    expect(patches.length).toBeGreaterThan(0);
    expect(inversePatches.length).toBeGreaterThan(0);

    // Aplicar inversePatches sobre el nuevo mapa debe restaurar el estado anterior
    const base = makeSeatMap();
    const restored = applyPatches(map, inversePatches);
    expect(restored.entities.rows["row-new"]).toBeUndefined();
    // El mapa original no tenía la fila
    expect(base.entities.rows["row-new"]).toBeUndefined();
  });

  it("falla con label vacío", () => {
    const errors = execFail({
      type: "CREATE_ROW",
      payload: { ...validPayload, label: "  " },
    });
    expect(errors[0]?.code).toBe("CMD_ROW_LABEL_EMPTY");
  });

  it("falla cuando start === end", () => {
    const errors = execFail({
      type: "CREATE_ROW",
      payload: {
        ...validPayload,
        start: { x: 10, y: 10 },
        end: { x: 10, y: 10 },
      },
    });
    expect(errors[0]?.code).toBe("CMD_ROW_START_EQUALS_END");
  });

  it("falla con seatCount < 1", () => {
    const errors = execFail({
      type: "CREATE_ROW",
      payload: { ...validPayload, seatCount: 0 },
    });
    expect(errors[0]?.code).toBe("CMD_ROW_SEAT_COUNT_INVALID");
  });

  it("falla con seatSpacing <= 0", () => {
    const errors = execFail({
      type: "CREATE_ROW",
      payload: { ...validPayload, seatSpacing: 0 },
    });
    expect(errors[0]?.code).toBe("CMD_ROW_SEAT_SPACING_INVALID");
  });

  it("falla con seatRadius <= 0", () => {
    const errors = execFail({
      type: "CREATE_ROW",
      payload: { ...validPayload, seatRadius: -1 },
    });
    expect(errors[0]?.code).toBe("CMD_ROW_SEAT_RADIUS_INVALID");
  });

  it("falla con template de etiquetado vacío", () => {
    const errors = execFail({
      type: "CREATE_ROW",
      payload: {
        ...validPayload,
        labeling: { template: "", startIndex: 1, pad: 0 },
      },
    });
    expect(errors[0]?.code).toBe("CMD_LABELING_TEMPLATE_EMPTY");
  });

  it("falla si ya existe una fila con ese id", () => {
    const mapWithRow = makeSeatMap({
      rows: { "row-new": makeRow({ id: "row-new" }) },
    });
    const errors = execFail(
      { type: "CREATE_ROW", payload: validPayload },
      mapWithRow,
    );
    expect(errors[0]?.code).toBe("CMD_ROW_DUPLICATE_ID");
  });
});

describe("UPDATE_ROW_GEOMETRY", () => {
  const mapWithRow = makeSeatMap({ rows: { "row-1": makeRow() } });

  it("actualiza start y end de la fila", () => {
    const { map } = exec(
      {
        type: "UPDATE_ROW_GEOMETRY",
        payload: {
          id: "row-1",
          start: { x: 10, y: 20 },
          end: { x: 200, y: 20 },
        },
      },
      mapWithRow,
    );

    expect(map.entities.rows["row-1"]?.start).toEqual({ x: 10, y: 20 });
    expect(map.entities.rows["row-1"]?.end).toEqual({ x: 200, y: 20 });
  });

  it("falla si la fila no existe", () => {
    const errors = execFail({
      type: "UPDATE_ROW_GEOMETRY",
      payload: {
        id: "no-existe",
        start: { x: 0, y: 0 },
        end: { x: 100, y: 0 },
      },
    });
    expect(errors[0]?.code).toBe("CMD_ROW_NOT_FOUND");
  });

  it("falla si start === end", () => {
    const errors = execFail(
      {
        type: "UPDATE_ROW_GEOMETRY",
        payload: { id: "row-1", start: { x: 5, y: 5 }, end: { x: 5, y: 5 } },
      },
      mapWithRow,
    );
    expect(errors[0]?.code).toBe("CMD_ROW_START_EQUALS_END");
  });
});

describe("UPDATE_ROW_CONFIG", () => {
  const mapWithRow = makeSeatMap({
    rows: { "row-1": makeRow({ seatCount: 5 }) },
  });

  it("actualiza seatCount", () => {
    const { map } = exec(
      { type: "UPDATE_ROW_CONFIG", payload: { id: "row-1", seatCount: 8 } },
      mapWithRow,
    );
    expect(map.entities.rows["row-1"]?.seatCount).toBe(8);
  });

  it("poda overrides fuera del nuevo rango cuando seatCount decrece", () => {
    const mapWithOverrides = makeSeatMap({
      rows: {
        "row-1": makeRow({
          seatCount: 5,
          seatOverrides: {
            0: { label: "A1" },
            3: { label: "A4" },
            4: { label: "A5" },
          },
        }),
      },
    });

    const { map } = exec(
      { type: "UPDATE_ROW_CONFIG", payload: { id: "row-1", seatCount: 3 } },
      mapWithOverrides,
    );

    const overrides = map.entities.rows["row-1"]?.seatOverrides ?? {};
    expect(overrides[0]).toEqual({ label: "A1" });
    expect(overrides[3]).toBeUndefined();
    expect(overrides[4]).toBeUndefined();
  });

  it("falla con seatCount < 1", () => {
    const errors = execFail(
      { type: "UPDATE_ROW_CONFIG", payload: { id: "row-1", seatCount: 0 } },
      mapWithRow,
    );
    expect(errors[0]?.code).toBe("CMD_ROW_SEAT_COUNT_INVALID");
  });
});

describe("CREATE_TABLE", () => {
  const validPayload = {
    id: "table-new",
    center: { x: 200, y: 200 },
    radius: 60,
    seatCount: 6,
    seatRadius: 12,
    label: "T1",
    labeling: { template: "{table}-{n}", startIndex: 1, pad: 0 },
  } as const;

  it("crea la mesa y la agrega al mapa", () => {
    const { map } = exec({ type: "CREATE_TABLE", payload: validPayload });

    expect(map.entities.tables["table-new"]).toBeDefined();
    expect(map.entities.tables["table-new"]?.label).toBe("T1");
    expect(map.entities.tables["table-new"]?.seatCount).toBe(6);
    expect(map.entities.tables["table-new"]?.seatOverrides).toEqual({});
  });

  it("falla con label vacío", () => {
    const errors = execFail({
      type: "CREATE_TABLE",
      payload: { ...validPayload, label: "" },
    });
    expect(errors[0]?.code).toBe("CMD_TABLE_LABEL_EMPTY");
  });

  it("falla con radius <= 0", () => {
    const errors = execFail({
      type: "CREATE_TABLE",
      payload: { ...validPayload, radius: 0 },
    });
    expect(errors[0]?.code).toBe("CMD_TABLE_RADIUS_INVALID");
  });

  it("falla con seatCount < 1", () => {
    const errors = execFail({
      type: "CREATE_TABLE",
      payload: { ...validPayload, seatCount: 0 },
    });
    expect(errors[0]?.code).toBe("CMD_TABLE_SEAT_COUNT_INVALID");
  });

  it("falla con template de etiquetado vacío", () => {
    const errors = execFail({
      type: "CREATE_TABLE",
      payload: { ...validPayload, labeling: { template: "", startIndex: 1, pad: 0 } },
    });
    expect(errors[0]?.code).toBe("CMD_LABELING_TEMPLATE_EMPTY");
  });

  it("falla con startIndex < 1 en labeling", () => {
    const errors = execFail({
      type: "CREATE_TABLE",
      payload: { ...validPayload, labeling: { template: "{n}", startIndex: 0, pad: 0 } },
    });
    expect(errors[0]?.code).toBe("CMD_LABELING_START_INDEX_INVALID");
  });
});

describe("UPDATE_TABLE_GEOMETRY", () => {
  const mapWithTable = makeSeatMap({ tables: { "table-1": makeTable() } });

  it("actualiza center y radius", () => {
    const { map } = exec(
      {
        type: "UPDATE_TABLE_GEOMETRY",
        payload: { id: "table-1", center: { x: 300, y: 300 }, radius: 80 },
      },
      mapWithTable,
    );

    expect(map.entities.tables["table-1"]?.center).toEqual({ x: 300, y: 300 });
    expect(map.entities.tables["table-1"]?.radius).toBe(80);
  });

  it("falla si la mesa no existe", () => {
    const errors = execFail({
      type: "UPDATE_TABLE_GEOMETRY",
      payload: { id: "no-existe", center: { x: 0, y: 0 }, radius: 50 },
    });
    expect(errors[0]?.code).toBe("CMD_TABLE_NOT_FOUND");
  });

  it("falla con radius <= 0", () => {
    const errors = execFail(
      {
        type: "UPDATE_TABLE_GEOMETRY",
        payload: { id: "table-1", center: { x: 0, y: 0 }, radius: -5 },
      },
      mapWithTable,
    );
    expect(errors[0]?.code).toBe("CMD_TABLE_RADIUS_INVALID");
  });
});

describe("UPDATE_TABLE_CONFIG", () => {
  const mapWithTable = makeSeatMap({
    tables: { "table-1": makeTable({ seatCount: 6 }) },
  });

  it("poda overrides fuera del nuevo rango cuando seatCount decrece", () => {
    const mapWithOverrides = makeSeatMap({
      tables: {
        "table-1": makeTable({
          seatCount: 6,
          seatOverrides: { 2: { label: "T-3" }, 5: { label: "T-6" } },
        }),
      },
    });

    const { map } = exec(
      { type: "UPDATE_TABLE_CONFIG", payload: { id: "table-1", seatCount: 4 } },
      mapWithOverrides,
    );

    const overrides = map.entities.tables["table-1"]?.seatOverrides ?? {};
    expect(overrides[2]).toEqual({ label: "T-3" });
    expect(overrides[5]).toBeUndefined();
  });

  it("falla con seatRadius <= 0", () => {
    const errors = execFail(
      {
        type: "UPDATE_TABLE_CONFIG",
        payload: { id: "table-1", seatRadius: 0 },
      },
      mapWithTable,
    );
    expect(errors[0]?.code).toBe("CMD_TABLE_SEAT_RADIUS_INVALID");
  });
});

describe("CREATE_AREA", () => {
  const validPayload = {
    id: "area-new",
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 100 },
    ] as const,
    label: "Platea",
    capacity: 100,
  };

  it("crea el área y la agrega al mapa", () => {
    const { map } = exec({ type: "CREATE_AREA", payload: validPayload });

    expect(map.entities.areas["area-new"]).toBeDefined();
    expect(map.entities.areas["area-new"]?.label).toBe("Platea");
    expect(map.entities.areas["area-new"]?.capacity).toBe(100);
  });

  it("falla con label vacío", () => {
    const errors = execFail({
      type: "CREATE_AREA",
      payload: { ...validPayload, label: "" },
    });
    expect(errors[0]?.code).toBe("CMD_AREA_LABEL_EMPTY");
  });

  it("falla con menos de 3 puntos", () => {
    const twoPoints = [{ x: 0, y: 0 }, { x: 1, y: 1 }] as unknown as import("@domain/model/seatmap").Polygon;
    const errors = execFail({
      type: "CREATE_AREA",
      payload: { ...validPayload, points: twoPoints },
    });
    expect(errors[0]?.code).toBe("CMD_AREA_POLYGON_TOO_FEW_POINTS");
  });

  it("falla con capacity negativa", () => {
    const errors = execFail({
      type: "CREATE_AREA",
      payload: { ...validPayload, capacity: -1 },
    });
    expect(errors[0]?.code).toBe("CMD_AREA_CAPACITY_INVALID");
  });
});

describe("UPDATE_AREA_SHAPE", () => {
  const mapWithArea = makeSeatMap({ areas: { "area-1": makeArea() } });

  it("actualiza los puntos del polígono", () => {
    const newPoints = [
      { x: 10, y: 10 },
      { x: 200, y: 10 },
      { x: 200, y: 200 },
      { x: 10, y: 200 },
    ] as const;

    const { map } = exec(
      {
        type: "UPDATE_AREA_SHAPE",
        payload: { id: "area-1", points: newPoints },
      },
      mapWithArea,
    );

    expect(map.entities.areas["area-1"]?.points).toEqual(newPoints);
  });

  it("falla si el área no existe", () => {
    const errors = execFail({
      type: "UPDATE_AREA_SHAPE",
      payload: {
        id: "no-existe",
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 },
        ] as const,
      },
    });
    expect(errors[0]?.code).toBe("CMD_AREA_NOT_FOUND");
  });
});

describe("UPDATE_AREA_CAPACITY", () => {
  const mapWithArea = makeSeatMap({ areas: { "area-1": makeArea() } });

  it("actualiza la capacidad", () => {
    const { map } = exec(
      {
        type: "UPDATE_AREA_CAPACITY",
        payload: { id: "area-1", capacity: 200 },
      },
      mapWithArea,
    );
    expect(map.entities.areas["area-1"]?.capacity).toBe(200);
  });

  it("acepta capacidad 0", () => {
    const { map } = exec(
      { type: "UPDATE_AREA_CAPACITY", payload: { id: "area-1", capacity: 0 } },
      mapWithArea,
    );
    expect(map.entities.areas["area-1"]?.capacity).toBe(0);
  });

  it("falla con capacidad negativa", () => {
    const errors = execFail(
      { type: "UPDATE_AREA_CAPACITY", payload: { id: "area-1", capacity: -1 } },
      mapWithArea,
    );
    expect(errors[0]?.code).toBe("CMD_AREA_CAPACITY_INVALID");
  });
});

describe("SET_ENTITY_LABEL", () => {
  const mapWithAll = makeSeatMap({
    rows: { "row-1": makeRow() },
    tables: { "table-1": makeTable() },
    areas: { "area-1": makeArea() },
  });

  it("cambia el label de una fila", () => {
    const { map } = exec(
      {
        type: "SET_ENTITY_LABEL",
        payload: { kind: "row", id: "row-1", label: "Platea" },
      },
      mapWithAll,
    );
    expect(map.entities.rows["row-1"]?.label).toBe("Platea");
  });

  it("cambia el label de una mesa", () => {
    const { map } = exec(
      {
        type: "SET_ENTITY_LABEL",
        payload: { kind: "table", id: "table-1", label: "Mesa VIP" },
      },
      mapWithAll,
    );
    expect(map.entities.tables["table-1"]?.label).toBe("Mesa VIP");
  });

  it("cambia el label de un área", () => {
    const { map } = exec(
      {
        type: "SET_ENTITY_LABEL",
        payload: { kind: "area", id: "area-1", label: "Palco" },
      },
      mapWithAll,
    );
    expect(map.entities.areas["area-1"]?.label).toBe("Palco");
  });

  it("falla con label vacío", () => {
    const errors = execFail(
      {
        type: "SET_ENTITY_LABEL",
        payload: { kind: "row", id: "row-1", label: "" },
      },
      mapWithAll,
    );
    expect(errors[0]?.code).toBe("CMD_ENTITY_LABEL_EMPTY");
  });

  it("falla si la entidad no existe", () => {
    const errors = execFail(
      {
        type: "SET_ENTITY_LABEL",
        payload: { kind: "row", id: "no-existe", label: "X" },
      },
      mapWithAll,
    );
    expect(errors[0]?.code).toBe("CMD_ENTITY_NOT_FOUND");
  });
});

describe("SET_SEAT_LABEL_OVERRIDE", () => {
  const mapWithRow = makeSeatMap({
    rows: { "row-1": makeRow({ seatCount: 4 }) },
  });
  const mapWithTable = makeSeatMap({
    tables: { "table-1": makeTable({ seatCount: 6 }) },
  });

  it("aplica un override en una fila", () => {
    const { map } = exec(
      {
        type: "SET_SEAT_LABEL_OVERRIDE",
        payload: { kind: "row", id: "row-1", seatIndex: 2, label: "ESPECIAL" },
      },
      mapWithRow,
    );
    expect(map.entities.rows["row-1"]?.seatOverrides[2]).toEqual({
      label: "ESPECIAL",
    });
  });

  it("aplica un override en una mesa", () => {
    const { map } = exec(
      {
        type: "SET_SEAT_LABEL_OVERRIDE",
        payload: { kind: "table", id: "table-1", seatIndex: 0, label: "VIP" },
      },
      mapWithTable,
    );
    expect(map.entities.tables["table-1"]?.seatOverrides[0]).toEqual({
      label: "VIP",
    });
  });

  it("falla con label override vacío", () => {
    const errors = execFail(
      {
        type: "SET_SEAT_LABEL_OVERRIDE",
        payload: { kind: "row", id: "row-1", seatIndex: 0, label: "   " },
      },
      mapWithRow,
    );
    expect(errors[0]?.code).toBe("CMD_SEAT_OVERRIDE_LABEL_EMPTY");
  });

  it("falla con índice fuera de rango", () => {
    const errors = execFail(
      {
        type: "SET_SEAT_LABEL_OVERRIDE",
        payload: { kind: "row", id: "row-1", seatIndex: 10, label: "X" },
      },
      mapWithRow,
    );
    expect(errors[0]?.code).toBe("CMD_SEAT_INDEX_OUT_OF_RANGE");
  });

  it("falla con índice negativo", () => {
    const errors = execFail(
      {
        type: "SET_SEAT_LABEL_OVERRIDE",
        payload: { kind: "row", id: "row-1", seatIndex: -1, label: "X" },
      },
      mapWithRow,
    );
    expect(errors[0]?.code).toBe("CMD_SEAT_INDEX_OUT_OF_RANGE");
  });
});

describe("APPLY_LABEL_RULE", () => {
  it("cambia la regla de etiquetado de una fila y afecta los labels derivados", () => {
    const row = makeRow({
      label: "B",
      labeling: { template: "{row}-{n}", startIndex: 1, pad: 0 },
    });
    const map = makeSeatMap({ rows: { "row-1": row } });
    const newRule = { template: "Platea {n}", startIndex: 1, pad: 2 };

    const { map: newMap } = exec(
      {
        type: "APPLY_LABEL_RULE",
        payload: { kind: "row", id: "row-1", rule: newRule },
      },
      map,
    );

    const updatedRow = newMap.entities.rows["row-1"]!;
    expect(updatedRow.labeling).toEqual(newRule);

    // Los labels derivados deben usar la nueva regla
    expect(getRowSeatLabel(updatedRow, 0)).toBe("Platea 01");
    expect(getRowSeatLabel(updatedRow, 1)).toBe("Platea 02");
  });

  it("limpia los overrides al aplicar la nueva regla", () => {
    const row = makeRow({
      seatOverrides: { 0: { label: "ESPECIAL-1" }, 1: { label: "ESPECIAL-2" } },
    });
    const map = makeSeatMap({ rows: { "row-1": row } });

    const { map: newMap } = exec(
      {
        type: "APPLY_LABEL_RULE",
        payload: {
          kind: "row",
          id: "row-1",
          rule: { template: "{row}{n}", startIndex: 1, pad: 0 },
        },
      },
      map,
    );

    expect(newMap.entities.rows["row-1"]?.seatOverrides).toEqual({});
  });

  it("cambia la regla de etiquetado de una mesa y afecta los labels derivados", () => {
    const table = makeTable({
      label: "T1",
      labeling: { template: "{table}-{n}", startIndex: 1, pad: 0 },
    });
    const map = makeSeatMap({ tables: { "table-1": table } });
    const newRule = { template: "Mesa {n}", startIndex: 10, pad: 0 };

    const { map: newMap } = exec(
      {
        type: "APPLY_LABEL_RULE",
        payload: { kind: "table", id: "table-1", rule: newRule },
      },
      map,
    );

    const updatedTable = newMap.entities.tables["table-1"]!;
    expect(updatedTable.labeling).toEqual(newRule);
    // startIndex=10 → primer asiento = "Mesa 10"
    expect(getTableSeatLabel(updatedTable, 0)).toBe("Mesa 10");
  });

  it("falla con template vacío", () => {
    const map = makeSeatMap({ rows: { "row-1": makeRow() } });
    const errors = execFail(
      {
        type: "APPLY_LABEL_RULE",
        payload: {
          kind: "row",
          id: "row-1",
          rule: { template: "", startIndex: 1, pad: 0 },
        },
      },
      map,
    );
    expect(errors[0]?.code).toBe("CMD_LABELING_TEMPLATE_EMPTY");
  });

  it("falla con startIndex < 1", () => {
    const map = makeSeatMap({ rows: { "row-1": makeRow() } });
    const errors = execFail(
      {
        type: "APPLY_LABEL_RULE",
        payload: {
          kind: "row",
          id: "row-1",
          rule: { template: "{n}", startIndex: 0, pad: 0 },
        },
      },
      map,
    );
    expect(errors[0]?.code).toBe("CMD_LABELING_START_INDEX_INVALID");
  });

  it("falla si la entidad no existe", () => {
    const errors = execFail({
      type: "APPLY_LABEL_RULE",
      payload: {
        kind: "row",
        id: "no-existe",
        rule: { template: "{n}", startIndex: 1, pad: 0 },
      },
    });
    expect(errors[0]?.code).toBe("CMD_ENTITY_NOT_FOUND");
  });
});

describe("DELETE_ENTITIES", () => {
  const mapWithAll = makeSeatMap({
    rows: { "row-1": makeRow(), "row-2": makeRow({ id: "row-2", label: "B" }) },
    tables: { "table-1": makeTable() },
    areas: { "area-1": makeArea() },
  });

  it("elimina una fila existente", () => {
    const { map } = exec(
      {
        type: "DELETE_ENTITIES",
        payload: { refs: [{ kind: "row", id: "row-1" }] },
      },
      mapWithAll,
    );

    expect(map.entities.rows["row-1"]).toBeUndefined();
    // La otra fila no se toca
    expect(map.entities.rows["row-2"]).toBeDefined();
  });

  it("elimina múltiples entidades de distintos tipos a la vez", () => {
    const { map } = exec(
      {
        type: "DELETE_ENTITIES",
        payload: {
          refs: [
            { kind: "row", id: "row-1" },
            { kind: "table", id: "table-1" },
            { kind: "area", id: "area-1" },
          ],
        },
      },
      mapWithAll,
    );

    expect(map.entities.rows["row-1"]).toBeUndefined();
    expect(map.entities.tables["table-1"]).toBeUndefined();
    expect(map.entities.areas["area-1"]).toBeUndefined();
    // Lo que no fue seleccionado permanece
    expect(map.entities.rows["row-2"]).toBeDefined();
  });

  it("genera inversePatches que restauran las entidades eliminadas", () => {
    const { map: newMap, inversePatches } = exec(
      {
        type: "DELETE_ENTITIES",
        payload: { refs: [{ kind: "row", id: "row-1" }] },
      },
      mapWithAll,
    );

    const restored = applyPatches(newMap, inversePatches);
    expect(restored.entities.rows["row-1"]).toBeDefined();
  });

  it("falla si alguna de las entidades no existe (fallo atómico)", () => {
    const errors = execFail(
      {
        type: "DELETE_ENTITIES",
        payload: {
          refs: [
            { kind: "row", id: "row-1" },
            { kind: "row", id: "no-existe" },
          ],
        },
      },
      mapWithAll,
    );
    expect(errors[0]?.code).toBe("CMD_ENTITY_NOT_FOUND");
  });

  it("no-op con refs vacío: devuelve el mismo contenido sin error", () => {
    const { map } = exec(
      { type: "DELETE_ENTITIES", payload: { refs: [] } },
      mapWithAll,
    );

    expect(Object.keys(map.entities.rows)).toHaveLength(2);
    expect(map.entities.tables["table-1"]).toBeDefined();
  });
});

describe("IMPORT_MAP", () => {
  it("falla con JSON inválido (string malformado)", () => {
    const errors = execFail({
      type: "IMPORT_MAP",
      payload: { json: "{ esto no es json" },
    });
    expect(errors[0]?.code).toBe("IMPORT_JSON_PARSE_ERROR");
  });

  it("falla con objeto que no respeta el schema", () => {
    const errors = execFail({
      type: "IMPORT_MAP",
      payload: { json: { schemaVersion: 99, random: "field" } },
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});
