"use client";

import { useEffect, useRef } from "react";

export interface ConfirmDialogProps {
  /** Controla si el diálogo está abierto. */
  open: boolean;
  /** Título principal. */
  title: string;
  /** Descripción opcional debajo del título. */
  description?: string;
  /** Texto del botón de confirmación (default: "Confirmar"). */
  confirmLabel?: string;
  /** Variante visual del botón de confirmación. */
  confirmVariant?: "danger" | "primary";
  /** Texto del botón de cancelación (default: "Cancelar"). */
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Diálogo modal de confirmación mínimo viable.
 * Usa el elemento nativo `<dialog>` para accessibilidad y focus-trap out of the box.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  confirmVariant = "primary",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Sincronizar apertura/cierre del <dialog> nativo
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  // Cerrar con Escape nativo redirige a onCancel
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handler = (e: Event) => {
      e.preventDefault();
      onCancel();
    };
    el.addEventListener("cancel", handler);
    return () => el.removeEventListener("cancel", handler);
  }, [onCancel]);

  const confirmCls =
    confirmVariant === "danger"
      ? "bg-red-600 hover:bg-red-500 text-white"
      : "bg-indigo-600 hover:bg-indigo-500 text-white";

  return (
    <dialog
      ref={dialogRef}
      className={[
        "m-auto max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl",
        "text-zinc-100 backdrop:bg-black/60",
        // Reset estilos del UA
        "open:flex open:flex-col open:gap-4",
      ].join(" ")}
    >
      {/* Título */}
      <h2 className="text-base font-semibold leading-snug">{title}</h2>

      {/* Descripción */}
      {description && <p className="text-sm text-zinc-400">{description}</p>}

      {/* Acciones */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-700"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`rounded px-3 py-1.5 text-sm font-medium transition ${confirmCls}`}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
