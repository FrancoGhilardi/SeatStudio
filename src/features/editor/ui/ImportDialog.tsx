"use client";

import { useEffect, useRef, useState } from "react";

export interface ImportDialogProps {
  /** Controla si el diálogo está abierto. */
  open: boolean;
  /**
   * Callback invocado con el texto crudo del JSON cuando el usuario confirma.
   * El caller decide cómo procesarlo (parse, validate, dispatch).
   * Devuelve una Promise para que el dialog pueda mostrar el estado de carga.
   */
  onImport: (rawJson: string) => Promise<void>;
  onCancel: () => void;
}

/**
 * Modal de importación que admite dos flujos:
 *
 * 1. **Pegar JSON** directamente en el textarea.
 * 2. **Cargar archivo** `.json` → el contenido se carga en el textarea.
 *
 * La validación real ocurre en `onImport` (el caller decide); este componente
 * solo gestiona la captura del texto y el estado de carga/error superficial.
 */
export function ImportDialog({ open, onImport, onCancel }: ImportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Abrir/cerrar el <dialog> nativo
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // Reset al abrir
      setValue("");
      setFileError(null);
      setLoading(false);
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  // Escape nativo → onCancel
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handler = (e: Event) => {
      e.preventDefault();
      if (!loading) onCancel();
    };
    el.addEventListener("cancel", handler);
    return () => el.removeEventListener("cancel", handler);
  }, [onCancel, loading]);

  function handleFileButtonClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json") && file.type !== "application/json") {
      setFileError("Solo se aceptan archivos .json");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") {
        setValue(text);
        setFileError(null);
        // Dar foco al textarea para que el usuario pueda revisar el contenido
        textareaRef.current?.focus();
      }
    };
    reader.onerror = () => {
      setFileError("No se pudo leer el archivo.");
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleImport() {
    const trimmed = value.trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      await onImport(trimmed);
      // onImport cierra el dialog si tiene éxito (lo hace el caller vía onCancel)
    } finally {
      setLoading(false);
    }
  }

  const canImport = value.trim().length > 0 && !loading;

  return (
    <dialog
      ref={dialogRef}
      className={[
        "m-auto w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl",
        "text-zinc-100 backdrop:bg-black/60",
        "open:flex open:flex-col open:gap-4",
      ].join(" ")}
    >
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Importar mapa</h2>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="rounded p-1 text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-40"
          aria-label="Cerrar"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M1 1l12 12M13 1L1 13"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Instrucciones */}
      <p className="text-xs text-zinc-400">
        Pegá el JSON del mapa directamente o cargá un archivo{" "}
        <code className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-300">
          .json
        </code>
        .
      </p>

      {/* Botón cargar archivo */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleFileButtonClick}
          disabled={loading}
          className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs text-zinc-300 ring-1 ring-zinc-600 transition hover:bg-zinc-700 disabled:opacity-40"
        >
          <svg
            width="13"
            height="13"
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
          Cargar archivo…
        </button>
        {fileError && <span className="text-xs text-red-400">{fileError}</span>}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={loading}
        spellCheck={false}
        placeholder='{ "schemaVersion": 1, … }'
        rows={10}
        className={[
          "w-full resize-y rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2",
          "font-mono text-xs text-zinc-200 placeholder-zinc-600",
          "focus:outline-none focus:ring-1 focus:ring-indigo-500",
          "disabled:opacity-50",
        ].join(" ")}
      />

      {/* Acciones */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="rounded px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-40"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void handleImport()}
          disabled={!canImport}
          className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Importando…" : "Importar"}
        </button>
      </div>
    </dialog>
  );
}
