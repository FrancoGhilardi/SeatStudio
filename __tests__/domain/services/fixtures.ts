import type { Area, LabelingRule, Row, SeatMap, Table } from "@domain/model";
import { SCHEMA_VERSION } from "@domain/model";

// Helpers de construcción de entidades de prueba

export const DEFAULT_LABELING: LabelingRule = {
  template: "{row}-{n}",
  startIndex: 1,
  pad: 0,
};

export function makeRow(overrides?: Partial<Row>): Row {
  return {
    id: "row-1",
    start: { x: 0, y: 0 },
    end: { x: 200, y: 0 },
    seatCount: 4,
    seatSpacing: 50,
    seatRadius: 15,
    label: "A",
    labeling: DEFAULT_LABELING,
    seatOverrides: {},
    ...overrides,
  };
}

export function makeTable(overrides?: Partial<Table>): Table {
  return {
    id: "table-1",
    center: { x: 100, y: 100 },
    radius: 60,
    seatCount: 6,
    seatRadius: 12,
    label: "T1",
    labeling: { template: "{table}-{n}", startIndex: 1, pad: 0 },
    seatOverrides: {},
    ...overrides,
  };
}

export function makeArea(overrides?: Partial<Area>): Area {
  return {
    id: "area-1",
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ],
    label: "Zona VIP",
    capacity: 50,
    ...overrides,
  };
}

export function makeSeatMap(
  entities?: Partial<SeatMap["entities"]>,
  metaName = "Mi mapa",
): SeatMap {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: "map-1",
    meta: {
      name: metaName,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    canvas: {
      width: 1200,
      height: 800,
      grid: { enabled: true, size: 20, snap: true },
    },
    entities: {
      rows: {},
      tables: {},
      areas: {},
      ...entities,
    },
  };
}
