"use client";

import { useCallback } from "react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Viewport } from "@store/editor.store";
import { MIN_ZOOM, MAX_ZOOM, ZOOM_SENSITIVITY } from "../constants";

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Retorna un handler `onWheel` estable para la Stage de Konva que implementa
 * zoom centrado en el cursor.
 *
 * SRP: este hook es el único responsable de la lógica de zoom por rueda.
 *
 * @param stageRef  - Ref a la Stage de Konva.
 * @param viewport  - Estado actual del viewport (zoom + pan).
 * @param setViewport - Setter parcial del viewport.
 */
export function useWheelZoom(
  stageRef: React.RefObject<Konva.Stage | null>,
  viewport: Viewport,
  setViewport: (partial: Partial<Viewport>) => void,
): (e: KonvaEventObject<WheelEvent>) => void {
  return useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();

      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const direction = e.evt.deltaY < 0 ? 1 : -1;
      const factor = direction > 0 ? ZOOM_SENSITIVITY : 1 / ZOOM_SENSITIVITY;
      const newZoom = clamp(viewport.zoom * factor, MIN_ZOOM, MAX_ZOOM);

      // Ajustar pan para que el punto bajo el cursor no se desplace
      const mousePointTo = {
        x: (pointer.x - viewport.panX) / viewport.zoom,
        y: (pointer.y - viewport.panY) / viewport.zoom,
      };

      setViewport({
        zoom: newZoom,
        panX: pointer.x - mousePointTo.x * newZoom,
        panY: pointer.y - mousePointTo.y * newZoom,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewport, setViewport],
  );
}
