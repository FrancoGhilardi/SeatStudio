"use client";

import { useEditorStore } from "@store/editor.store";
import type { Row } from "@domain/model/seatmap";
import { getRowSeatLabel } from "@domain/services/labeling";
import { SectionTitle, FieldLabel, Divider } from "./shared";
import { TextField } from "./fields/TextField";
import { NumberField } from "./fields/NumberField";
import { LabelRuleEditor } from "./LabelRuleEditor";
import { SeatOverrideEditor } from "./SeatOverrideEditor";

/**
 * Inspector de propiedades de una fila recta.
 *
 * SRP: orquesta los sub-formularios de Row y despacha los comandos correspondientes.
 * No contiene lógica de dominio — valida a través de los sub-componentes.
 */
export function RowInspector({ row }: { row: Row }) {
  const dispatch = useEditorStore((s) => s.dispatch);

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Fila</SectionTitle>

      <TextField
        label="Etiqueta"
        value={row.label}
        onCommit={(label) =>
          dispatch({
            type: "SET_ENTITY_LABEL",
            payload: { kind: "row", id: row.id, label },
          })
        }
        validate={(v) =>
          !v.trim() ? "La etiqueta no puede estar vacía" : null
        }
      />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <FieldLabel>Inicio</FieldLabel>
          <p className="mt-0.5 tabular-nums text-xs text-zinc-400">
            ({Math.round(row.start.x)}, {Math.round(row.start.y)})
          </p>
        </div>
        <div>
          <FieldLabel>Fin</FieldLabel>
          <p className="mt-0.5 tabular-nums text-xs text-zinc-400">
            ({Math.round(row.end.x)}, {Math.round(row.end.y)})
          </p>
        </div>
      </div>

      <Divider />
      <SectionTitle>Asientos</SectionTitle>

      <NumberField
        label="Cantidad"
        value={row.seatCount}
        onCommit={(seatCount) =>
          dispatch({
            type: "UPDATE_ROW_CONFIG",
            payload: { id: row.id, seatCount },
          })
        }
        min={1}
        max={500}
      />
      <NumberField
        label="Espaciado (px)"
        value={row.seatSpacing}
        onCommit={(seatSpacing) =>
          dispatch({
            type: "UPDATE_ROW_CONFIG",
            payload: { id: row.id, seatSpacing },
          })
        }
        min={1}
        step={0.5}
      />
      <NumberField
        label="Radio (px)"
        value={row.seatRadius}
        onCommit={(seatRadius) =>
          dispatch({
            type: "UPDATE_ROW_CONFIG",
            payload: { id: row.id, seatRadius },
          })
        }
        min={1}
        step={0.5}
      />

      <Divider />

      <LabelRuleEditor
        rule={row.labeling}
        onApply={(rule) =>
          dispatch({
            type: "APPLY_LABEL_RULE",
            payload: { kind: "row", id: row.id, rule },
          })
        }
      />

      <Divider />

      <SeatOverrideEditor
        entityId={row.id}
        kind="row"
        seatOverrides={row.seatOverrides}
        getLabel={(i) => getRowSeatLabel(row, i)}
      />
    </div>
  );
}
