import { describe, expect, it } from "vitest";
import type { LabelingRule } from "@domain/model";
import {
  formatLabel,
  getRowSeatLabel,
  getTableSeatLabel,
} from "@domain/services/labeling";
import { makeRow, makeTable } from "./fixtures";

describe("formatLabel", () => {
  it("sustituye {n} con el número de asiento", () => {
    const rule: LabelingRule = { template: "{n}", startIndex: 1, pad: 0 };
    expect(formatLabel(rule, { n: 1 })).toBe("1");
    expect(formatLabel(rule, { n: 5 })).toBe("5");
  });

  it("aplica startIndex al número resultante", () => {
    const rule: LabelingRule = { template: "{n}", startIndex: 10, pad: 0 };
    // n=1 + startIndex=10 - 1 = 10
    expect(formatLabel(rule, { n: 1 })).toBe("10");
  });

  it("aplica pad con ceros a la izquierda", () => {
    const rule: LabelingRule = { template: "{n}", startIndex: 1, pad: 3 };
    expect(formatLabel(rule, { n: 1 })).toBe("001");
    expect(formatLabel(rule, { n: 10 })).toBe("010");
  });

  it("sustituye {row} con el label de la fila", () => {
    const rule: LabelingRule = { template: "{row}-{n}", startIndex: 1, pad: 0 };
    expect(formatLabel(rule, { row: "A", n: 3 })).toBe("A-3");
  });

  it("sustituye {table} con el label de la mesa", () => {
    const rule: LabelingRule = {
      template: "{table}/{n}",
      startIndex: 1,
      pad: 0,
    };
    expect(formatLabel(rule, { table: "T1", n: 2 })).toBe("T1/2");
  });

  it("deja vacío {row} si no se provee", () => {
    const rule: LabelingRule = { template: "{row}{n}", startIndex: 1, pad: 0 };
    expect(formatLabel(rule, { n: 1 })).toBe("1");
  });

  it("soporta múltiples ocurrencias del mismo marcador", () => {
    const rule: LabelingRule = { template: "{n}-{n}", startIndex: 1, pad: 0 };
    expect(formatLabel(rule, { n: 2 })).toBe("2-2");
  });
});

describe("getRowSeatLabel", () => {
  it("genera label derivado con template de fila", () => {
    const row = makeRow({
      label: "A",
      labeling: { template: "{row}-{n}", startIndex: 1, pad: 0 },
    });
    expect(getRowSeatLabel(row, 0)).toBe("A-1");
    expect(getRowSeatLabel(row, 1)).toBe("A-2");
    expect(getRowSeatLabel(row, 3)).toBe("A-4");
  });

  it("usa el override si existe para el índice", () => {
    const row = makeRow({ seatOverrides: { 1: { label: "ESPECIAL" } } });
    expect(getRowSeatLabel(row, 1)).toBe("ESPECIAL");
  });

  it("no usa override de otro índice", () => {
    const row = makeRow({
      label: "B",
      labeling: { template: "{row}{n}", startIndex: 1, pad: 0 },
      seatOverrides: { 2: { label: "X" } },
    });
    expect(getRowSeatLabel(row, 0)).toBe("B1");
    expect(getRowSeatLabel(row, 1)).toBe("B2");
    expect(getRowSeatLabel(row, 2)).toBe("X");
  });

  it("respeta pad en label derivado", () => {
    const row = makeRow({
      label: "F",
      labeling: { template: "{row}{n}", startIndex: 1, pad: 2 },
      seatOverrides: {},
    });
    expect(getRowSeatLabel(row, 0)).toBe("F01");
    expect(getRowSeatLabel(row, 9)).toBe("F10");
  });
});

describe("getTableSeatLabel", () => {
  it("genera label derivado con template de mesa", () => {
    const table = makeTable({
      label: "T1",
      labeling: { template: "{table}-{n}", startIndex: 1, pad: 0 },
    });
    expect(getTableSeatLabel(table, 0)).toBe("T1-1");
    expect(getTableSeatLabel(table, 5)).toBe("T1-6");
  });

  it("usa el override si existe", () => {
    const table = makeTable({ seatOverrides: { 0: { label: "VIP" } } });
    expect(getTableSeatLabel(table, 0)).toBe("VIP");
  });
});
