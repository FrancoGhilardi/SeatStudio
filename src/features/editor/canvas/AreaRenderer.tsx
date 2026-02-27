"use client";

import { memo } from "react";
import { Group, Line, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Area } from "@domain/model/seatmap";

const AREA_FILL = "rgba(99, 102, 241, 0.12)"; // indigo, semi-transparente
const AREA_STROKE = "#6366f1"; // indigo-500
const AREA_LABEL_COLOR = "#e4e4e7"; // zinc-200
const AREA_CAPACITY_COLOR = "#a1a1aa"; // zinc-400

const AREA_FILL_SELECTED = "rgba(99, 102, 241, 0.28)";
const AREA_STROKE_SELECTED = "#818cf8";

const LABEL_FONT_SIZE = 13;
const CAPACITY_FONT_SIZE = 11;

/** Centroide geométrico de un polígono (promedio de vértices). */
function centroid(points: ReadonlyArray<{ x: number; y: number }>): {
  x: number;
  y: number;
} {
  const n = points.length;
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / n, y: sy / n };
}

/** Convierte array de Point a flat array [x0,y0,x1,y1,...] que necesita Konva. */
function toFlat(points: ReadonlyArray<{ x: number; y: number }>): number[] {
  return points.flatMap((p) => [p.x, p.y]);
}

interface AreaRendererProps {
  area: Area;
  selected?: boolean;
  /** Callback invocado cuando el usuario hace clic sobre el área. */
  onClick?: (e: KonvaEventObject<MouseEvent>) => void;
}

/**
 * Dibuja un área poligonal:
 *  - Polígono relleno semi-transparente + borde
 *  - Label centrado en el centroide
 *  - Capacidad ("cap: N") bajo el label
 */
export const AreaRenderer = memo(function AreaRenderer({
  area,
  selected = false,
  onClick,
}: AreaRendererProps) {
  const fill = selected ? AREA_FILL_SELECTED : AREA_FILL;
  const stroke = selected ? AREA_STROKE_SELECTED : AREA_STROKE;
  const flat = toFlat(area.points);
  const center = centroid(area.points);

  return (
    <Group {...(onClick !== undefined ? { onClick } : {})}>
      {/* Polígono — zona de hit + visual */}
      <Line
        points={flat}
        closed
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
        perfectDrawEnabled={false}
      />

      {/* Label */}
      <Text
        x={center.x - 60}
        y={center.y - 14}
        text={area.label}
        fontSize={LABEL_FONT_SIZE}
        fill={AREA_LABEL_COLOR}
        align="center"
        width={120}
        fontStyle="bold"
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* Capacidad */}
      <Text
        x={center.x - 60}
        y={center.y + 2}
        text={`cap: ${area.capacity}`}
        fontSize={CAPACITY_FONT_SIZE}
        fill={AREA_CAPACITY_COLOR}
        align="center"
        width={120}
        listening={false}
        perfectDrawEnabled={false}
      />
    </Group>
  );
});
