"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@store/editor.store";

export interface StageSize {
  width: number;
  height: number;
}

/**
 * Observa el tamaño del contenedor del canvas con un ResizeObserver y mantiene
 * el estado `size` actualizado. También notifica al store para que `fitViewport`
 * tenga las dimensiones correctas.
 *
 * SRP: este hook es el único responsable de la sincronización tamaño-contenedor.
 */
export function useStageResize(): {
  containerRef: React.RefObject<HTMLDivElement | null>;
  size: StageSize;
} {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<StageSize>({ width: 0, height: 0 });
  const setStageSize = useEditorStore((s) => s.setStageSize);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
      setStageSize({ width, height });
    });

    ro.observe(el);
    // Inicializar con el tamaño actual (antes del primer ResizeObserver callback)
    setSize({ width: el.clientWidth, height: el.clientHeight });
    setStageSize({ width: el.clientWidth, height: el.clientHeight });

    return () => ro.disconnect();
    // setStageSize es estable (Zustand); incluirla no provoca ciclos pero tampoco es necesario
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { containerRef, size };
}
