"use client";

import { useCallback, useRef, useState } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Viewport } from "@store/editor.store";

/**
 * Gestiona el estado y los handlers del pan del canvas.
 *
 * El pan se activa con:
 *  - Botón central del ratón (scroll click).
 *  - Botón izquierdo + Space (cuando `isSpaceDown = true`).
 *
 * SRP: responsable únicamente de la lógica de desplazamiento del viewport.
 *
 * @param viewport     - Viewport actual (zoom + pan).
 * @param setViewport  - Setter parcial del viewport.
 * @param isSpaceDown  - `true` cuando Space está presionado.
 * @param didPan       - Ref compartido con el componente padre; se pone a `true`
 *                       cuando hay movimiento real (inhibe clicks tras arrastre).
 */
export function useCanvasPan(
  viewport: Viewport,
  setViewport: (partial: Partial<Viewport>) => void,
  isSpaceDown: boolean,
  didPan: React.MutableRefObject<boolean>,
): {
  isPanningActive: boolean;
  onMouseDown: (e: KonvaEventObject<MouseEvent>) => boolean;
  onMouseMove: (e: KonvaEventObject<MouseEvent>) => void;
  onMouseUp: () => boolean;
} {
  const [isPanningActive, setIsPanningActive] = useState(false);

  const isPanning = useRef(false);
  const panOrigin = useRef({ x: 0, y: 0 });
  const panStartVp = useRef({ panX: 0, panY: 0 });

  /**
   * Intenta iniciar el pan. Devuelve `true` si lo consume (e.g. es botón central
   * o botón izquierdo + Space), `false` si el evento es para otro handler.
   */
  const onMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>): boolean => {
      const isMiddle = e.evt.button === 1;
      const isSpacePan = e.evt.button === 0 && isSpaceDown;

      if (!isMiddle && !isSpacePan) return false;

      isPanning.current = true;
      setIsPanningActive(true);
      panOrigin.current = { x: e.evt.clientX, y: e.evt.clientY };
      panStartVp.current = { panX: viewport.panX, panY: viewport.panY };
      e.evt.preventDefault();
      return true;
    },
    [isSpaceDown, viewport.panX, viewport.panY],
  );

  /** Aplica el desplazamiento si el pan está activo. */
  const onMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>): void => {
      if (!isPanning.current) return;

      didPan.current = true;
      const dx = e.evt.clientX - panOrigin.current.x;
      const dy = e.evt.clientY - panOrigin.current.y;
      setViewport({
        panX: panStartVp.current.panX + dx,
        panY: panStartVp.current.panY + dy,
      });
    },
    [setViewport, didPan],
  );

  /**
   * Finaliza el pan. Devuelve `true` si estaba en curso (para que el componente
   * padre sepa que el mouseup fue consumido).
   */
  const onMouseUp = useCallback((): boolean => {
    if (!isPanning.current) return false;

    isPanning.current = false;
    setIsPanningActive(false);
    return true;
  }, []);

  return { isPanningActive, onMouseDown, onMouseMove, onMouseUp };
}
