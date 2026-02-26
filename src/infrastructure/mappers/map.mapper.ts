import type {
  Area,
  CanvasSettings,
  GridSettings,
  LabelingRule,
  Point,
  Polygon,
  Row,
  SeatMap,
  SeatMapEntities,
  SeatMapMeta,
  SeatOverride,
  Table,
} from "@domain/model/seatmap";
import { SCHEMA_VERSION } from "@domain/model/seatmap";
import type {
  AreaDto,
  CanvasSettingsDto,
  GridSettingsDto,
  LabelingRuleDto,
  PointDto,
  RowDto,
  SeatMapDto,
  SeatMapEntitiesDto,
  SeatMapMetaDto,
  SeatOverrideDto,
  TableDto,
} from "@infrastructure/schemas";

// DTO → Domain

function pointDtoToDomain(dto: PointDto): Point {
  return { x: dto.x, y: dto.y };
}

function labelingRuleDtoToDomain(dto: LabelingRuleDto): LabelingRule {
  return {
    template: dto.template,
    startIndex: dto.startIndex,
    pad: dto.pad,
  };
}

/**
 * Convierte Record<string, SeatOverrideDto> → Record<number, SeatOverride>.
 * Las claves no numéricas se omiten silenciosamente; `validateMap` detectará
 * si el resultado tiene menos overrides de los esperados.
 */
function seatOverridesDtoToDomain(
  dto: Record<string, SeatOverrideDto>,
): Record<number, SeatOverride> {
  const result: Record<number, SeatOverride> = {};
  for (const [key, value] of Object.entries(dto)) {
    const idx = parseInt(key, 10);
    if (!isNaN(idx)) {
      result[idx] = { label: value.label };
    }
  }
  return result;
}

function rowDtoToDomain(dto: RowDto): Row {
  return {
    id: dto.id,
    start: pointDtoToDomain(dto.start),
    end: pointDtoToDomain(dto.end),
    seatCount: dto.seatCount,
    seatSpacing: dto.seatSpacing,
    seatRadius: dto.seatRadius,
    label: dto.label,
    labeling: labelingRuleDtoToDomain(dto.labeling),
    seatOverrides: seatOverridesDtoToDomain(dto.seatOverrides),
  };
}

function tableDtoToDomain(dto: TableDto): Table {
  return {
    id: dto.id,
    center: pointDtoToDomain(dto.center),
    radius: dto.radius,
    seatCount: dto.seatCount,
    seatRadius: dto.seatRadius,
    label: dto.label,
    labeling: labelingRuleDtoToDomain(dto.labeling),
    seatOverrides: seatOverridesDtoToDomain(dto.seatOverrides),
  };
}

function areaDtoToDomain(dto: AreaDto): Area {
  // El schema Zod garantiza al menos 1 punto; validateMap verifica >= 3.
  // Casteamos con `as unknown as Polygon` para respetar el tipo sin duplicar
  // la validación aquí.
  const points = dto.points.map(pointDtoToDomain) as unknown as Polygon;
  return {
    id: dto.id,
    points,
    label: dto.label,
    capacity: dto.capacity,
  };
}

function entitiesDtoToDomain(dto: SeatMapEntitiesDto): SeatMapEntities {
  return {
    rows: Object.fromEntries(
      Object.entries(dto.rows).map(([id, rowDto]) => [
        id,
        rowDtoToDomain(rowDto),
      ]),
    ),
    tables: Object.fromEntries(
      Object.entries(dto.tables).map(([id, tableDto]) => [
        id,
        tableDtoToDomain(tableDto),
      ]),
    ),
    areas: Object.fromEntries(
      Object.entries(dto.areas).map(([id, areaDto]) => [
        id,
        areaDtoToDomain(areaDto),
      ]),
    ),
  };
}

function gridSettingsDtoToDomain(dto: GridSettingsDto): GridSettings {
  return { enabled: dto.enabled, size: dto.size, snap: dto.snap };
}

function canvasSettingsDtoToDomain(dto: CanvasSettingsDto): CanvasSettings {
  return {
    width: dto.width,
    height: dto.height,
    grid: gridSettingsDtoToDomain(dto.grid),
  };
}

