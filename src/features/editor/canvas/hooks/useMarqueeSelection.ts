"use client";

import { useCallback, useRef, useState } from "react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { EntityRef, Row, Table, Area } from "@domain/model/seatmap";
import {
  aabbIntersects,
  rowBBox,
  tableBBox,
  areaBBox,
} from "@domain/services/hitTest";
import type { AABB } from "@domain/services/hitTest";
import type { EditorTool, Viewport } from "@store/editor.store";
import { DRAG_THRESHOLD } from "../constants";

interface ScreenRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Gestiona el rectángulo de selección por arrastre (marquee selection).
 *
 * Solo se activa con el tool `select` y clic izquierdo sobre el fondo vacío.
 * Al soltar el ratón, calcula las entidades intersectadas y llama a `setSelection`.
 *
 * SRP: responsable únicamente de la lógica del marquee (arrastre de selección).
 *
 * @param stageRef   - Ref a la Stage de Konva.
 * @param viewport   - Viewport actual (para convertir pantalla → mundo).
 * @param rows       - Entidades fila actuales.
 * @param tables     - Entidades mesa actuales.
 * @param areas      - Entidades área actuales.
 * @param setSelection - Setter de la selección en el store.
 * @param tool       - Herramienta activa; solo actúa cuando es "select".
 * @param didPan     - Ref compartido; se pone a `true` cuando el arrastre supera el umbral.
 */
export function useMarqueeSelection(
  stageRef: React.RefObject<Konva.Stage | null>,
  viewport: Viewport,
  rows: readonly Row[],
  tables: readonly Table[],
  areas: readonly Area[],
  setSelection: (refs: EntityRef[]) => void,
  tool: EditorTool,
  didPan: React.MutableRefObject<boolean>,
): {
  selectionRect: ScreenRect | null;
  onMouseDown: (e: KonvaEventObject<MouseEvent>) => void;
  onMouseMove: (e: KonvaEventObject<MouseEvent>) => void;
  onMouseUp: () => void;
} {
  const [selectionRect, setSelectionRect] = useState<ScreenRect | null>(null);

  const isSelecting = useRef(false);
  const selectionRectRef = useRef<ScreenRect | null>(null);
  const selectStartScreen = useRef({ x: 0, y: 0 });

  /** Inicia el marquee si corresponde (tool = select, botón izquierdo, clic en fondo). */
  const onMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>): void => {
      if (e.evt.button !== 0 || tool !== "select") return;
      if (e.target !== stageRef.current) return;

      const pointer = stageRef.current?.getPointerPosition();
      if (!pointer) return;

      isSelecting.current = true;
      selectStartScreen.current = { x: pointer.x, y: pointer.y };
      const r: ScreenRect = {
        x1: pointer.x,
        y1: pointer.y,
        x2: pointer.x,
        y2: pointer.y,
      };
      selectionRectRef.current = r;
      setSelectionRect(r);
    },
    [tool, stageRef],
  );

  /** Actualiza el rectángulo mientras se arrastra. */
  const onMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>): void => {
      if (!isSelecting.current) return;

      const pointer = stageRef.current?.getPointerPosition();
      if (!pointer) return;

      const start = selectStartScreen.current;
      const dx = pointer.x - start.x;
      const dy = pointer.y - start.y;

      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        didPan.current = true;
      }

      const r: ScreenRect = {
        x1: start.x,
        y1: start.y,
        x2: pointer.x,
        y2: pointer.y,
      };
      selectionRectRef.current = r;
      setSelectionRect(r);
    },
    [stageRef, didPan],
  );

  /** Finaliza el marquee y aplica la selección si el arrastre fue significativo. */
  const onMouseUp = useCallback((): void => {
    if (!isSelecting.current) return;

    isSelecting.current = false;
    const rect = selectionRectRef.current;
    selectionRectRef.current = null;
    setSelectionRect(null);

    if (!rect) return;

    const dx = Math.abs(rect.x2 - rect.x1);
    const dy = Math.abs(rect.y2 - rect.y1);
    // Por debajo del umbral: tratar como clic simple (handleStageClick lo gestiona)
    if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) return;

    // Convertir rectángulo de pantalla → coordenadas mundo
    const { panX, panY, zoom } = viewport;
    const selAABB: AABB = {
      minX: (Math.min(rect.x1, rect.x2) - panX) / zoom,
      minY: (Math.min(rect.y1, rect.y2) - panY) / zoom,
      maxX: (Math.max(rect.x1, rect.x2) - panX) / zoom,
      maxY: (Math.max(rect.y1, rect.y2) - panY) / zoom,
    };

    const newRefs: EntityRef[] = [];
    for (const row of rows) {
      if (aabbIntersects(rowBBox(row), selAABB))
        newRefs.push({ kind: "row", id: row.id });
    }
    for (const table of tables) {
      if (aabbIntersects(tableBBox(table), selAABB))
        newRefs.push({ kind: "table", id: table.id });
    }
    for (const area of areas) {
      if (aabbIntersects(areaBBox(area), selAABB))
        newRefs.push({ kind: "area", id: area.id });
    }

    setSelection(newRefs);
  }, [viewport, rows, tables, areas, setSelection]);

  return { selectionRect, onMouseDown, onMouseMove, onMouseUp };
}
