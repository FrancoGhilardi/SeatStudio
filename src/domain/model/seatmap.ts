// Primitivos geométricos
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Al menos 3 puntos para formar un polígono válido */
export type Polygon = readonly [Point, Point, Point, ...Point[]];

// Etiquetado

/**
 * Regla de etiquetado para asientos derivados.
 *
 * `template` soporta los marcadores:
 *   - `{row}`   → label de la fila
 *   - `{table}` → label de la mesa
 *   - `{n}`     → número de asiento (respetando startIndex y pad)
 */
export interface LabelingRule {
  readonly template: string;
  readonly startIndex: number;
  /** Relleno con ceros: 0 = sin relleno, 1-8 dígitos */
  readonly pad: number;
}

/** Override de label para un asiento individual (por índice 0-based) */
export interface SeatOverride {
  readonly label: string;
}

// Entidades de dominio

/**
 * Fila recta de asientos.
 *
 * Invariantes:
 *  - start !== end (la línea no puede ser un punto)
 *  - seatCount >= 1
 *  - seatSpacing > 0
 *  - seatRadius > 0
 *  - label no vacío
 *  - labeling.template no vacío
 *  - claves de seatOverrides en rango [0, seatCount)
 */
export interface Row {
  readonly id: string;
  readonly start: Point;
  readonly end: Point;
  readonly seatCount: number;
  readonly seatSpacing: number;
  readonly seatRadius: number;
  readonly label: string;
  readonly labeling: LabelingRule;
  /** key: índice 0-based del asiento */
  readonly seatOverrides: Readonly<Record<number, SeatOverride>>;
}

/**
 * Mesa circular con asientos alrededor.
 *
 * Invariantes:
 *  - radius > 0
 *  - seatCount >= 1
 *  - seatRadius > 0
 *  - label no vacío
 *  - labeling.template no vacío
 *  - claves de seatOverrides en rango [0, seatCount)
 */
export interface Table {
  readonly id: string;
  readonly center: Point;
  readonly radius: number;
  readonly seatCount: number;
  readonly seatRadius: number;
  readonly label: string;
  readonly labeling: LabelingRule;
  /** key: índice 0-based del asiento */
  readonly seatOverrides: Readonly<Record<number, SeatOverride>>;
}

/**
 * Área poligonal con capacidad.
 *
 * Invariantes:
 *  - points.length >= 3
 *  - label no vacío
 *  - capacity >= 0
 */
export interface Area {
  readonly id: string;
  readonly points: Polygon;
  readonly label: string;
  readonly capacity: number;
}

// Entidades del mapa (colecciones normalizadas)

export interface SeatMapEntities {
  readonly rows: Readonly<Record<string, Row>>;
  readonly tables: Readonly<Record<string, Table>>;
  readonly areas: Readonly<Record<string, Area>>;
}

// Configuración del canvas

export interface GridSettings {
  readonly enabled: boolean;
  readonly size: number;
  readonly snap: boolean;
}

export interface CanvasSettings {
  readonly width: number;
  readonly height: number;
  readonly grid: GridSettings;
}

// Metadatos del mapa

export interface SeatMapMeta {
  readonly name: string;
  readonly createdAt: string; // ISO 8601
  readonly updatedAt: string; // ISO 8601
}

// Tipos discriminantes de entidad

/**
 * Discriminante de tipo de entidad del mapa.
 * Permite a commands, selectors y UI trabajar con entidades
 * de forma polimórfica sin if/else por colección.
 */
export type EntityKind = "row" | "table" | "area";

/**
 * Referencia ligera (sin datos) a cualquier entidad del mapa.
 * Usada en selecciones, comandos DELETE_ENTITIES, etc.
 */
export interface EntityRef {
  readonly kind: EntityKind;
  readonly id: string;
}

/** Mapeo de EntityKind a la clave de colección en SeatMapEntities */
export const ENTITY_COLLECTION = {
  row: "rows",
  table: "tables",
  area: "areas",
} as const satisfies Record<EntityKind, keyof SeatMapEntities>;

// Raíz del dominio

export const SCHEMA_VERSION = 1 as const;
export type SchemaVersion = typeof SCHEMA_VERSION;

export interface SeatMap {
  readonly schemaVersion: SchemaVersion;
  readonly id: string;
  readonly meta: SeatMapMeta;
  readonly canvas: CanvasSettings;
  readonly entities: SeatMapEntities;
}
