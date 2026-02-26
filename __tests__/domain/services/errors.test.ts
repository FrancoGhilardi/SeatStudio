import { describe, expect, it } from "vitest";
import { fail, failOne, mapResult, ok } from "@domain/services/errors";

describe("mapResult", () => {
  it("transforma el valor en un resultado exitoso", () => {
    const result = mapResult(ok("abc"), (s) => s.length);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(3);
  });

  it("propaga los errores sin modificar", () => {
    const err = failOne<string>({ code: "ERR", message: "fail" });
    const result = mapResult(err, (s) => s.length);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe("ERR");
    }
  });

  it("encadena múltiples transformaciones", () => {
    const result = mapResult(
      mapResult(ok(2), (n) => n * 3),
      (n) => `val=${n}`,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("val=6");
  });
});

describe("ok / fail / failOne", () => {
  it("ok crea un resultado exitoso", () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(42);
  });

  it("fail crea un resultado fallido con múltiples errores", () => {
    const r = fail<number>([
      { code: "A", message: "a" },
      { code: "B", message: "b" },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(2);
  });

  it("failOne crea un resultado fallido con un único error", () => {
    const r = failOne<string>({ code: "X", message: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe("X");
  });
});
