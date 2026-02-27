"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Line, Rect, Group } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@store/editor.store";
import {
  selectRowList,
  selectTableList,
  selectAreaList,
  selectSelectionRefs,
  selectTool,
  selectViewport,
} from "@store/selectors";
import { RowRenderer } from "./RowRenderer";
import { TableRenderer } from "./TableRenderer";
import { AreaRenderer } from "./AreaRenderer";

/** Tamaño de celda de la grilla en coordenadas mundo (px). */
const GRID_SIZE = 40;
/** Color de línea principal de la grilla. */
const GRID_COLOR_MINOR = "#27272a"; // zinc-800
/** Límites de zoom permitidos. */
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
/** Factor de escala por tick de rueda. */
const ZOOM_SENSITIVITY = 1.08;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

interface GridLayerProps {
  /** Ancho de la Stage en pantalla. */
  stageWidth: number;
  /** Alto de la Stage en pantalla. */
  stageHeight: number;
  zoom: number;
  panX: number;
  panY: number;
}

/**
 * Renderiza una grilla de puntos/líneas en coordenadas mundo.
 * Se dibuja en el layer base, **antes** del group de contenido.
 * Las líneas se alinean siempre a múltiplos de GRID_SIZE.
 */
const GridLines = memo(function GridLines({
  stageWidth,
  stageHeight,
  zoom,
  panX,
  panY,
}: GridLayerProps) {
  // Transformamos las esquinas de la pantalla a coordenadas mundo
  const worldLeft = -panX / zoom;
  const worldTop = -panY / zoom;
  const worldRight = worldLeft + stageWidth / zoom;
  const worldBottom = worldTop + stageHeight / zoom;

  const startX = Math.floor(worldLeft / GRID_SIZE) * GRID_SIZE;
  const startY = Math.floor(worldTop / GRID_SIZE) * GRID_SIZE;

  const verticals: number[] = [];
  for (let x = startX; x <= worldRight; x += GRID_SIZE) {
    verticals.push(x);
  }

  const horizontals: number[] = [];
  for (let y = startY; y <= worldBottom; y += GRID_SIZE) {
    horizontals.push(y);
  }

  return (
    <>
      {verticals.map((x) => (
        <Line
          key={`v-${x}`}
          points={[x, worldTop, x, worldBottom]}
          stroke={GRID_COLOR_MINOR}
          strokeWidth={1 / zoom}
          listening={false}
          perfectDrawEnabled={false}
        />
      ))}
      {horizontals.map((y) => (
        <Line
          key={`h-${y}`}
          points={[worldLeft, y, worldRight, y]}
          stroke={GRID_COLOR_MINOR}
          strokeWidth={1 / zoom}
          listening={false}
          perfectDrawEnabled={false}
        />
      ))}
    </>
  );
});