function metaDtoToDomain(dto: SeatMapMetaDto): SeatMapMeta {
  return {
    name: dto.name,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

/** Convierte un `SeatMapDto` (validado por Zod) en un `SeatMap` de dominio. */
export function dtoToDomain(dto: SeatMapDto): SeatMap {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: dto.id,
    meta: metaDtoToDomain(dto.meta),
    canvas: canvasSettingsDtoToDomain(dto.canvas),
    entities: entitiesDtoToDomain(dto.entities),
  };
}

// Domain → DTO

function pointDomainToDto(point: Point): PointDto {
  return { x: point.x, y: point.y };
}

function labelingRuleDomainToDto(rule: LabelingRule): LabelingRuleDto {
  return {
    template: rule.template,
    startIndex: rule.startIndex,
    pad: rule.pad,
  };
}

/**
 * Convierte Record<number, SeatOverride> → Record<string, SeatOverrideDto>.
 * JSON.stringify convierte las claves numéricas a string de todas formas,
 * pero lo hacemos explícitamente para respetar el contrato del DTO.
 */
function seatOverridesDomainToDto(
  overrides: Readonly<Record<number, SeatOverride>>,
): Record<string, SeatOverrideDto> {
  const result: Record<string, SeatOverrideDto> = {};
  for (const [key, value] of Object.entries(overrides)) {
    result[key] = { label: value.label };
  }
  return result;
}

function rowDomainToDto(row: Row): RowDto {
  return {
    id: row.id,
    start: pointDomainToDto(row.start),
    end: pointDomainToDto(row.end),
    seatCount: row.seatCount,
    seatSpacing: row.seatSpacing,
    seatRadius: row.seatRadius,
    label: row.label,
    labeling: labelingRuleDomainToDto(row.labeling),
    seatOverrides: seatOverridesDomainToDto(row.seatOverrides),
  };
}

function tableDomainToDto(table: Table): TableDto {
  return {
    id: table.id,
    center: pointDomainToDto(table.center),
    radius: table.radius,
    seatCount: table.seatCount,
    seatRadius: table.seatRadius,
    label: table.label,
    labeling: labelingRuleDomainToDto(table.labeling),
    seatOverrides: seatOverridesDomainToDto(table.seatOverrides),
  };
}

function areaDomainToDto(area: Area): AreaDto {
  return {
    id: area.id,
    // Polygon es una tuple readonly; la convertimos a array plano de PointDto.
    points: [...area.points].map(pointDomainToDto),
    label: area.label,
    capacity: area.capacity,
  };
}

function entitiesDomainToDto(entities: SeatMapEntities): SeatMapEntitiesDto {
  return {
    rows: Object.fromEntries(
      Object.entries(entities.rows).map(([id, row]) => [
        id,
        rowDomainToDto(row),
      ]),
    ),
    tables: Object.fromEntries(
      Object.entries(entities.tables).map(([id, table]) => [
        id,
        tableDomainToDto(table),
      ]),
    ),
    areas: Object.fromEntries(
      Object.entries(entities.areas).map(([id, area]) => [
        id,
        areaDomainToDto(area),
      ]),
    ),
  };
}

function gridSettingsDomainToDto(grid: GridSettings): GridSettingsDto {
  return { enabled: grid.enabled, size: grid.size, snap: grid.snap };
}

function canvasSettingsDomainToDto(canvas: CanvasSettings): CanvasSettingsDto {
  return {
    width: canvas.width,
    height: canvas.height,
    grid: gridSettingsDomainToDto(canvas.grid),
  };
}

function metaDomainToDto(meta: SeatMapMeta): SeatMapMetaDto {
  return {
    name: meta.name,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
  };
}

/** Convierte un `SeatMap` de dominio en un `SeatMapDto` listo para serializar. */
export function domainToDto(map: SeatMap): SeatMapDto {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: map.id,
    meta: metaDomainToDto(map.meta),
    canvas: canvasSettingsDomainToDto(map.canvas),
    entities: entitiesDomainToDto(map.entities),
  };
}
