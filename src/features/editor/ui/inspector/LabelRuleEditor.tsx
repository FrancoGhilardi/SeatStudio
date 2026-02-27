"use client";

import { useEffect, useState } from "react";
import type { LabelingRule } from "@domain/model/seatmap";
import { SectionTitle, FieldLabel, ErrorMsg } from "./shared";
import { validateLabelRuleInputs } from "./utils";

export interface LabelRuleEditorProps {
  rule: LabelingRule;
  onApply: (rule: LabelingRule) => void;
}

/**
 * Editor de regla de etiquetado (template + startIndex + pad).
 *
 * SRP: gestiona únicamente el formulario de una LabelingRule y llama a
 * `onApply` cuando el usuario confirma. No conoce el store ni el tipo de
 * entidad (delega al padre vía callback).
 */
export function LabelRuleEditor({ rule, onApply }: LabelRuleEditorProps) {
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
    const errs = validateLabelRuleInputs(template, startIndex, pad);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    onApply({
      template: template.trim(),
      startIndex: parseInt(startIndex, 10),
      pad: parseInt(pad, 10),
    });
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
          <FieldLabel>Desde (≥&nbsp;1)</FieldLabel>
          <input
            type="number"
            min={1}
            className={`rounded border bg-zinc-800 px-2 py-1 text-sm text-zinc-100 outline-none transition focus:border-blue-500 ${
              errors["start"] ? "border-red-500" : "border-zinc-700"
            }`}
            value={startIndex}
            onChange={(e) => setStartIndex(e.target.value)}
          />
          {errors["start"] && <ErrorMsg msg={errors["start"]} />}
        </div>

        <div className="flex flex-col gap-0.5">
          <FieldLabel>Relleno (0–8)</FieldLabel>
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
