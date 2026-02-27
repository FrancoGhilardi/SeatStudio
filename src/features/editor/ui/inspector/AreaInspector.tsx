"use client";

import { useEditorStore } from "@store/editor.store";
import type { Area } from "@domain/model/seatmap";
import { SectionTitle, FieldLabel } from "./shared";
import { TextField } from "./fields/TextField";
import { NumberField } from "./fields/NumberField";

/**
 * Inspector de propiedades de un área poligonal.
 *
 * SRP: orquesta los sub-formularios de Area y despacha los comandos correspondientes.
 */
export function AreaInspector({ area }: { area: Area }) {
  const dispatch = useEditorStore((s) => s.dispatch);

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Área</SectionTitle>

      <TextField
        label="Etiqueta"
        value={area.label}
        onCommit={(label) =>
          dispatch({
            type: "SET_ENTITY_LABEL",
            payload: { kind: "area", id: area.id, label },
          })
        }
        validate={(v) =>
          !v.trim() ? "La etiqueta no puede estar vacía" : null
        }
      />

      <NumberField
        label="Capacidad"
        value={area.capacity}
        onCommit={(capacity) =>
          dispatch({
            type: "UPDATE_AREA_CAPACITY",
            payload: { id: area.id, capacity },
          })
        }
        min={0}
      />

      <div>
        <FieldLabel>Vértices</FieldLabel>
        <p className="mt-0.5 tabular-nums text-xs text-zinc-400">
          {area.points.length}
        </p>
      </div>
    </div>
  );
}
