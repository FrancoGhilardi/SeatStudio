"use client";

import { useEffect, useRef } from "react";
import { useEditorStore } from "@store/editor.store";
import { selectCanUndo, selectCanRedo } from "@store/selectors";

/**
 * Registra atajos de teclado globales del editor.
 * Debe montarse una única vez, dentro de un componente siempre presente
 * (EditorShell) cuando el mapa ya está listo.
 *
 * Atajos registrados:
 * - Ctrl/Cmd + Z          → undo
 * - Ctrl/Cmd + Y          → redo
 * - Ctrl/Cmd + Shift + Z  → redo (alternativa macOS)
 * - Delete / Backspace    → solicitar borrado de la selección (SelectTool activo)
 * - Escape                → volver a SelectTool y cancelar dibujo en curso
 *
 * Usa refs para que el listener se registre única vez (él dep del efecto es [])
 * y siempre lea los valores más actuales sin re-registrar.
 */
export function useKeyboardShortcuts() {
  const canUndo = useEditorStore(selectCanUndo);
  const canRedo = useEditorStore(selectCanRedo);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const requestDelete = useEditorStore((s) => s.requestDelete);
  const setTool = useEditorStore((s) => s.setTool);

  // Refs para evitar re-registrar el listener cada vez que cambia el estado.
  const canUndoRef = useRef(canUndo);
  const canRedoRef = useRef(canRedo);
  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  const requestDeleteRef = useRef(requestDelete);
  const setToolRef = useRef(setTool);

  // Sincronizar refs en cada render sin trigger del efecto.
  canUndoRef.current = canUndo;
  canRedoRef.current = canRedo;
  undoRef.current = undo;
  redoRef.current = redo;
  requestDeleteRef.current = requestDelete;
  setToolRef.current = setTool;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignorar cuando el foco está en un input/textarea/select/contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndoRef.current) undoRef.current();
        return;
      }

      if (ctrl && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        if (canRedoRef.current) redoRef.current();
        return;
      }

      // Delete / Backspace: solicitar borrado de la selección actual.
      // Sólo cuando la herramienta es "select" (se lee en tiempo real desde el store).
      if (e.key === "Delete" || e.key === "Backspace") {
        const state = useEditorStore.getState();
        if (state.tool === "select" && state.selection.refs.length > 0) {
          e.preventDefault();
          requestDeleteRef.current();
        }
        return;
      }

      // Escape: cancelar herramienta activa y volver a Select.
      if (e.key === "Escape") {
        const { tool } = useEditorStore.getState();
        if (tool !== "select") {
          e.preventDefault();
          setToolRef.current("select");
        }
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []); // Sin deps: los valores se leen desde refs, siempre actualizadas.
}
