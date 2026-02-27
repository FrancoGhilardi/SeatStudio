"use client";

import { memo } from "react";
import { Circle, Group, Line, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Row } from "@domain/model/seatmap";
import { getRowSeatPosition } from "@domain/services/geometry";
import { getRowSeatLabel } from "@domain/services/labeling";
import { midpoint } from "@domain/services/geometry";

const SEAT_FILL = "#3f3f46"; // zinc-700
const SEAT_STROKE = "#71717a"; // zinc-500
const SEAT_LABEL_COLOR = "#d4d4d8"; // zinc-300
const ROW_LINE_COLOR = "#52525b"; // zinc-600
const ROW_LABEL_COLOR = "#a1a1aa"; // zinc-400

const SEAT_FONT_SIZE = 9; // world-px
const ROW_LABEL_FONT_SIZE = 11; // world-px

interface RowRendererProps {
  row: Row;
  /** Si la fila está seleccionada, resalta con otro color. */
  selected?: boolean;
  /** Callback invocado cuando el usuario hace clic sobre la fila. */
  onClick?: (e: KonvaEventObject<MouseEvent>) => void;
  /** Índice 0-based del asiento seleccionado individualmente (óptimo). */
  selectedSeatIndex?: number | null;
  /** Callback invocado cuando el usuario hace clic sobre un asiento. */
  onSeatClick?: (index: number, e: KonvaEventObject<MouseEvent>) => void;
}

/**
 * Dibuja una fila recta:
 *  - Línea tenue start → end
 *  - Círculo por cada asiento con su label centrado
 *  - Label de fila sobre el punto medio, desplazado hacia arriba
 */
export const RowRenderer = memo(function RowRenderer({
  row,
  selected = false,
  onClick,
  selectedSeatIndex = null,
  onSeatClick,
}: RowRendererProps) {
  const seatFill = selected ? "#4f46e5" : SEAT_FILL; // indigo-600 si seleccionado
  const seatStroke = selected ? "#818cf8" : SEAT_STROKE; // indigo-400

  const mid = midpoint(row.start, row.end);

  // Vector perpendicular (normalizado) para desplazar el label de fila
  const dx = row.end.x - row.start.x;
  const dy = row.end.y - row.start.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const perpX = -dy / len;
  const perpY = dx / len;
  const labelOffset = row.seatRadius + 10;

  return (
    <Group {...(onClick !== undefined ? { onClick } : {})}>
      {/* Línea de la fila (visible, sin eventos) */}
      <Line
        points={[row.start.x, row.start.y, row.end.x, row.end.y]}
        stroke={ROW_LINE_COLOR}
        strokeWidth={1}
        dash={[4, 4]}
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* Zona de hit transparente sobre la línea completa de la fila */}
      <Line
        points={[row.start.x, row.start.y, row.end.x, row.end.y]}
        stroke="transparent"
        strokeWidth={row.seatRadius * 2 + 8}
        hitStrokeWidth={row.seatRadius * 2 + 8}
        perfectDrawEnabled={false}
      />

      {/* Asientos */}
      {Array.from({ length: row.seatCount }, (_, i) => {
        const pos = getRowSeatPosition(row, i);
        const label = getRowSeatLabel(row, i);
        const isSeatSelected = selectedSeatIndex === i;
        const fill = isSeatSelected ? "#f59e0b" : seatFill; // amber-400 si asiento activo
        const stroke = isSeatSelected ? "#fbbf24" : seatStroke;
        return (
          <Group
            key={i}
            x={pos.x}
            y={pos.y}
            {...(onSeatClick
              ? {
                  onClick: (e: KonvaEventObject<MouseEvent>) => {
                    e.cancelBubble = true;
                    onSeatClick(i, e);
                  },
                }
              : {})}
          >
            <Circle
              radius={row.seatRadius}
              fill={fill}
              stroke={stroke}
              strokeWidth={isSeatSelected ? 2 : 1}
              perfectDrawEnabled={false}
            />
            <Text
              text={label}
              fontSize={SEAT_FONT_SIZE}
              fill={SEAT_LABEL_COLOR}
              align="center"
              verticalAlign="middle"
              offsetX={row.seatRadius}
              offsetY={row.seatRadius}
              width={row.seatRadius * 2}
              height={row.seatRadius * 2}
              listening={false}
              perfectDrawEnabled={false}
            />
          </Group>
        );
      })}

      {/* Label de fila — sobre el punto medio, perpendicular a la dirección */}
      <Text
        x={mid.x + perpX * labelOffset}
        y={mid.y + perpY * labelOffset}
        text={row.label}
        fontSize={ROW_LABEL_FONT_SIZE}
        fill={ROW_LABEL_COLOR}
        align="center"
        offsetX={40} /* aprox centrado; se ajusta con width */
        width={80}
        fontStyle="bold"
        listening={false}
        perfectDrawEnabled={false}
      />
    </Group>
  );
});
