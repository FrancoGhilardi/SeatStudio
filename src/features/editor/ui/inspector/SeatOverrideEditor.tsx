"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@store/editor.store";
import { selectSelectedSeat } from "@store/selectors";
import type { SeatOverride } from "@domain/model/seatmap";
import { SectionTitle, FieldLabel, ErrorMsg } from "./shared";

export interface SeatOverrideEditorProps {
  entityId: string;
  kind: "row" | "table";
  seatOverrides: Readonly<Record<number, SeatOverride>>;
  /** Calcula el label actual del asiento (override o derivado de la regla). */
  getLabel: (index: number) => string;
}

/**
 * Editor de override de label para un asiento individual.
 *
 * Escucha el asiento seleccionado en el store y permite sobreescribir su label.
 *
 * SRP: responsable únicamente de la edición de un override de asiento.
 */
export function SeatOverrideEditor({
  entityId,
  kind,
  seatOverrides,
  getLabel,
}: SeatOverrideEditorProps) {
  const dispatch = useEditorStore((s) => s.dispatch);
  const selectedSeat = useEditorStore(selectSelectedSeat);
  const isForThis =
    selectedSeat?.kind === kind && selectedSeat.parentId === entityId;

  const [localLabel, setLocalLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Pre-rellenar con el label actual al cambiar el asiento seleccionado
  useEffect(() => {
    if (isForThis && selectedSeat) {
      setLocalLabel(getLabel(selectedSeat.seatIndex));
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isForThis, selectedSeat?.seatIndex, selectedSeat?.parentId]);

  const commit = () => {
    if (!isForThis || !selectedSeat) return;
    if (!localLabel.trim()) {
      setError("No puede estar vacío");
      return;
    }
    setError(null);
    dispatch({
      type: "SET_SEAT_LABEL_OVERRIDE",
      payload: {
        kind,
        id: entityId,
        seatIndex: selectedSeat.seatIndex,
        label: localLabel.trim(),
      },
    });
  };

  const overrideEntries = (
    Object.entries(seatOverrides) as [string, SeatOverride][]
  ).sort(([a], [b]) => Number(a) - Number(b));

  return (
    <div className="flex flex-col gap-2">
      <SectionTitle>Override de asiento</SectionTitle>

      {isForThis && selectedSeat ? (
        <div className="flex flex-col gap-1.5 rounded border border-amber-700/40 bg-amber-950/20 p-2">
          <p className="text-[0.6rem] text-amber-400">
            Asiento #{selectedSeat.seatIndex + 1}
            {seatOverrides[selectedSeat.seatIndex] !== undefined && (
              <span className="ml-1 rounded bg-amber-700/30 px-1 text-amber-300">
                override activo
              </span>
            )}
          </p>
          <input
            ref={inputRef}
            type="text"
            className={`rounded border bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none transition focus:border-amber-500 ${
              error ? "border-red-500" : "border-zinc-700"
            }`}
            value={localLabel}
            onChange={(e) => setLocalLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
            }}
            onBlur={commit}
            placeholder="Etiqueta del asiento"
          />
          {error && <ErrorMsg msg={error} />}
          <p className="text-[0.6rem] text-zinc-600">
            &ldquo;Aplicar regla&rdquo; borrará todos los overrides.
          </p>
        </div>
      ) : (
        <p className="text-[0.6rem] text-zinc-600">
          Selecciona la entidad y haz clic en un asiento del canvas para editar
          su etiqueta.
        </p>
      )}

      {overrideEntries.length > 0 && (
        <div className="flex flex-col gap-1">
          <FieldLabel>Overrides activos ({overrideEntries.length})</FieldLabel>
          <ul className="flex flex-col gap-0.5 rounded border border-zinc-700 bg-zinc-800/50 p-1.5">
            {overrideEntries.map(([idx, over]) => (
              <li
                key={idx}
                className="flex items-center justify-between text-[0.65rem]"
              >
                <span className="text-zinc-500">#{Number(idx) + 1}</span>
                <span className="font-medium text-amber-300">{over.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
