// Result / Error model

export interface DomainError {
  /** Código de error legible por máquina */
  readonly code: string;
  /** Mensaje descriptivo para el desarrollador / UI */
  readonly message: string;
  /** Ruta opcional al campo problemático (ej: "rows.abc123.label") */
  readonly path?: string;
}

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly DomainError[] };

// Constructores de conveniencia

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T>(errors: readonly DomainError[]): Result<T> {
  return { ok: false, errors };
}

export function failOne<T>(error: DomainError): Result<T> {
  return { ok: false, errors: [error] };
}

// Utilidad: acumular errores y propagar

/**
 * Combina varios resultados en uno.
 * Si alguno tiene errores, retorna `fail` con todos los errores acumulados.
 * Si todos son ok, retorna `ok` con el array de valores.
 */
export function combineResults<T>(
  results: ReadonlyArray<Result<T>>,
): Result<T[]> {
  const errors: DomainError[] = [];
  const values: T[] = [];

  for (const r of results) {
    if (r.ok) {
      values.push(r.value);
    } else {
      errors.push(...r.errors);
    }
  }

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, value: values };
}

/**
 * Transforma el valor de un `Result<T>` exitoso en `Result<U>`.
 * Si el resultado es un error, lo propaga sin modificar.
 *
 * Equivalente al `map` de un functor, útil para componer usecases y commands.
 *
 * @example
 *   const idResult: Result<string> = ok("abc");
 *   const numResult: Result<number> = mapResult(idResult, (id) => id.length);
 */
export function mapResult<T, U>(
  result: Result<T>,
  fn: (value: T) => U,
): Result<U> {
  return result.ok ? ok(fn(result.value)) : result;
}
