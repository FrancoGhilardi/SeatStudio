"use client";

import { useEditorStore } from "@store/editor.store";
import type { Table } from "@domain/model/seatmap";
import { getTableSeatLabel } from "@domain/services/labeling";
import { SectionTitle, FieldLabel, Divider } from "./shared";
import { TextField } from "./fields/TextField";
import { NumberField } from "./fields/NumberField";
import { LabelRuleEditor } from "./LabelRuleEditor";
import { SeatOverrideEditor } from "./SeatOverrideEditor";

/**
 * Inspector de propiedades de una mesa circular.
 *
 * SRP: orquesta los sub-formularios de Table y despacha los comandos correspondientes.
 */
export function TableInspector({ table }: { table: Table }) {
  const dispatch = useEditorStore((s) => s.dispatch);

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Mesa</SectionTitle>

      <TextField
        label="Etiqueta"
        value={table.label}
        onCommit={(label) =>
          dispatch({
            type: "SET_ENTITY_LABEL",
            payload: { kind: "table", id: table.id, label },
          })
        }
        validate={(v) =>
          !v.trim() ? "La etiqueta no puede estar vacía" : null
        }
      />

      <div>
        <FieldLabel>Centro</FieldLabel>
        <p className="mt-0.5 tabular-nums text-xs text-zinc-400">
          ({Math.round(table.center.x)}, {Math.round(table.center.y)})
        </p>
      </div>

      <NumberField
        label="Radio de mesa (px)"
        value={table.radius}
        onCommit={(radius) =>
          dispatch({
            type: "UPDATE_TABLE_GEOMETRY",
            payload: { id: table.id, center: table.center, radius },
          })
        }
        min={10}
        step={1}
      />

      <Divider />
      <SectionTitle>Asientos</SectionTitle>

      <NumberField
        label="Cantidad"
        value={table.seatCount}
        onCommit={(seatCount) =>
          dispatch({
            type: "UPDATE_TABLE_CONFIG",
            payload: { id: table.id, seatCount },
          })
        }
        min={1}
        max={50}
      />
      <NumberField
        label="Radio de asiento (px)"
        value={table.seatRadius}
        onCommit={(seatRadius) =>
          dispatch({
            type: "UPDATE_TABLE_CONFIG",
            payload: { id: table.id, seatRadius },
          })
        }
        min={1}
        step={0.5}
      />

      <Divider />

      <LabelRuleEditor
        rule={table.labeling}
        onApply={(rule) =>
          dispatch({
            type: "APPLY_LABEL_RULE",
            payload: { kind: "table", id: table.id, rule },
          })
        }
      />

      <Divider />

      <SeatOverrideEditor
        entityId={table.id}
        kind="table"
        seatOverrides={table.seatOverrides}
        getLabel={(i) => getTableSeatLabel(table, i)}
      />
    </div>
  );
}
