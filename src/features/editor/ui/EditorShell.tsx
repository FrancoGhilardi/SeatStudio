"use client";

import { useBootstrap } from "@store/useBootstrap";
import { TopBar } from "@features/editor/ui/TopBar";
import { LeftToolbar } from "@features/editor/ui/LeftToolbar";
import { InspectorPanel } from "@features/editor/ui/InspectorPanel";
import { CanvasStage } from "@features/editor/canvas/CanvasStage";
import { ToastProvider } from "@features/editor/ui/Toast";
import { useKeyboardShortcuts } from "@features/editor/ui/useKeyboardShortcuts";

export function EditorShell() {
  const { status, error } = useBootstrap();

  if (status === "loading") {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950">
        <p className="text-sm text-zinc-400">Cargando mapa…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-zinc-950">
        <p className="text-sm font-medium text-red-400">Error al inicializar</p>
        <p className="max-w-md text-center text-xs text-zinc-500">{error}</p>
      </div>
    );
  }

  return (
    <ToastProvider>
      <EditorLayout />
    </ToastProvider>
  );
}

/**
 * Layout interno del editor.
 * Separado de EditorShell para poder usar hooks (useKeyboardShortcuts)
 * solo cuando el mapa ya está listo (status === "ready").
 */
function EditorLayout() {
  useKeyboardShortcuts();

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      {/* ── Barra superior ── */}
      <TopBar />

      {/* ── Área de trabajo ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Toolbar izquierda */}
        <LeftToolbar />

        {/* Canvas central */}
        <main className="relative flex-1 overflow-hidden">
          <CanvasStage />
        </main>

        {/* Panel inspector derecho */}
        <InspectorPanel />
      </div>
    </div>
  );
}
