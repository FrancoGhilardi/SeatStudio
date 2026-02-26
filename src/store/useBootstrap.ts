"use client";

import { useEffect, useState } from "react";
import { importMap } from "@application/usecases/io";
import { useEditorStore } from "@store/editor.store";

export type BootstrapStatus = "loading" | "ready" | "error";

export interface BootstrapState {
  /** Estado de la inicialización. */
  status: BootstrapStatus;
  /** Mensaje de error legible cuando `status === "error"`. */
  error: string | null;
}

export function useBootstrap(): BootstrapState {
  const [state, setState] = useState<BootstrapState>({
    status: "loading",
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function bootstrap(): Promise<void> {
      // Acceder a initMap vía getState() en lugar de suscribirse:
      // las acciones de Zustand son referencias estables, pero getState()
      // evita que el efecto dependa de ellas y elimina la necesidad de
      // incluirlas en el array de deps (o de suprimir el lint).
      const { initMap } = useEditorStore.getState();

      try {
        // ── Paso 1: intentar cargar el mapa activo ────────────────────────────
        const activeRes = await fetch("/api/seatmap/active");
        if (!activeRes.ok) {
          throw new Error(
            `GET /api/seatmap/active respondió ${activeRes.status.toString()}`,
          );
        }

        const activeBody = (await activeRes.json()) as { map: unknown };

        if (activeBody.map !== null && activeBody.map !== undefined) {
          // ── Caso A: hay mapa guardado ─────────────────────────────────────
          const result = importMap(activeBody.map);
          if (!result.ok) {
            throw new Error(result.errors.map((e) => e.message).join("; "));
          }
          if (!cancelled) {
            initMap(result.value);
            setState({ status: "ready", error: null });
          }
          return;
        }

        // ── Paso 2: no hay mapa activo → crear uno vacío ──────────────────────
        const newRes = await fetch("/api/seatmap/new", { method: "POST" });
        if (!newRes.ok) {
          throw new Error(
            `POST /api/seatmap/new respondió ${newRes.status.toString()}`,
          );
        }

        const newBody = (await newRes.json()) as { map: unknown };
        const result = importMap(newBody.map);
        if (!result.ok) {
          throw new Error(result.errors.map((e) => e.message).join("; "));
        }

        if (!cancelled) {
          initMap(result.value);
          setState({ status: "ready", error: null });
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          setState({ status: "error", error: message });
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []); // Sin deps: getState() lee el estado actual sin suscripción

  return state;
}
