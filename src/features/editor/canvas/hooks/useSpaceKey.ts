"use client";

import { useState, useEffect } from "react";

/**
 * Detecta si la tecla Space está presionada, excluyendo inputs y elementos editables
 * para no interferir con la escritura del usuario.
 *
 * SRP: gestiona únicamente el estado de la tecla Space para activar el pan por arrastre.
 */
export function useSpaceKey(): boolean {
  const [isSpaceDown, setIsSpaceDown] = useState(false);

  useEffect(() => {
    const isEditable = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && !isEditable(e.target)) {
        e.preventDefault();
        setIsSpaceDown(true);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setIsSpaceDown(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  return isSpaceDown;
}
