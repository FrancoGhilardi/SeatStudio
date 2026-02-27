"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Line, Rect, Group, Circle } from "react-konva";
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
  selectSelectedSeat,
} from "@store/selectors";
import type { EntityRef, EntityKind } from "@domain/model/seatmap";
import {
  aabbIntersects,
  rowBBox,
  tableBBox,
  areaBBox,
} from "@domain/services/hitTest";
import type { AABB } from "@domain/services/hitTest";
import { TOOL_REGISTRY } from "@features/editor/tools";
import type { DrawingState } from "@features/editor/tools";
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
/** Desplazamiento mínimo en px para considerar que el drag fue intencional. */
const SEL_THRESHOLD = 5;

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

interface AreaPreviewProps {
  points: readonly { x: number; y: number }[];
  cursor: { x: number; y: number };
}

/**
 * Vista previa del polígono en construcción (CreateAreaTool):
 *  - Líneas entre vértices colocados.
 *  - Línea desde último vértice hasta el cursor (punteada).
 *  - Cierre tentativo cursor → primer vértice (si ≥ 2 vértices).
 *  - Círculos en cada vértice.
 */
const AreaPreview = memo(function AreaPreview({
  points,
  cursor,
}: AreaPreviewProps) {
  const last = points[points.length - 1]!;
  const first = points[0]!;
  const flatPoints = points.flatMap((p) => [p.x, p.y]);

  return (
    <>
      {points.length > 1 && (
        <Line
          points={flatPoints}
          stroke="#6366f1"
          strokeWidth={1.5}
          closed={false}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
      <Line
        points={[last.x, last.y, cursor.x, cursor.y]}
        stroke="#6366f1"
        strokeWidth={1}
        dash={[5, 3]}
        listening={false}
        perfectDrawEnabled={false}
      />
      {points.length >= 2 && (
        <Line
          points={[cursor.x, cursor.y, first.x, first.y]}
          stroke="#6366f1"
          strokeWidth={1}
          dash={[3, 4]}
          opacity={0.4}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
      {points.map((p) => (
        <Circle
          key={`${p.x}-${p.y}`}
          x={p.x}
          y={p.y}
          radius={4}
          fill="#818cf8"
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

  // ── acciones del store ──
  const storeDispatch = useEditorStore((s) => s.dispatch);
  const setSelection = useEditorStore((s) => s.setSelection);
  const addToSelection = useEditorStore((s) => s.addToSelection);
  const removeFromSelection = useEditorStore((s) => s.removeFromSelection);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const storeSetTool = useEditorStore((s) => s.setTool);
  const selectedSeat = useEditorStore(selectSelectedSeat);
  const storeSeatSelect = useEditorStore((s) => s.selectSeat);

  // ── estado de dibujo (transitorio, no es dominio) ──
  const [drawingState, setDrawingState] = useState<DrawingState>({
    kind: "idle",
  });
  // Resetear drawingState al cambiar de tool (p.ej. Escape → select)
  useEffect(() => {
    setDrawingState({ kind: "idle" });
  }, [tool]);
  /** Posición del cursor en coordenadas mundo; se actualiza en mousemove. */
  const [previewPos, setPreviewPos] = useState({ x: 0, y: 0 });
  /** `true` si el puntero se movió significativamente desde el last mousedown (evita clicks fantasma tras pan). */
  const didPan = useRef(false);

  // ── estado del rectángulo de selección (marquee) ──
  /** Coordenadas de pantalla del rectángulo de selección activo (`null` = ninguno). */
  const [selectionRect, setSelectionRect] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  /** Ref espejo del estado para lectura sin clausura obsoleta. */
  const selectionRectRef = useRef<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  /** `true` mientras hay un arrastre de selección activo. */
  const isSelecting = useRef(false);
  /** Coordenadas de pantalla donde comenzó el arrastre de selección. */
  const selectStartScreen = useRef({ x: 0, y: 0 });

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

  // ── helpers de coordenadas ──
  /** Convierte la posición actual del puntero (Stage) a coordenadas mundo. */
  const getWorldPos = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const pointer = stage.getPointerPosition();
    if (!pointer) return { x: 0, y: 0 };
    return {
      x: (pointer.x - viewport.panX) / viewport.zoom,
      y: (pointer.y - viewport.panY) / viewport.zoom,
    };
  }, [viewport.panX, viewport.panY, viewport.zoom]);

  // ── constructor de ToolContext (fresco en cada evento) ──
  const buildToolContext = useCallback(
    (worldPos: { x: number; y: number }, isShift: boolean) => ({
      worldPos,
      isShift,
      selectionRefs,
      dispatch: storeDispatch,
      setSelection,
      toggleSelection: (ref: EntityRef) => {
        // Leer estado fresco del store (no del closure) para evitar stale state
        // en secuencias rápidas de shift+click.
        const liveRefs = useEditorStore.getState().selection.refs;
        const exists = liveRefs.some(
          (r) => r.kind === ref.kind && r.id === ref.id,
        );
        if (exists) removeFromSelection([ref]);
        else addToSelection([ref]);
      },
      clearSelection,
      getEntityCount: (kind: EntityKind) => {
        if (kind === "row") return rows.length;
        if (kind === "table") return tables.length;
        return areas.length;
      },
      drawingState,
      setDrawingState,
      setTool: storeSetTool,
    }),
    [
      selectionRefs,
      storeDispatch,
      setSelection,
      addToSelection,
      removeFromSelection,
      clearSelection,
      rows.length,
      tables.length,
      areas.length,
      drawingState,
      storeSetTool,
    ],
  );

  // ── estado de pan por drag del fondo ──
  const isPanning = useRef(false);
  const panOrigin = useRef({ x: 0, y: 0 });
  const panStartVp = useRef({ panX: 0, panY: 0 });

  const handleBgMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const isMiddle = e.evt.button === 1;
      const isSpacePan = e.evt.button === 0 && isSpaceDown;
      didPan.current = false;

      if (isMiddle || isSpacePan) {
        // ─ pan ─
        isPanning.current = true;
        setIsPanningActive(true);
        panOrigin.current = { x: e.evt.clientX, y: e.evt.clientY };
        panStartVp.current = { panX: viewport.panX, panY: viewport.panY };
        e.evt.preventDefault();
        return;
      }

      // ─ rectángulo de selección: clic izquierdo en fondo vacío con SelectTool ─
      if (
        e.evt.button === 0 &&
        !isSpaceDown &&
        tool === "select" &&
        e.target === stageRef.current
      ) {
        const pointer = stageRef.current.getPointerPosition();
        if (pointer) {
          isSelecting.current = true;
          selectStartScreen.current = { x: pointer.x, y: pointer.y };
          const r = {
            x1: pointer.x,
            y1: pointer.y,
            x2: pointer.x,
            y2: pointer.y,
          };
          selectionRectRef.current = r;
          setSelectionRect(r);
        }
      }
    },
    [isSpaceDown, viewport.panX, viewport.panY, tool],
  );

  const handleBgMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // Actualizar posición del cursor en coordenadas mundo (para previews)
      const stage = stageRef.current;
      if (stage) {
        const pointer = stage.getPointerPosition();
        if (pointer) {
          setPreviewPos({
            x: (pointer.x - viewport.panX) / viewport.zoom,
            y: (pointer.y - viewport.panY) / viewport.zoom,
          });
        }
      }

      if (isPanning.current) {
        didPan.current = true;
        const dx = e.evt.clientX - panOrigin.current.x;
        const dy = e.evt.clientY - panOrigin.current.y;
        setViewport({
          panX: panStartVp.current.panX + dx,
          panY: panStartVp.current.panY + dy,
        });
        return;
      }

      // Actualizar rectángulo de selección si hay un arrastre activo
      if (isSelecting.current) {
        const pointer = stageRef.current?.getPointerPosition();
        if (pointer) {
          const start = selectStartScreen.current;
          const dx = pointer.x - start.x;
          const dy = pointer.y - start.y;
          // Si superó el umbral, marcar como arrastre (inhibe el click)
          if (Math.abs(dx) > SEL_THRESHOLD || Math.abs(dy) > SEL_THRESHOLD) {
            didPan.current = true;
          }
          const r = {
            x1: start.x,
            y1: start.y,
            x2: pointer.x,
            y2: pointer.y,
          };
          selectionRectRef.current = r;
          setSelectionRect(r);
        }
      }
    },
    [setViewport, viewport.panX, viewport.panY, viewport.zoom],
  );

  const handleBgMouseUp = useCallback(() => {
    if (isPanning.current) {
      isPanning.current = false;
      setIsPanningActive(false);
      return;
    }

    if (isSelecting.current) {
      isSelecting.current = false;
      const rect = selectionRectRef.current;
      selectionRectRef.current = null;
      setSelectionRect(null);

      if (!rect) return;

      const dx = Math.abs(rect.x2 - rect.x1);
      const dy = Math.abs(rect.y2 - rect.y1);
      // Rect demasiado pequeño: tratar como clic (ya gestionado por handleStageClick)
      if (dx < SEL_THRESHOLD && dy < SEL_THRESHOLD) return;

      // Convertir rect de pantalla a coordenadas mundo
      const { panX, panY, zoom } = viewport;
      const wMinX = (Math.min(rect.x1, rect.x2) - panX) / zoom;
      const wMinY = (Math.min(rect.y1, rect.y2) - panY) / zoom;
      const wMaxX = (Math.max(rect.x1, rect.x2) - panX) / zoom;
      const wMaxY = (Math.max(rect.y1, rect.y2) - panY) / zoom;
      const selAABB: AABB = {
        minX: wMinX,
        minY: wMinY,
        maxX: wMaxX,
        maxY: wMaxY,
      };

      // Hit-test contra todas las entidades del mapa
      const newRefs: EntityRef[] = [];
      for (const row of rows) {
        if (aabbIntersects(rowBBox(row), selAABB)) {
          newRefs.push({ kind: "row", id: row.id });
        }
      }
      for (const table of tables) {
        if (aabbIntersects(tableBBox(table), selAABB)) {
          newRefs.push({ kind: "table", id: table.id });
        }
      }
      for (const area of areas) {
        if (aabbIntersects(areaBBox(area), selAABB)) {
          newRefs.push({ kind: "area", id: area.id });
        }
      }

      setSelection(newRefs);
    }
  }, [rows, tables, areas, viewport, setSelection]);

  // ── clics delegados al tool activo ──
  const handleStageClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // Solo procesar si el objetivo es el Stage (clic en fondo vacío)
      if (e.target !== stageRef.current) return;
      // Ignorar si fue un pan (arrastre)
      if (didPan.current) return;

      const worldPos = getWorldPos();
      const ctx = buildToolContext(worldPos, e.evt.shiftKey);
      TOOL_REGISTRY[tool].onBgClick(ctx, e);
    },
    [tool, buildToolContext, getWorldPos],
  );

  const handleStageDblClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (e.target !== stageRef.current) return;

      const worldPos = getWorldPos();
      const ctx = buildToolContext(worldPos, e.evt.shiftKey);
      const currentTool = TOOL_REGISTRY[tool];
      currentTool.onBgDblClick?.(ctx, e);
    },
    [tool, buildToolContext, getWorldPos],
  );

  // ── handlers de clic sobre entidades ──
  const handleEntityClick = useCallback(
    (ref: EntityRef, e: KonvaEventObject<MouseEvent>) => {
      // Detener propagación para que el Stage no procese el evento como BgClick
      e.cancelBubble = true;
      const worldPos = getWorldPos();
      const ctx = buildToolContext(worldPos, e.evt.shiftKey);
      TOOL_REGISTRY[tool].onEntityClick(ctx, ref, e);
    },
    [tool, buildToolContext, getWorldPos],
  );

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
          onClick={handleStageClick}
          onDblClick={handleStageDblClick}
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
                  onClick={(e) =>
                    handleEntityClick({ kind: "area", id: area.id }, e)
                  }
                />
              ))}

              {/* Filas */}
              {rows.map((row) => {
                const rowIsSelected = selectedRowIds.has(row.id);
                const rowSeatIdx =
                  selectedSeat?.kind === "row" &&
                  selectedSeat.parentId === row.id
                    ? selectedSeat.seatIndex
                    : null;
                return (
                  <RowRenderer
                    key={row.id}
                    row={row}
                    selected={rowIsSelected}
                    onClick={(e) =>
                      handleEntityClick({ kind: "row", id: row.id }, e)
                    }
                    {...(rowSeatIdx !== null
                      ? { selectedSeatIndex: rowSeatIdx }
                      : {})}
                    {...(tool === "select" && rowIsSelected
                      ? {
                          onSeatClick: (index: number) =>
                            storeSeatSelect({
                              kind: "row",
                              parentId: row.id,
                              seatIndex: index,
                            }),
                        }
                      : {})}
                  />
                );
              })}

              {/* Mesas */}
              {tables.map((table) => {
                const tableIsSelected = selectedTableIds.has(table.id);
                const tableSeatIdx =
                  selectedSeat?.kind === "table" &&
                  selectedSeat.parentId === table.id
                    ? selectedSeat.seatIndex
                    : null;
                return (
                  <TableRenderer
                    key={table.id}
                    table={table}
                    selected={tableIsSelected}
                    onClick={(e) =>
                      handleEntityClick({ kind: "table", id: table.id }, e)
                    }
                    {...(tableSeatIdx !== null
                      ? { selectedSeatIndex: tableSeatIdx }
                      : {})}
                    {...(tool === "select" && tableIsSelected
                      ? {
                          onSeatClick: (index: number) =>
                            storeSeatSelect({
                              kind: "table",
                              parentId: table.id,
                              seatIndex: index,
                            }),
                        }
                      : {})}
                  />
                );
              })}
            </Group>
          </Layer>

          {/* ── capa de preview de dibujo en curso ── */}
          <Layer listening={false}>
            <Group x={panX} y={panY} scaleX={zoom} scaleY={zoom}>
              {/* Preview de fila: punto de inicio + línea hacia cursor */}
              {drawingState.kind === "rowFirstPoint" && (
                <>
                  <Circle
                    x={drawingState.start.x}
                    y={drawingState.start.y}
                    radius={5}
                    fill="#818cf8"
                    listening={false}
                    perfectDrawEnabled={false}
                  />
                  <Line
                    points={[
                      drawingState.start.x,
                      drawingState.start.y,
                      previewPos.x,
                      previewPos.y,
                    ]}
                    stroke="#818cf8"
                    strokeWidth={2}
                    dash={[6, 4]}
                    listening={false}
                    perfectDrawEnabled={false}
                  />
                </>
              )}

              {/* Preview de área: polígono en construcción + línea hacia cursor */}
              {drawingState.kind === "areaInProgress" &&
                drawingState.points.length > 0 && (
                  <AreaPreview
                    points={drawingState.points}
                    cursor={previewPos}
                  />
                )}
            </Group>
          </Layer>

          {/* ── capa del rectángulo de selección (marquee) ── */}
          <Layer listening={false}>
            {selectionRect !== null && (
              <Rect
                x={Math.min(selectionRect.x1, selectionRect.x2)}
                y={Math.min(selectionRect.y1, selectionRect.y2)}
                width={Math.abs(selectionRect.x2 - selectionRect.x1)}
                height={Math.abs(selectionRect.y2 - selectionRect.y1)}
                fill="rgba(99,102,241,0.08)"
                stroke="#818cf8"
                strokeWidth={1}
                dash={[4, 3]}
                listening={false}
                perfectDrawEnabled={false}
              />
            )}
          </Layer>
        </Stage>
      )}
    </div>
  );
}