export function CanvasStage() {
  const tool = useEditorStore(selectTool);
  const viewport = useEditorStore(selectViewport);
  const setViewport = useEditorStore((s) => s.setViewport);

  // ── entidades ──
  const rows = useEditorStore(useShallow(selectRowList));
  const tables = useEditorStore(useShallow(selectTableList));
  const areas = useEditorStore(useShallow(selectAreaList));

  // ── selección (conjuntos de ids por kind) ──
  const selectionRefs = useEditorStore(useShallow(selectSelectionRefs));
  const selectedRowIds = useMemo(
    () =>
      new Set(selectionRefs.filter((r) => r.kind === "row").map((r) => r.id)),
    [selectionRefs],
  );
  const selectedTableIds = useMemo(
    () =>
      new Set(selectionRefs.filter((r) => r.kind === "table").map((r) => r.id)),
    [selectionRefs],
  );
  const selectedAreaIds = useMemo(
    () =>
      new Set(selectionRefs.filter((r) => r.kind === "area").map((r) => r.id)),
    [selectionRefs],
  );

  // ── Space key + estado de panning (para cursor dinámico) ──
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const [isPanningActive, setIsPanningActive] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const setStageSize = useEditorStore((s) => s.setStageSize);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // ── redimensionar Stage al contenedor ──
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
    // inicializar con tamaño actual
    setSize({ width: el.clientWidth, height: el.clientHeight });
    setStageSize({ width: el.clientWidth, height: el.clientHeight });

    return () => ro.disconnect();
  }, []);

  // ── Space key: cursor grab para pan ──
  useEffect(() => {
    const isEditable = (t: EventTarget | null): boolean => {
      if (!(t instanceof HTMLElement)) return false;
      return (
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.tagName === "SELECT" ||
        t.isContentEditable
      );
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && !isEditable(e.target)) {
        e.preventDefault();
        setIsSpaceDown(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpaceDown(false);
        setIsPanningActive(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // ── zoom centrado en el cursor (rueda) ──
  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();

      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const direction = e.evt.deltaY < 0 ? 1 : -1;
      const factor = direction > 0 ? ZOOM_SENSITIVITY : 1 / ZOOM_SENSITIVITY;
      const newZoom = clamp(viewport.zoom * factor, MIN_ZOOM, MAX_ZOOM);

      // Ajustar pan para que el punto bajo el cursor no se mueva
      const mousePointTo = {
        x: (pointer.x - viewport.panX) / viewport.zoom,
        y: (pointer.y - viewport.panY) / viewport.zoom,
      };
      const newPanX = pointer.x - mousePointTo.x * newZoom;
      const newPanY = pointer.y - mousePointTo.y * newZoom;

      setViewport({ zoom: newZoom, panX: newPanX, panY: newPanY });
    },
    [viewport, setViewport],
  );

  // ── estado de pan por drag del fondo ──
  const isPanning = useRef(false);
  const panOrigin = useRef({ x: 0, y: 0 });
  const panStartVp = useRef({ panX: 0, panY: 0 });

  const handleBgMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // Pan: botón central siempre, o Espacio+clic izquierdo
      const isMiddle = e.evt.button === 1;
      const isSpacePan = e.evt.button === 0 && isSpaceDown;
      if (!isMiddle && !isSpacePan) return;

      isPanning.current = true;
      setIsPanningActive(true);
      panOrigin.current = { x: e.evt.clientX, y: e.evt.clientY };
      panStartVp.current = { panX: viewport.panX, panY: viewport.panY };
      e.evt.preventDefault();
    },
    [isSpaceDown, viewport.panX, viewport.panY],
  );

  const handleBgMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (!isPanning.current) return;
      const dx = e.evt.clientX - panOrigin.current.x;
      const dy = e.evt.clientY - panOrigin.current.y;
      setViewport({
        panX: panStartVp.current.panX + dx,
        panY: panStartVp.current.panY + dy,
      });
    },
    [setViewport],
  );

  const handleBgMouseUp = useCallback(() => {
    isPanning.current = false;
    setIsPanningActive(false);
  }, []);

  const { zoom, panX, panY } = viewport;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-zinc-950"
      style={{
        cursor: isPanningActive
          ? "grabbing"
          : isSpaceDown
            ? "grab"
            : tool === "select"
              ? "default"
              : "crosshair",
      }}
    >
      {size.width > 0 && size.height > 0 && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          onWheel={handleWheel}
          onMouseDown={handleBgMouseDown}
          onMouseMove={handleBgMouseMove}
          onMouseUp={handleBgMouseUp}
        >
          {/* ── capa base: grilla + fondo ── */}
          <Layer listening={false}>
            {/* fondo sólido para capturar eventos de wheel */}
            <Rect
              x={0}
              y={0}
              width={size.width}
              height={size.height}
              fill="#09090b" /* zinc-950 */
              listening={false}
            />
            <Group x={panX} y={panY} scaleX={zoom} scaleY={zoom}>
              <GridLines
                stageWidth={size.width}
                stageHeight={size.height}
                zoom={zoom}
                panX={panX}
                panY={panY}
              />
            </Group>
          </Layer>

          {/* ── capa de entidades ── */}
          <Layer>
            <Group x={panX} y={panY} scaleX={zoom} scaleY={zoom}>
              {/* Áreas primero (fondo) */}
              {areas.map((area) => (
                <AreaRenderer
                  key={area.id}
                  area={area}
                  selected={selectedAreaIds.has(area.id)}
                />
              ))}

              {/* Filas */}
              {rows.map((row) => (
                <RowRenderer
                  key={row.id}
                  row={row}
                  selected={selectedRowIds.has(row.id)}
                />
              ))}

              {/* Mesas */}
              {tables.map((table) => (
                <TableRenderer
                  key={table.id}
                  table={table}
                  selected={selectedTableIds.has(table.id)}
                />
              ))}
            </Group>
          </Layer>
        </Stage>
      )}
    </div>
  );
}
