"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "@store/editor.store";
import {
  selectSelectionRefs,
  selectMap,
  selectHasSelection,
  selectSelectedSeat,
} from "@store/selectors";
import type {
  EntityRef,
  LabelingRule,
  Row,
  Table,
  Area,
  SeatOverride,
} from "@domain/model/seatmap";
import {
  getRowSeatLabel,
  getTableSeatLabel,
  formatLabel,
} from "@domain/services/labeling";
import { validateMap } from "@domain/services/validateMap";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[0.65rem] font-semibold uppercase tracking-widest text-zinc-500">
      {children}
    </span>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[0.65rem] font-medium uppercase tracking-wide text-zinc-500">
      {children}
    </label>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return <span className="text-[0.65rem] text-red-400">{msg}</span>;
}

function Divider() {
  return <div className="h-px bg-zinc-800" />;
}

interface TextFieldProps {
  label: string;
  value: string;
  onCommit: (val: string) => void;
  validate?: (val: string) => string | null;
  placeholder?: string;
}

function TextField({
  label,
  value,
  onCommit,
  validate,
  placeholder,
}: TextFieldProps) {
  const [local, setLocal] = useState(value);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocal(value);
    setError(null);
  }, [value]);

  const commit = () => {
    const err = validate ? validate(local) : null;
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onCommit(local);
  };

  return (
    <div className="flex flex-col gap-0.5">
      <FieldLabel>{label}</FieldLabel>
      <input
        type="text"
        className={`rounded border bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none transition focus:border-blue-500 ${
          error ? "border-red-500" : "border-zinc-700"
        }`}
        value={local}
        placeholder={placeholder}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      {error && <ErrorMsg msg={error} />}
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onCommit: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

function NumberField({
  label,
  value,
  onCommit,
  min,
  max,
  step = 1,
}: NumberFieldProps) {
  const [local, setLocal] = useState(String(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocal(String(value));
    setError(null);
  }, [value]);

  const commit = () => {
    const num = Number(local);
    if (isNaN(num)) {
      setError("Debe ser un número");
      return;
    }
    if (min !== undefined && num < min) {
      setError(`Mínimo ${min}`);
      return;
    }
    if (max !== undefined && num > max) {
      setError(`Máximo ${max}`);
      return;
    }
    setError(null);
    onCommit(num);
  };

  return (
    <div className="flex flex-col gap-0.5">
      <FieldLabel>{label}</FieldLabel>
      <input
        type="number"
        className={`rounded border bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none transition focus:border-blue-500 ${
          error ? "border-red-500" : "border-zinc-700"
        }`}
        value={local}
        step={step}
        min={min}
        max={max}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      {error && <ErrorMsg msg={error} />}
    </div>
  );
}

interface LabelRuleEditorProps {
  rule: LabelingRule;
  onApply: (rule: LabelingRule) => void;
}

function LabelRuleEditor({ rule, onApply }: LabelRuleEditorProps) {
  const [template, setTemplate] = useState(rule.template);
  const [startIndex, setStartIndex] = useState(String(rule.startIndex));
  const [pad, setPad] = useState(String(rule.pad));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setTemplate(rule.template);
    setStartIndex(String(rule.startIndex));
    setPad(String(rule.pad));
    setErrors({});
  }, [rule.template, rule.startIndex, rule.pad]);

  const handleApply = () => {
    const newErrors: Record<string, string> = {};
    if (!template.trim()) newErrors["template"] = "No puede estar vacío";
    const si = parseInt(startIndex, 10);
    if (isNaN(si) || si < 1) newErrors["startIndex"] = "Debe ser ≥ 1";
    const p = parseInt(pad, 10);
    if (isNaN(p) || p < 0 || p > 8) newErrors["pad"] = "Entre 0 y 8";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    onApply({ template: template.trim(), startIndex: si, pad: p });
  };

  return (
    <div className="flex flex-col gap-2 rounded border border-zinc-700 bg-zinc-900 p-2">
      <SectionTitle>Regla de etiquetado</SectionTitle>
      <p className="text-[0.6rem] text-zinc-600">
        Marcadores: <code className="text-zinc-400">{"{n}"}</code>,{" "}
        <code className="text-zinc-400">{"{row}"}</code>,{" "}
        <code className="text-zinc-400">{"{table}"}</code>
      </p>

      <div className="flex flex-col gap-0.5">
        <FieldLabel>Plantilla</FieldLabel>
        <input
          type="text"
          className={`rounded border bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none transition focus:border-blue-500 ${
            errors["template"] ? "border-red-500" : "border-zinc-700"
          }`}
          value={template}
          placeholder="Ej: A{n}"
          onChange={(e) => setTemplate(e.target.value)}
        />
        {errors["template"] && <ErrorMsg msg={errors["template"]} />}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5">
          <FieldLabel>Desde (≥ 1)</FieldLabel>
          <input
            type="number"
            min={1}
            className={`rounded border bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none transition focus:border-blue-500 ${
              errors["startIndex"] ? "border-red-500" : "border-zinc-700"
            }`}
            value={startIndex}
            onChange={(e) => setStartIndex(e.target.value)}
          />
          {errors["startIndex"] && <ErrorMsg msg={errors["startIndex"]} />}
        </div>

        <div className="flex flex-col gap-0.5">
          <FieldLabel>Relleno (0-8)</FieldLabel>
          <input
            type="number"
            min={0}
            max={8}
            className={`rounded border bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none transition focus:border-blue-500 ${
              errors["pad"] ? "border-red-500" : "border-zinc-700"
            }`}
            value={pad}
            onChange={(e) => setPad(e.target.value)}
          />
          {errors["pad"] && <ErrorMsg msg={errors["pad"]} />}
        </div>
      </div>

      <button
        onClick={handleApply}
        className="mt-1 rounded bg-blue-700 px-3 py-1 text-xs font-medium text-white transition hover:bg-blue-600 active:bg-blue-800"
      >
        Aplicar regla
      </button>
    </div>
  );
}

