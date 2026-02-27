"use client";

import { useEffect, useState } from "react";
import { FieldLabel, ErrorMsg } from "../shared";

export interface NumberFieldProps {
  label: string;
  value: number;
  onCommit: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

/**
 * Campo numérico con validación lazy de rango.
 *
 * SRP: gestiona el estado local de un input numérico y lo confirma al dominio.
 */
export function NumberField({
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
