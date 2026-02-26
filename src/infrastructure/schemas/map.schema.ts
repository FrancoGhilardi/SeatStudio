import { z } from "zod";

// Primitivos

export const PointDtoSchema = z.object({
  x: z.number(),
  y: z.number(),
});

// Etiquetado

export const LabelingRuleDtoSchema = z.object({
  template: z.string(),
  startIndex: z.number().int(),
  pad: z.number().int().min(0).max(8),
});

export const SeatOverrideDtoSchema = z.object({
  label: z.string(),
});

/**
 * En JSON los overrides siempre tienen claves string.
 * El mapper convierte string → number al construir el dominio.
 */
export const SeatOverridesMapDtoSchema = z.record(
  z.string(),
  SeatOverrideDtoSchema,
);

// Entidades

export const RowDtoSchema = z.object({
  id: z.string(),
  start: PointDtoSchema,
  end: PointDtoSchema,
  seatCount: z.number().int().min(1),
  seatSpacing: z.number().positive(),
  seatRadius: z.number().positive(),
  label: z.string(),
  labeling: LabelingRuleDtoSchema,
  seatOverrides: SeatOverridesMapDtoSchema,
});

export const TableDtoSchema = z.object({
  id: z.string(),
  center: PointDtoSchema,
  radius: z.number().positive(),
  seatCount: z.number().int().min(1),
  seatRadius: z.number().positive(),
  label: z.string(),
  labeling: LabelingRuleDtoSchema,
  seatOverrides: SeatOverridesMapDtoSchema,
});

export const AreaDtoSchema = z.object({
  id: z.string(),
  /** Mínimo 3 puntos (invariante de dominio; schema permite >= 1 para dar error legible en validateMap) */
  points: z.array(PointDtoSchema).min(1),
  label: z.string(),
  capacity: z.number().int().min(0),
});

// Canvas / Meta

export const GridSettingsDtoSchema = z.object({
  enabled: z.boolean(),
  size: z.number().positive(),
  snap: z.boolean(),
});

export const CanvasSettingsDtoSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  grid: GridSettingsDtoSchema,
});

export const SeatMapMetaDtoSchema = z.object({
  name: z.string(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

// Entidades del mapa

export const SeatMapEntitiesDtoSchema = z.object({
  rows: z.record(z.string(), RowDtoSchema),
  tables: z.record(z.string(), TableDtoSchema),
  areas: z.record(z.string(), AreaDtoSchema),
});

// Raíz: SeatMapDto

export const SUPPORTED_SCHEMA_VERSIONS = [1] as const;

export const SeatMapDtoSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  meta: SeatMapMetaDtoSchema,
  canvas: CanvasSettingsDtoSchema,
  entities: SeatMapEntitiesDtoSchema,
});

// Tipos DTO inferidos (solo para uso en infrastructure / mapper)

export type PointDto = z.infer<typeof PointDtoSchema>;
export type LabelingRuleDto = z.infer<typeof LabelingRuleDtoSchema>;
export type SeatOverrideDto = z.infer<typeof SeatOverrideDtoSchema>;
export type RowDto = z.infer<typeof RowDtoSchema>;
export type TableDto = z.infer<typeof TableDtoSchema>;
export type AreaDto = z.infer<typeof AreaDtoSchema>;
export type GridSettingsDto = z.infer<typeof GridSettingsDtoSchema>;
export type CanvasSettingsDto = z.infer<typeof CanvasSettingsDtoSchema>;
export type SeatMapMetaDto = z.infer<typeof SeatMapMetaDtoSchema>;
export type SeatMapEntitiesDto = z.infer<typeof SeatMapEntitiesDtoSchema>;
export type SeatMapDto = z.infer<typeof SeatMapDtoSchema>;
