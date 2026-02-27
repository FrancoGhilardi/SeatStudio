"use client";

import { useState } from "react";
import { useEditorStore } from "@store/editor.store";
import { selectSelectionRefs } from "@store/selectors";
import type { EntityRef, LabelingRule } from "@domain/model/seatmap";
import { SectionTitle, FieldLabel, ErrorMsg, Divider } from "./shared";
import { formatEntityLabel, validateLabelRuleInputs } from "./utils";

/**
 * Inspector para selección múltiple heterogénea.
 *
 * Agrupa tres operaciones batch atómicas (una entrada en historial cada una):
 *  1. Etiqueta idéntica para todas las entidades.
 *  2. Etiquetado secuencial con template + startIndex + pad.
 *  3. Aplicar LabelingRule de asientos a todas las filas/mesas seleccionadas.
 *
 * SRP: orquesta los formularios batch y despacha los tres comandos batch correspondientes.
 */
export function MultiInspector() {
  const refs = useEditorStore(selectSelectionRefs);
  const dispatch = useEditorStore((s) => s.dispatch);

  const [batchLabel, setBatchLabel] = useState("");
  const [batchError, setBatchError] = useState<string | null>(null);

  const [seqTemplate, setSeqTemplate] = useState("Entidad {n}");
  const [seqStart, setSeqStart] = useState("1");
  const [seqPad, setSeqPad] = useState("0");
  const [seqErrors, setSeqErrors] = useState<Record<string, string>>({});

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
    dispatch({
      type: "BATCH_SET_ENTITY_LABELS",
      payload: {
        items: refs.map((ref) => ({
          kind: ref.kind,
          id: ref.id,
          label: batchLabel.trim(),
        })),
      },
    });
    setBatchLabel("");
  };

  const applySequential = () => {
    const errs = validateLabelRuleInputs(seqTemplate, seqStart, seqPad);
    if (Object.keys(errs).length > 0) {
      setSeqErrors(errs);
      return;
    }
    setSeqErrors({});
    const si = parseInt(seqStart, 10);
    const p = parseInt(seqPad, 10);
    dispatch({
      type: "BATCH_SET_ENTITY_LABELS",
      payload: {
        items: refs.map((ref, i) => ({
          kind: ref.kind,
          id: ref.id,
          label: formatEntityLabel(seqTemplate.trim(), si + i, p),
        })),
      },
    });
  };

  const applyBatchRule = () => {
    const errs = validateLabelRuleInputs(ruleTemplate, ruleStart, rulePad);
    if (Object.keys(errs).length > 0) {
      setRuleErrors(errs);
      return;
    }
    setRuleErrors({});
    const rule: LabelingRule = {
      template: ruleTemplate.trim(),
      startIndex: parseInt(ruleStart, 10),
      pad: parseInt(rulePad, 10),
    };
    dispatch({
      type: "BATCH_APPLY_LABEL_RULE",
      payload: {
        items: refs
          .filter(
            (r): r is EntityRef & { kind: "row" | "table" } =>
              r.kind === "row" || r.kind === "table",
          )
          .map((ref) => ({ kind: ref.kind, id: ref.id, rule })),
      },
    });
  };

  // ── preview secuencial ──
  const seqSi = parseInt(seqStart, 10);
  const seqP = parseInt(seqPad, 10);
  const seqPreview =
    seqTemplate.trim() &&
    !isNaN(seqSi) &&
    seqSi >= 1 &&
    !isNaN(seqP) &&
    seqP >= 0 &&
    seqP <= 8
      ? [0, 1, 2]
          .slice(0, Math.min(3, refs.length))
          .map((i) => formatEntityLabel(seqTemplate.trim(), seqSi + i, seqP))
          .join(", ")
      : null;

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

      {/* Etiqueta idéntica */}
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
            Platea 1, Platea 2… para las entidades en orden seleccionado.
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
              <FieldLabel>Desde (≥&nbsp;1)</FieldLabel>
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
              <FieldLabel>Relleno (0–8)</FieldLabel>
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

          {seqPreview && (
            <p className="text-[0.6rem] text-zinc-500">
              Vista previa: <span className="text-zinc-300">{seqPreview}…</span>
            </p>
          )}

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
              <FieldLabel>Desde (≥&nbsp;1)</FieldLabel>
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
              <FieldLabel>Relleno (0–8)</FieldLabel>
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
