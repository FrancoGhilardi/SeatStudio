import { describe, expect, it } from "vitest";
import {
  computeEntitiesBBox,
  distance,
  getRowSeatPosition,
  getTableSeatPosition,
  midpoint,
  unitVector,
} from "@domain/services/geometry";
import { makeArea, makeRow, makeTable } from "./fixtures";

describe("distance", () => {
  it("retorna 0 para puntos idénticos", () => {
    expect(distance({ x: 3, y: 4 }, { x: 3, y: 4 })).toBe(0);
  });
  it("calcula la hipotenusa 3-4-5", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5);
  });
  it("es simétrica", () => {
    const a = { x: 1, y: 2 };
    const b = { x: 4, y: 6 };
    expect(distance(a, b)).toBeCloseTo(distance(b, a));
  });
});

describe("midpoint", () => {
  it("devuelve el punto medio entre dos puntos", () => {
    const m = midpoint({ x: 0, y: 0 }, { x: 10, y: 10 });
    expect(m.x).toBeCloseTo(5);
    expect(m.y).toBeCloseTo(5);
  });
  it("funciona con coordenadas negativas", () => {
    const m = midpoint({ x: -10, y: -6 }, { x: 10, y: 6 });
    expect(m.x).toBeCloseTo(0);
    expect(m.y).toBeCloseTo(0);
  });
});

describe("unitVector", () => {
  it("retorna (1,0) para vector horizontal hacia la derecha", () => {
    const u = unitVector({ x: 0, y: 0 }, { x: 5, y: 0 });
    expect(u.x).toBeCloseTo(1);
    expect(u.y).toBeCloseTo(0);
  });
  it("retorna (0,1) para vector vertical hacia abajo", () => {
    const u = unitVector({ x: 0, y: 0 }, { x: 0, y: 3 });
    expect(u.x).toBeCloseTo(0);
    expect(u.y).toBeCloseTo(1);
  });
  it("retorna (0,0) para puntos idénticos (caso defensivo)", () => {
    const u = unitVector({ x: 1, y: 1 }, { x: 1, y: 1 });
    expect(u.x).toBe(0);
    expect(u.y).toBe(0);
  });
  it("el módulo del vector resultante es siempre 1", () => {
    const u = unitVector({ x: 1, y: 2 }, { x: 4, y: 6 });
    const magnitude = Math.sqrt(u.x ** 2 + u.y ** 2);
    expect(magnitude).toBeCloseTo(1);
  });
});

describe("getRowSeatPosition", () => {
  it("devuelve el midpoint para un único asiento", () => {
    const row = makeRow({
      start: { x: 0, y: 0 },
      end: { x: 100, y: 0 },
      seatCount: 1,
      seatSpacing: 50,
    });
    const pos = getRowSeatPosition(row, 0);
    expect(pos.x).toBeCloseTo(50);
    expect(pos.y).toBeCloseTo(0);
  });

  it("distribuye asientos centrados en fila horizontal", () => {
    // 3 asientos, spacing=50 → span=100 → offset: -50, 0, 50
    const row = makeRow({
      start: { x: 0, y: 0 },
      end: { x: 200, y: 0 },
      seatCount: 3,
      seatSpacing: 50,
    });
    const center = 100; // midpoint de [0,200]
    expect(getRowSeatPosition(row, 0).x).toBeCloseTo(center - 50);
    expect(getRowSeatPosition(row, 1).x).toBeCloseTo(center);
    expect(getRowSeatPosition(row, 2).x).toBeCloseTo(center + 50);
    expect(getRowSeatPosition(row, 0).y).toBeCloseTo(0);
  });

  it("distribuye asientos en fila vertical", () => {
    const row = makeRow({
      start: { x: 0, y: 0 },
      end: { x: 0, y: 100 },
      seatCount: 3,
      seatSpacing: 25,
    });
    const centerY = 50;
    expect(getRowSeatPosition(row, 0).y).toBeCloseTo(centerY - 25);
    expect(getRowSeatPosition(row, 1).y).toBeCloseTo(centerY);
    expect(getRowSeatPosition(row, 2).y).toBeCloseTo(centerY + 25);
    expect(getRowSeatPosition(row, 0).x).toBeCloseTo(0);
  });

  it("distribuye asientos en fila diagonal", () => {
    const row = makeRow({
      start: { x: 0, y: 0 },
      end: { x: 100, y: 100 },
      seatCount: 2,
      seatSpacing: 20,
    });
    const pos0 = getRowSeatPosition(row, 0);
    const pos1 = getRowSeatPosition(row, 1);
    const dx = pos1.x - pos0.x;
    const dy = pos1.y - pos0.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    expect(dist).toBeCloseTo(20);
  });
});