/**
 * Formatea un label de entidad con {n} reemplazado por el número con relleno.
 * Reutiliza `formatLabel` del dominio; startIndex fijo en 1 porque el offset
 * se gestiona externamente sumando el índice de iteración.
 */
function formatEntityLabel(template: string, n: number, pad: number): string {
  return formatLabel({ template, startIndex: 1, pad }, { n });
}

function MapValidationSummary() {
  const map = useEditorStore(selectMap);
  const [expanded, setExpanded] = useState(false);
  // Memoized: validateMap itera todas las entidades → costoso si se repite en cada render.
  const result = useMemo(() => (map ? validateMap(map) : null), [map]);

  if (!map || !result) return null;

  if (result.ok) {
    return (
      <div className="flex items-center gap-1.5 rounded border border-emerald-800/40 bg-emerald-950/20 px-2 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span className="text-[0.65rem] text-emerald-400">
          Mapa válido para exportar
        </span>
      </div>
    );
  }

  const count = result.errors.length;
  return (
    <div className="flex flex-col gap-1 rounded border border-amber-700/40 bg-amber-950/20 p-2">
      <button
        className="flex items-center gap-1.5 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        <span className="flex-1 text-[0.65rem] font-medium text-amber-400">
          {count}{" "}
          {count === 1 ? "error de validación" : "errores de validación"}
        </span>
        <span className="text-[0.6rem] text-zinc-600">
          {expanded ? "▲" : "▼"}
        </span>
      </button>
      {expanded && (
        <ul className="mt-1 flex flex-col gap-0.5">
          {result.errors.slice(0, 8).map((err, i) => (
            <li key={i} className="text-[0.6rem] text-amber-300/80">
              • {err.message}
            </li>
          ))}
          {count > 8 && (
            <li className="text-[0.6rem] text-zinc-600">…y {count - 8} más</li>
          )}
        </ul>
      )}
    </div>
  );
}

interface SeatOverrideEditorProps {
  entityId: string;
  kind: "row" | "table";
  seatOverrides: Readonly<Record<number, SeatOverride>>;
  getLabel: (index: number) => string;
}

