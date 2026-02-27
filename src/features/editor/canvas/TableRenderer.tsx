"use client";

import { memo } from "react";
import { Circle, Group, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Table } from "@domain/model/seatmap";
import { getTableSeatPosition } from "@domain/services/geometry";
import { getTableSeatLabel } from "@domain/services/labeling";

const TABLE_FILL = "#27272a"; // zinc-800
const TABLE_STROKE = "#71717a"; // zinc-500
const SEAT_FILL = "#3f3f46"; // zinc-700
const SEAT_STROKE = "#71717a"; // zinc-500
const SEAT_LABEL_COLOR = "#d4d4d8"; // zinc-300
const TABLE_LABEL_COLOR = "#e4e4e7"; // zinc-200

const SEAT_FONT_SIZE = 9;
const TABLE_LABEL_FONT_SIZE = 12;

interface TableRendererProps {
  table: Table;
  selected?: boolean;
  /** Callback invocado cuando el usuario hace clic sobre la mesa. */
  onClick?: (e: KonvaEventObject<MouseEvent>) => void;
  /** Índice 0-based del asiento seleccionado individualmente (opcional). */
  selectedSeatIndex?: number | null;
  /** Callback invocado cuando el usuario hace clic sobre un asiento perimetral. */
  onSeatClick?: (index: number, e: KonvaEventObject<MouseEvent>) => void;
}

/**
 * Dibuja una mesa circular:
 *  - Círculo relleno (mesa)
 *  - Label de mesa centrado
 *  - Asientos en la periferia, cada uno con su label
 */
export const TableRenderer = memo(function TableRenderer({
  table,
  selected = false,
  onClick,
  selectedSeatIndex = null,
  onSeatClick,
}: TableRendererProps) {
  const tableFill = selected ? "#312e81" : TABLE_FILL; // indigo-950 si seleccionado
  const tableStroke = selected ? "#818cf8" : TABLE_STROKE; // indigo-400
  const seatFill = selected ? "#4f46e5" : SEAT_FILL;
  const seatStroke = selected ? "#818cf8" : SEAT_STROKE;

  return (
    <Group
      x={table.center.x}
      y={table.center.y}
      {...(onClick !== undefined ? { onClick } : {})}
    >
      {/* Disco de la mesa — actúa como zona de hit */}
      <Circle
        radius={table.radius}
        fill={tableFill}
        stroke={tableStroke}
        strokeWidth={2}
        perfectDrawEnabled={false}
      />

      {/* Label de la mesa — centrado en el disco */}
      <Text
        text={table.label}
        fontSize={TABLE_LABEL_FONT_SIZE}
        fill={TABLE_LABEL_COLOR}
        align="center"
        verticalAlign="middle"
        offsetX={table.radius}
        offsetY={table.radius}
        width={table.radius * 2}
        height={table.radius * 2}
        fontStyle="bold"
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* Asientos perimetrales */}
      {Array.from({ length: table.seatCount }, (_, i) => {
        const pos = getTableSeatPosition(table, i);
        const label = getTableSeatLabel(table, i);
        // pos está en coordenadas mundo; restamos el center porque el Group ya lo aplica
        const lx = pos.x - table.center.x;
        const ly = pos.y - table.center.y;
        const isSeatSelected = selectedSeatIndex === i;
        const fill = isSeatSelected ? "#f59e0b" : seatFill; // amber-400 si asiento activo
        const stroke = isSeatSelected ? "#fbbf24" : seatStroke;
        return (
          <Group
            key={i}
            x={lx}
            y={ly}
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
              radius={table.seatRadius}
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
              offsetX={table.seatRadius}
              offsetY={table.seatRadius}
              width={table.seatRadius * 2}
              height={table.seatRadius * 2}
              listening={false}
              perfectDrawEnabled={false}
            />
          </Group>
        );
      })}
    </Group>
  );
});