describe("getTableSeatPosition", () => {
  it("coloca el primer asiento en la parte superior (−π/2)", () => {
    const table = makeTable({
      center: { x: 0, y: 0 },
      radius: 60,
      seatRadius: 12,
      seatCount: 4,
    });
    const pos = getTableSeatPosition(table, 0);
    const r = 60 + 12;
    expect(pos.x).toBeCloseTo(0);
    expect(pos.y).toBeCloseTo(-r);
  });

  it("distribuye N asientos equidistantes alrededor del círculo", () => {
    const n = 6;
    const table = makeTable({ center: { x: 0, y: 0 }, seatCount: n });
    const positions = Array.from({ length: n }, (_, i) =>
      getTableSeatPosition(table, i),
    );
    const r = table.radius + table.seatRadius;

    for (const pos of positions) {
      const dist = Math.sqrt(pos.x ** 2 + pos.y ** 2);
      expect(dist).toBeCloseTo(r);
    }

    const angleStep = (2 * Math.PI) / n;
    for (let i = 0; i < n - 1; i++) {
      const p1 = positions[i]!;
      const p2 = positions[i + 1]!;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const chord = Math.sqrt(dx * dx + dy * dy);
      const expectedChord = 2 * r * Math.sin(angleStep / 2);
      expect(chord).toBeCloseTo(expectedChord);
    }
  });

  it("respeta las coordenadas del centro de la mesa", () => {
    const table = makeTable({
      center: { x: 200, y: 150 },
      radius: 40,
      seatRadius: 10,
      seatCount: 4,
    });
    const r = 40 + 10;
    const positions = Array.from({ length: 4 }, (_, i) =>
      getTableSeatPosition(table, i),
    );
    for (const pos of positions) {
      const dx = pos.x - 200;
      const dy = pos.y - 150;
      expect(Math.sqrt(dx * dx + dy * dy)).toBeCloseTo(r);
    }
  });
});

describe("computeEntitiesBBox", () => {
  it("retorna null para mapa vacío", () => {
    expect(computeEntitiesBBox({ rows: {}, tables: {}, areas: {} })).toBeNull();
  });

  it("incluye padding de seatRadius en filas", () => {
    const row = makeRow({
      start: { x: 0, y: 0 },
      end: { x: 100, y: 0 },
      seatRadius: 15,
    });
    const bbox = computeEntitiesBBox({
      rows: { r: row },
      tables: {},
      areas: {},
    });
    expect(bbox).not.toBeNull();
    // pad = seatRadius + 8 = 23
    expect(bbox!.minX).toBeLessThanOrEqual(-23);
    expect(bbox!.minY).toBeLessThanOrEqual(-23);
    expect(bbox!.maxX).toBeGreaterThanOrEqual(123);
  });

  it("incluye padding de radius+seatRadius en mesas", () => {
    const table = makeTable({
      center: { x: 200, y: 200 },
      radius: 60,
      seatRadius: 12,
    });
    const bbox = computeEntitiesBBox({
      rows: {},
      tables: { t: table },
      areas: {},
    });
    expect(bbox).not.toBeNull();
    // pad = 60 + 12 + 8 = 80
    expect(bbox!.minX).toBeCloseTo(200 - 80);
    expect(bbox!.maxX).toBeCloseTo(200 + 80);
  });

  it("envuelve los vértices de las áreas con padding 8", () => {
    const area = makeArea({
      points: [
        { x: 10, y: 10 },
        { x: 90, y: 10 },
        { x: 90, y: 90 },
      ],
    });
    const bbox = computeEntitiesBBox({
      rows: {},
      tables: {},
      areas: { a: area },
    });
    expect(bbox).not.toBeNull();
    expect(bbox!.minX).toBeCloseTo(10 - 8);
    expect(bbox!.minY).toBeCloseTo(10 - 8);
    expect(bbox!.maxX).toBeCloseTo(90 + 8);
    expect(bbox!.maxY).toBeCloseTo(90 + 8);
  });

  it("unifica entidades mixtas en un único bbox", () => {
    const row = makeRow({
      start: { x: -100, y: 0 },
      end: { x: 0, y: 0 },
      seatRadius: 5,
    });
    const table = makeTable({
      center: { x: 500, y: 500 },
      radius: 30,
      seatRadius: 5,
    });
    const bbox = computeEntitiesBBox({
      rows: { r: row },
      tables: { t: table },
      areas: {},
    });
    expect(bbox).not.toBeNull();
    // lado izquierdo viene de la fila; lado derecho de la mesa
    expect(bbox!.minX).toBeLessThan(0);
    expect(bbox!.maxX).toBeGreaterThan(400);
  });
});