function SeatOverrideEditor({
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

  // Pre-rellenar con el label actual cuando cambia el asiento seleccionado
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

  const overrideEntries = Object.entries(seatOverrides) as [
    string,
    SeatOverride,
  ][];

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
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              className={`flex-1 rounded border bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none transition focus:border-amber-500 ${
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
          </div>
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
            {overrideEntries
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([idx, over]) => (
                <li
                  key={idx}
                  className="flex items-center justify-between text-[0.65rem]"
                >
                  <span className="text-zinc-500">#{Number(idx) + 1}</span>
                  <span className="font-medium text-amber-300">
                    {over.label}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RowInspector({ row }: { row: Row }) {
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

function TableInspector({ table }: { table: Table }) {
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

function AreaInspector({ area }: { area: Area }) {
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

function MultiInspector() {
  const refs = useEditorStore(selectSelectionRefs);
  const dispatch = useEditorStore((s) => s.dispatch);

  // ── etiqueta igual para todas ──
  const [batchLabel, setBatchLabel] = useState("");
  const [batchError, setBatchError] = useState<string | null>(null);

  // ── etiquetado secuencial: "Fila {n}" → Fila 1, Fila 2... ──
  const [seqTemplate, setSeqTemplate] = useState("Entidad {n}");
  const [seqStart, setSeqStart] = useState("1");
  const [seqPad, setSeqPad] = useState("0");
  const [seqErrors, setSeqErrors] = useState<Record<string, string>>({});

  // ── batch APPLY_LABEL_RULE para asientos ──
  const [ruleTemplate, setRuleTemplate] = useState("{n}");
  const [ruleStart, setRuleStart] = useState("1");
  const [rulePad, setRulePad] = useState("0");
  const [ruleErrors, setRuleErrors] = useState<Record<string, string>>({});

  const kinds = [...new Set(refs.map((r) => r.kind))];
  const singleKind: EntityRef["kind"] | null =
    kinds.length === 1 ? (kinds[0] ?? null) : null;
  const supportsSeats = singleKind === "row" || singleKind === "table";

  const rowCount = refs.filter((r) => r.kind === "row").length;
  const tableCount = refs.filter((r) => r.kind === "table").length;
  const areaCount = refs.filter((r) => r.kind === "area").length;

  const applyBatchLabel = () => {
    if (!batchLabel.trim()) {
      setBatchError("La etiqueta no puede estar vacía");
      return;
    }
    setBatchError(null);
    refs.forEach((ref) => {
      dispatch({
        type: "SET_ENTITY_LABEL",
        payload: { kind: ref.kind, id: ref.id, label: batchLabel.trim() },
      });
    });
    setBatchLabel("");
  };

  const applySequential = () => {
    const errs: Record<string, string> = {};
    if (!seqTemplate.trim()) errs["template"] = "No puede estar vacío";
    const si = parseInt(seqStart, 10);
    if (isNaN(si) || si < 1) errs["start"] = "Debe ser ≥ 1";
    const p = parseInt(seqPad, 10);
    if (isNaN(p) || p < 0 || p > 8) errs["pad"] = "Entre 0 y 8";
    if (Object.keys(errs).length > 0) {
      setSeqErrors(errs);
      return;
    }
    setSeqErrors({});
    refs.forEach((ref, i) => {
      const label = formatEntityLabel(seqTemplate.trim(), si + i, p);
      dispatch({
        type: "SET_ENTITY_LABEL",
        payload: { kind: ref.kind, id: ref.id, label },
      });
    });
  };

  const applyBatchRule = () => {
    const errs: Record<string, string> = {};
    if (!ruleTemplate.trim()) errs["template"] = "No puede estar vacío";
    const si = parseInt(ruleStart, 10);
    if (isNaN(si) || si < 1) errs["start"] = "Debe ser ≥ 1";
    const p = parseInt(rulePad, 10);
    if (isNaN(p) || p < 0 || p > 8) errs["pad"] = "Entre 0 y 8";
    if (Object.keys(errs).length > 0) {
      setRuleErrors(errs);
      return;
    }
    setRuleErrors({});
    const rule: LabelingRule = {
      template: ruleTemplate.trim(),
      startIndex: si,
      pad: p,
    };
    refs
      .filter((r) => r.kind === "row" || r.kind === "table")
      .forEach((ref) => {
        dispatch({
          type: "APPLY_LABEL_RULE",
          payload: { kind: ref.kind as "row" | "table", id: ref.id, rule },
        });
      });
  };

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Selección múltiple</SectionTitle>

      {/* Conteo por tipo */}
      <div className="grid grid-cols-2 gap-1 text-xs text-zinc-400">
        {rowCount > 0 && (
          <>
            <span>Filas</span>
            <span className="text-right tabular-nums text-zinc-300">
              {rowCount}
            </span>
          </>
        )}
        {tableCount > 0 && (
          <>
            <span>Mesas</span>
            <span className="text-right tabular-nums text-zinc-300">
              {tableCount}
            </span>
          </>
        )}
        {areaCount > 0 && (
          <>
            <span>Áreas</span>
            <span className="text-right tabular-nums text-zinc-300">
              {areaCount}
            </span>
          </>
        )}
      </div>

      {/* Misma etiqueta para todas */}
      {singleKind && (
        <>
          <Divider />
          <SectionTitle>Etiqueta idéntica</SectionTitle>
          <p className="text-[0.6rem] text-zinc-600">
            Asigna la misma etiqueta a todas las entidades seleccionadas.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              className={`flex-1 rounded border bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none transition focus:border-blue-500 ${
                batchError ? "border-red-500" : "border-zinc-700"
              }`}
              value={batchLabel}
              placeholder="Ej: Platea"
              onChange={(e) => setBatchLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyBatchLabel();
              }}
            />
            <button
              onClick={applyBatchLabel}
              className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 transition hover:bg-zinc-600"
            >
              Aplicar
            </button>
          </div>
          {batchError && <ErrorMsg msg={batchError} />}
        </>
      )}

      {/* Etiquetado secuencial */}
      {singleKind && (
        <>
          <Divider />
          <SectionTitle>Etiquetado secuencial</SectionTitle>
          <p className="text-[0.6rem] text-zinc-600">
            Template <code className="text-zinc-400">{"{{n}}"}</code> genera
            Platea 1, Platea 2… para las entidades en el orden seleccionado.
          </p>

          <div className="flex flex-col gap-0.5">
            <FieldLabel>Plantilla</FieldLabel>
            <input
              type="text"
              className={`rounded border bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none transition focus:border-blue-500 ${
                seqErrors["template"] ? "border-red-500" : "border-zinc-700"
              }`}
              value={seqTemplate}
              placeholder="Ej: Platea {n}"
              onChange={(e) => setSeqTemplate(e.target.value)}
            />
            {seqErrors["template"] && <ErrorMsg msg={seqErrors["template"]} />}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-0.5">
              <FieldLabel>Desde (≥ 1)</FieldLabel>
              <input
                type="number"
                min={1}
                className={`rounded border bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none transition focus:border-blue-500 ${
                  seqErrors["start"] ? "border-red-500" : "border-zinc-700"
                }`}
                value={seqStart}
                onChange={(e) => setSeqStart(e.target.value)}
              />
              {seqErrors["start"] && <ErrorMsg msg={seqErrors["start"]} />}
            </div>
            <div className="flex flex-col gap-0.5">
              <FieldLabel>Relleno (0-8)</FieldLabel>
              <input
                type="number"
                min={0}
                max={8}
                className={`rounded border bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none transition focus:border-blue-500 ${
                  seqErrors["pad"] ? "border-red-500" : "border-zinc-700"
                }`}
                value={seqPad}
                onChange={(e) => setSeqPad(e.target.value)}
              />
              {seqErrors["pad"] && <ErrorMsg msg={seqErrors["pad"]} />}
            </div>
          </div>

          {seqTemplate.trim() &&
            (() => {
              const si = parseInt(seqStart, 10);
              const p = parseInt(seqPad, 10);
              if (!isNaN(si) && si >= 1 && !isNaN(p) && p >= 0 && p <= 8) {
                const preview = [0, 1, 2]
                  .slice(0, Math.min(3, refs.length))
                  .map((i) => formatEntityLabel(seqTemplate.trim(), si + i, p))
                  .join(", ");
                return (
                  <p className="text-[0.6rem] text-zinc-500">
                    Vista previa:{" "}
                    <span className="text-zinc-300">{preview}…</span>
                  </p>
                );
              }
              return null;
            })()}

          <button
            onClick={applySequential}
            className="rounded bg-blue-700 px-3 py-1 text-xs font-medium text-white transition hover:bg-blue-600 active:bg-blue-800"
          >
            Aplicar etiquetado secuencial
          </button>
        </>
      )}

      {/* Batch APPLY_LABEL_RULE para asientos */}
      {supportsSeats && (
        <>
          <Divider />
          <SectionTitle>Regla de asientos en lote</SectionTitle>
          <p className="text-[0.6rem] text-zinc-600">
            Aplica la misma regla de etiquetado de asientos a todas las
            {singleKind === "row" ? " filas" : " mesas"} seleccionadas.
          </p>

          <div className="flex flex-col gap-0.5">
            <FieldLabel>Plantilla</FieldLabel>
            <input
              type="text"
              className={`rounded border bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none transition focus:border-blue-500 ${
                ruleErrors["template"] ? "border-red-500" : "border-zinc-700"
              }`}
              value={ruleTemplate}
              placeholder={
                singleKind === "row" ? "Ej: {row}-{n}" : "Ej: {table}-{n}"
              }
              onChange={(e) => setRuleTemplate(e.target.value)}
            />
            {ruleErrors["template"] && (
              <ErrorMsg msg={ruleErrors["template"]} />
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-0.5">
              <FieldLabel>Desde (≥ 1)</FieldLabel>
              <input
                type="number"
                min={1}
                className={`rounded border bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none transition focus:border-blue-500 ${
                  ruleErrors["start"] ? "border-red-500" : "border-zinc-700"
                }`}
                value={ruleStart}
                onChange={(e) => setRuleStart(e.target.value)}
              />
              {ruleErrors["start"] && <ErrorMsg msg={ruleErrors["start"]} />}
            </div>
            <div className="flex flex-col gap-0.5">
              <FieldLabel>Relleno (0-8)</FieldLabel>
              <input
                type="number"
                min={0}
                max={8}
                className={`rounded border bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none transition focus:border-blue-500 ${
                  ruleErrors["pad"] ? "border-red-500" : "border-zinc-700"
                }`}
                value={rulePad}
                onChange={(e) => setRulePad(e.target.value)}
              />
              {ruleErrors["pad"] && <ErrorMsg msg={ruleErrors["pad"]} />}
            </div>
          </div>

          <button
            onClick={applyBatchRule}
            className="rounded bg-blue-700 px-3 py-1 text-xs font-medium text-white transition hover:bg-blue-600 active:bg-blue-800"
          >
            Aplicar regla a selección
          </button>
        </>
      )}
    </div>
  );
}

function MapInfo() {
  const map = useEditorStore(selectMap);
  if (!map) return null;

  return (
    <section className="flex flex-col gap-1.5">
      <SectionTitle>Mapa</SectionTitle>
      <span className="text-sm text-zinc-200">{map.meta.name}</span>
      <div className="mt-1 grid grid-cols-2 gap-1 text-xs text-zinc-400">
        <span>Filas</span>
        <span className="tabular-nums text-right text-zinc-300">
          {Object.keys(map.entities.rows).length}
        </span>
        <span>Mesas</span>
        <span className="tabular-nums text-right text-zinc-300">
          {Object.keys(map.entities.tables).length}
        </span>
        <span>Áreas</span>
        <span className="tabular-nums text-right text-zinc-300">
          {Object.keys(map.entities.areas).length}
        </span>
      </div>
    </section>
  );
}

export function InspectorPanel() {
  const map = useEditorStore(selectMap);
  const selected = useEditorStore(selectSelectionRefs);
  const hasSelection = useEditorStore(selectHasSelection);
  const requestDelete = useEditorStore((s) => s.requestDelete);
  const { rows, tables, areas } = useMemo(() => {
    if (!map || selected.length === 0)
      return { rows: [] as Row[], tables: [] as Table[], areas: [] as Area[] };
    const rows: Row[] = [];
    const tables: Table[] = [];
    const areas: Area[] = [];
    for (const ref of selected) {
      if (ref.kind === "row") {
        const r = map.entities.rows[ref.id];
        if (r) rows.push(r);
      } else if (ref.kind === "table") {
        const t = map.entities.tables[ref.id];
        if (t) tables.push(t);
      } else if (ref.kind === "area") {
        const a = map.entities.areas[ref.id];
        if (a) areas.push(a);
      }
    }
    return { rows, tables, areas };
  }, [map, selected]);

  const totalSelected = selected.length;
  const isSingle = totalSelected === 1;

  const singleRow = isSingle && rows.length === 1 ? (rows[0] ?? null) : null;
  const singleTable =
    isSingle && tables.length === 1 ? (tables[0] ?? null) : null;
  const singleArea = isSingle && areas.length === 1 ? (areas[0] ?? null) : null;
  const isMulti = totalSelected > 1;

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-3 overflow-y-auto border-l border-zinc-800 bg-zinc-900 p-4">
      {/* Cabecera */}
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
        Inspector
      </h2>

      {/* Sin mapa */}
      {!map && <p className="text-xs text-zinc-500">Sin mapa activo.</p>}

      {/* Info del mapa */}
      {map && <MapInfo />}

      {/* Estado de validación del mapa */}
      {map && <MapValidationSummary />}

      <Divider />

      {/* Sin selección */}
      {map && totalSelected === 0 && (
        <p className="text-xs text-zinc-500">
          Selecciona una entidad en el canvas para ver sus propiedades.
        </p>
      )}

      {/* Inspectores por tipo de entidad */}
      {singleRow && <RowInspector key={singleRow.id} row={singleRow} />}
      {singleTable && (
        <TableInspector key={singleTable.id} table={singleTable} />
      )}
      {singleArea && <AreaInspector key={singleArea.id} area={singleArea} />}
      {isMulti && <MultiInspector />}

      {/* Zona de peligro */}
      {hasSelection && (
        <div className="mt-auto border-t border-zinc-800 pt-3">
          <button
            onClick={requestDelete}
            className="w-full rounded px-3 py-1.5 text-sm font-medium text-red-400 transition hover:bg-red-950 hover:text-red-300"
          >
            Eliminar selección ({totalSelected})
          </button>
        </div>
      )}
    </aside>
  );
}
