import { describe, expect, it } from "vitest";
import {
  aabbIntersects,
  areaBBox,
  rowBBox,
  tableBBox,
} from "@domain/services/hitTest";
import { makeArea, makeRow, makeTable } from "./fixtures";

describe("aabbIntersects", () => {
  it("retorna true cuando los AABB se solapan parcialmente", () => {
    const a = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const b = { minX: 5, minY: 5, maxX: 15, maxY: 15 };
    expect(aabbIntersects(a, b)).toBe(true);
  });

  it("retorna true cuando uno contiene completamente al otro", () => {
    const a = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const b = { minX: 20, minY: 20, maxX: 80, maxY: 80 };
    expect(aabbIntersects(a, b)).toBe(true);
  });

  it("retorna true cuando solo se tocan en el borde exacto", () => {
    const a = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const b = { minX: 10, minY: 0, maxX: 20, maxY: 10 };
    expect(aabbIntersects(a, b)).toBe(true);
  });

  it("retorna false cuando los AABB están separados en X", () => {
    const a = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const b = { minX: 20, minY: 0, maxX: 30, maxY: 10 };
    expect(aabbIntersects(a, b)).toBe(false);
  });

  it("retorna false cuando los AABB están separados en Y", () => {
    const a = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const b = { minX: 0, minY: 20, maxX: 10, maxY: 30 };
    expect(aabbIntersects(a, b)).toBe(false);
  });

  it("es simétrico (a ∩ b = b ∩ a)", () => {
    const a = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const b = { minX: 15, minY: 0, maxX: 25, maxY: 10 };
    expect(aabbIntersects(a, b)).toBe(aabbIntersects(b, a));
  });
});

describe("rowBBox", () => {
  it("cubre todos los asientos más el seatRadius de una fila horizontal", () => {
    // makeRow: start={0,0}, end={200,0}, seatCount=4, seatSpacing=50, seatRadius=15
    // seats centrados: positions en x = -75, -25, 25, 75 (centradas en 100?)
    // Verifiquemos: midpoint = (100,0), span = 3*50=150, offsets = -75, -25, 25, 75
    // pos[0] = {25, 0}, pos[3] = {175, 0}   <- con el start en 0
    // Más en detalle: center = midpoint({0,0},{200,0}) = {100,0}
    //                 offset[0] = -75   → x = 100-75 = 25
    //                 offset[3] = +75   → x = 100+75 = 175
    const row = makeRow();
    const bbox = rowBBox(row);

    expect(bbox.minX).toBe(25 - 15); // pos[0].x - seatRadius
    expect(bbox.maxX).toBe(175 + 15); // pos[3].x + seatRadius
    expect(bbox.minY).toBe(-15);
    expect(bbox.maxY).toBe(15);
  });

  it("un solo asiento produce AABB 2×seatRadius cuadrado centrado en el asiento", () => {
    const row = makeRow({ seatCount: 1, seatRadius: 10 });
    // midpoint = (100,0), 1 asiento = en el centro
    const bbox = rowBBox(row);
    expect(bbox.minX).toBe(100 - 10);
    expect(bbox.maxX).toBe(100 + 10);
    expect(bbox.minY).toBe(-10);
    expect(bbox.maxY).toBe(10);
  });

  it("maneja filas diagonales correctamente (minX ≤ maxX, minY ≤ maxY)", () => {
    const row = makeRow({
      start: { x: 0, y: 0 },
      end: { x: 100, y: 100 },
      seatCount: 2,
      seatSpacing: 50,
      seatRadius: 5,
    });
    const bbox = rowBBox(row);
    expect(bbox.minX).toBeLessThan(bbox.maxX);
    expect(bbox.minY).toBeLessThan(bbox.maxY);
  });
});

describe("tableBBox", () => {
  it("el AABB envuelve el disco más los asientos perimetrales", () => {
    // makeTable: center={100,100}, radius=60, seatRadius=12
    const table = makeTable();
    const effectiveR = 60 + 12;
    const bbox = tableBBox(table);
    expect(bbox.minX).toBe(100 - effectiveR);
    expect(bbox.maxX).toBe(100 + effectiveR);
    expect(bbox.minY).toBe(100 - effectiveR);
    expect(bbox.maxY).toBe(100 + effectiveR);
  });

  it("es cuadrado (isométrico): ancho == alto", () => {
    const table = makeTable();
    const bbox = tableBBox(table);
    expect(bbox.maxX - bbox.minX).toBe(bbox.maxY - bbox.minY);
  });
});

describe("areaBBox", () => {
  it("envuelve exactamente todos los vértices del polígono", () => {
    // makeArea: points = [{0,0},{100,0},{100,100}]
    const area = makeArea();
    const bbox = areaBBox(area);
    expect(bbox.minX).toBe(0);
    expect(bbox.maxX).toBe(100);
    expect(bbox.minY).toBe(0);
    expect(bbox.maxY).toBe(100);
  });

  it("funciona con polígonos en coordenadas negativas", () => {
    const area = makeArea({
      points: [
        { x: -50, y: -50 },
        { x: 50, y: -50 },
        { x: 0, y: 50 },
      ],
    });
    const bbox = areaBBox(area);
    expect(bbox.minX).toBe(-50);
    expect(bbox.maxX).toBe(50);
    expect(bbox.minY).toBe(-50);
    expect(bbox.maxY).toBe(50);
  });
});
