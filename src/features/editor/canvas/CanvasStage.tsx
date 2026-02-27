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
  selectCanvasSettings,
} from "@store/selectors";
import type { EntityRef, EntityKind } from "@domain/model/seatmap";
import { TOOL_REGISTRY } from "@features/editor/tools";
import type { DrawingState } from "@features/editor/tools";
import { RowRenderer } from "./RowRenderer";
import { TableRenderer } from "./TableRenderer";
import { AreaRenderer } from "./AreaRenderer";
import { DEFAULT_GRID_SIZE, GRID_COLOR, DRAG_THRESHOLD } from "./constants";
import {
  useStageResize,
  useSpaceKey,
  useWheelZoom,
  useCanvasPan,
  useMarqueeSelection,
} from "./hooks";

interface GridLayerProps {
  /** Ancho de la Stage en pantalla. */
  stageWidth: number;
  /** Alto de la Stage en pantalla. */
  stageHeight: number;
  zoom: number;
  panX: number;
  panY: number;
  /** Tamaño de celda en coordenadas mundo (leído de `map.canvas.grid.size`). */
  gridSize: number;
}

/**
 * Renderiza una grilla de líneas en coordenadas mundo.
 * Se dibuja en el layer base, **antes** del group de contenido.
 * Las líneas se alinean a múltiplos de `gridSize`.
 *
 * Los arrays de coordenadas se memorizan con `useMemo` para evitar
 * re-allocations innecesarias en cada render durante pan/zoom.
 */
const GridLines = memo(function GridLines({
  stageWidth,
  stageHeight,
  zoom,
  panX,
  panY,
  gridSize,
}: GridLayerProps) {
  // Transformamos las esquinas de la pantalla a coordenadas mundo
  const worldLeft = -panX / zoom;
  const worldTop = -panY / zoom;
  const worldRight = worldLeft + stageWidth / zoom;
  const worldBottom = worldTop + stageHeight / zoom;

  const startX = Math.floor(worldLeft / gridSize) * gridSize;
  const startY = Math.floor(worldTop / gridSize) * gridSize;

  // useMemo evita recrear los arrays en cada render del componente memo;
  // solo se recalculan cuando cambian realmente los límites o el gridSize.
  const verticals = useMemo(() => {
    const arr: number[] = [];
    for (let x = startX; x <= worldRight; x += gridSize) arr.push(x);
    return arr;
  }, [startX, worldRight, gridSize]);

  const horizontals = useMemo(() => {
    const arr: number[] = [];
    for (let y = startY; y <= worldBottom; y += gridSize) arr.push(y);
    return arr;
  }, [startY, worldBottom, gridSize]);

  return (
    <>
      {verticals.map((x) => (
        <Line
          key={`v-${x}`}
          points={[x, worldTop, x, worldBottom]}
          stroke={GRID_COLOR}
          strokeWidth={1 / zoom}
          listening={false}
          perfectDrawEnabled={false}
        />
      ))}
      {horizontals.map((y) => (
        <Line
          key={`h-${y}`}
          points={[worldLeft, y, worldRight, y]}
          stroke={GRID_COLOR}
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
  const gridSize =
    useEditorStore(selectCanvasSettings)?.grid.size ?? DEFAULT_GRID_SIZE;

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
  useEffect(() => {
    setDrawingState({ kind: "idle" });
  }, [tool]);

  const [previewPos, setPreviewPos] = useState({ x: 0, y: 0 });

  /**
   * Ref compartido con los hooks de pan y marquee.
   * Se pone a `true` en cuanto hay movimiento significativo para inhibir
   * los handlers de click una vez que el usuario suelta el ratón.
   */
  const didPan = useRef(false);

  // ── refs de la stage ──
  const stageRef = useRef<Konva.Stage>(null);

  // ── hooks de comportamiento del canvas ──
  const { containerRef, size } = useStageResize();
  const isSpaceDown = useSpaceKey();
  const handleWheel = useWheelZoom(stageRef, viewport, setViewport);
  const {
    isPanningActive,
    onMouseDown: panDown,
    onMouseMove: panMove,
    onMouseUp: panUp,
  } = useCanvasPan(viewport, setViewport, isSpaceDown, didPan);
  const {
    selectionRect,
    onMouseDown: marqDown,
    onMouseMove: marqMove,
    onMouseUp: marqUp,
  } = useMarqueeSelection(
    stageRef,
    viewport,
    rows,
    tables,
    areas,
    setSelection,
    tool,
    didPan,
  );

  // ── helpers de coordenadas ──
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

  // ── constructor de ToolContext ──
  const buildToolContext = useCallback(
    (worldPos: { x: number; y: number }, isShift: boolean) => ({
      worldPos,
      isShift,
      selectionRefs,
      dispatch: storeDispatch,
      setSelection,
      toggleSelection: (ref: EntityRef) => {
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

  // ── handlers combinados de la Stage ──
  const handleBgMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      didPan.current = false;
      const consumed = panDown(e);
      if (!consumed) marqDown(e);
    },
    [panDown, marqDown],
  );

  const handleBgMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // Actualizar posición del cursor en coords mundo (previews de dibujo)
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
      panMove(e);
      marqMove(e);
    },
    [panMove, marqMove, viewport.panX, viewport.panY, viewport.zoom],
  );

  const handleBgMouseUp = useCallback(() => {
    const consumed = panUp();
    if (!consumed) marqUp();
  }, [panUp, marqUp]);

  const handleStageClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (e.target !== stageRef.current) return;
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
      TOOL_REGISTRY[tool].onBgDblClick?.(ctx, e);
    },
    [tool, buildToolContext, getWorldPos],
  );

  const handleEntityClick = useCallback(
    (ref: EntityRef, e: KonvaEventObject<MouseEvent>) => {
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
            <Rect
              x={0}
              y={0}
              width={size.width}
              height={size.height}
              fill="#09090b"
              listening={false}
            />
            <Group x={panX} y={panY} scaleX={zoom} scaleY={zoom}>
              <GridLines
                stageWidth={size.width}
                stageHeight={size.height}
                zoom={zoom}
                panX={panX}
                panY={panY}
                gridSize={gridSize}
              />
            </Group>
          </Layer>

          {/* ── capa de entidades ── */}
          <Layer>
            <Group x={panX} y={panY} scaleX={zoom} scaleY={zoom}>
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
