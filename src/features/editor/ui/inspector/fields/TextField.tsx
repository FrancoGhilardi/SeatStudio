"use client";

import { useEffect, useState } from "react";
import { FieldLabel, ErrorMsg } from "../shared";

export interface TextFieldProps {
  label: string;
  value: string;
  onCommit: (val: string) => void;
  validate?: (val: string) => string | null;
  placeholder?: string;
}

/**
 * Campo de texto con validación lazy (valida al salir del foco o al presionar Enter).
 *
 * SRP: solo gestiona el estado local de un input de texto y lo confirma al dominio.
 */
export function TextField({
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
