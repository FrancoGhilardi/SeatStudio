"use client";

import { useRef, useState } from "react";
import { useEditorStore } from "@store/editor.store";
import {
  selectCanUndo,
  selectCanRedo,
  selectZoom,
  selectAutosaveStatus,
  selectMap,
} from "@store/selectors";
import { importMap, exportMap } from "@application/usecases/io";
import { ConfirmDialog } from "@features/editor/ui/ConfirmDialog";
import { useToast } from "@features/editor/ui/Toast";
import { API_ROUTES } from "@shared/index";
import type { AutosaveStatus } from "@store/editor.store";

const SAVE_BADGE_CLS: Record<AutosaveStatus, string> = {
  idle: "text-zinc-500",
  pending: "text-amber-400",
  saved: "text-emerald-400",
  error: "text-red-400",
};

const SAVE_LABEL: Record<AutosaveStatus, string> = {
  idle: "",
  pending: "Guardando…",
  saved: "Guardado",
  error: "Error al guardar",
};

function IconNew() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="2"
        width="7"
        height="9"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M7 2v3h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 11h4M12 9v4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconImport() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 10v3h10v-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 2v7m-3-3 3 3 3-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconExport() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 10v3h10v-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 9V2m-3 3 3-3 3 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconUndo() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 7a5 5 0 1 1 1.5 5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M3 3v4h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRedo() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M13 7a5 5 0 1 0-1.5 5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M13 3v4H9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconFit() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      {/* esquinas apuntando hacia adentro */}
      <path
        d="M1 5V1h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 5V1h-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M1 11v4h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 11v4h-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TopBar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newMapDialogOpen, setNewMapDialogOpen] = useState(false);

  const { toast } = useToast();

  const canUndo = useEditorStore(selectCanUndo);
  const canRedo = useEditorStore(selectCanRedo);
  const zoom = useEditorStore(selectZoom);
  const autosaveStatus = useEditorStore(selectAutosaveStatus);
  const map = useEditorStore(selectMap);

  const dispatch = useEditorStore((s) => s.dispatch);
  const initMap = useEditorStore((s) => s.initMap);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const setViewport = useEditorStore((s) => s.setViewport);
  const fitViewport = useEditorStore((s) => s.fitViewport);

  function handleNew() {
    setNewMapDialogOpen(true);
  }

  async function confirmNew() {
    setNewMapDialogOpen(false);
    try {
      const res = await fetch(API_ROUTES.seatmapNew, { method: "POST" });
      if (!res.ok) throw new Error(`Error ${res.status.toString()}`);
      const body = (await res.json()) as { map: unknown };
      const result = importMap(body.map);
      if (!result.ok) {
        toast(result.errors.map((e) => e.message).join(" · "), "error");
        return;
      }
      initMap(result.value);
      toast("Mapa nuevo creado", "success");
    } catch (err) {
      toast(`No se pudo crear el mapa: ${String(err)}`, "error");
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const raw: unknown = JSON.parse(text);

      // IMPORT_MAP valida con Zod internamente; dispatch retorna los errores.
      const errors = dispatch({ type: "IMPORT_MAP", payload: { json: raw } });
      if (errors.length > 0) {
        toast(
          `Import fallido: ${errors.map((er) => er.message).join(" · ")}`,
          "error",
        );
        return;
      }

      // Persistencia inmediata: flush explícito al repo sin esperar el debounce
      // del autosave. Garantiza que si el usuario cierra la pestaña antes de
      // que el timer de 1.5s expire, el mapa importado ya quedó guardado en DB.
      const saveRes = await fetch(API_ROUTES.seatmapActive, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      if (!saveRes.ok) {
        toast("Mapa importado pero no persistido (error al guardar)", "error");
        return;
      }

      toast("Mapa importado correctamente", "success");
    } catch (err) {
      toast(`No se pudo importar: ${String(err)}`, "error");
    } finally {
      e.target.value = "";
    }
  }

  function handleExport() {
    if (!map) return;

    const result = exportMap(map);
    if (!result.ok) {
      toast(
        `Export bloqueado: ${result.errors.map((e) => e.message).join(" · ")}`,
        "error",
      );
      return;
    }

    const blob = new Blob([result.value.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${map.meta.name.replace(/\s+/g, "_")}.seatmap.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Mapa exportado", "success");
  }

  function handleZoomIn() {
    setViewport({ zoom: Math.min(zoom * 1.25, 8) });
  }
  function handleZoomOut() {
    setViewport({ zoom: Math.max(zoom / 1.25, 0.1) });
  }
  function handleZoomReset() {
    setViewport({ zoom: 1, panX: 0, panY: 0 });
  }
  function handleFitView() {
    fitViewport();
  }

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-1.5 border-b border-zinc-800 bg-zinc-900 px-3">
        {/* Logo / título */}
        <span className="mr-3 text-sm font-semibold tracking-tight text-zinc-100">
          SeatStudio
        </span>

        {/* Separador */}
        <div className="h-5 w-px bg-zinc-700" />

        {/* Acciones de mapa */}
        <ToolbarButton onClick={handleNew} title="Nuevo mapa">
          <IconNew />
          <span>Nuevo</span>
        </ToolbarButton>

        <ToolbarButton onClick={handleImportClick} title="Importar JSON">
          <IconImport />
          <span>Importar</span>
        </ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleFileChange}
        />

        <ToolbarButton
          onClick={handleExport}
          title="Exportar JSON"
          disabled={!map}
        >
          <IconExport />
          <span>Exportar</span>
        </ToolbarButton>

        {/* Separador */}
        <div className="h-5 w-px bg-zinc-700" />

        {/* Undo / Redo */}
        <ToolbarButton
          onClick={undo}
          disabled={!canUndo}
          title="Deshacer (Ctrl+Z)"
        >
          <IconUndo />
        </ToolbarButton>
        <ToolbarButton
          onClick={redo}
          disabled={!canRedo}
          title="Rehacer (Ctrl+Y)"
        >
          <IconRedo />
        </ToolbarButton>

        {/* Separador */}
        <div className="h-5 w-px bg-zinc-700" />

        {/* Zoom */}
        <ToolbarButton onClick={handleZoomOut} title="Alejar">
          <span className="text-base leading-none">−</span>
        </ToolbarButton>
        <button
          onClick={handleZoomReset}
          title="Restablecer zoom (100%)"
          className="min-w-18 rounded px-2 py-1 text-center text-xs tabular-nums text-zinc-300 transition hover:bg-zinc-700"
        >
          {Math.round(zoom * 100)}%
        </button>
        <ToolbarButton onClick={handleZoomIn} title="Acercar">
          <span className="text-base leading-none">+</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={handleFitView}
          title="Ajustar vista al contenido"
        >
          <IconFit />
        </ToolbarButton>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Autosave status */}
        {autosaveStatus !== "idle" && (
          <span className={`text-xs ${SAVE_BADGE_CLS[autosaveStatus]}`}>
            {SAVE_LABEL[autosaveStatus]}
          </span>
        )}
      </header>

      {/* Diálogo confirmación "Nuevo mapa" */}
      <ConfirmDialog
        open={newMapDialogOpen}
        title="¿Crear un mapa nuevo?"
        description="Se perderán los cambios no guardados. Esta acción no se puede deshacer."
        confirmLabel="Crear nuevo"
        confirmVariant="danger"
        onConfirm={() => void confirmNew()}
        onCancel={() => setNewMapDialogOpen(false)}
      />
    </>
  );
}

interface ToolbarButtonProps {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  disabled = false,
  title,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-zinc-300 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}
