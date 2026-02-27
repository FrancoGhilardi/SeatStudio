"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type ToastVariant = "info" | "success" | "error" | "warning";

export interface ToastMessage {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast(message: string, variant?: ToastVariant): void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let _idCounter = 0;
const nextId = () => `toast-${(_idCounter++).toString()}`;

const AUTO_DISMISS_MS = 3_500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = nextId();
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Portal de toasts — esquina inferior derecha */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}

const VARIANT_CLS: Record<ToastVariant, string> = {
  info: "border-zinc-600 bg-zinc-800 text-zinc-100",
  success: "border-emerald-600 bg-emerald-950 text-emerald-100",
  error: "border-red-600 bg-red-950 text-red-100",
  warning: "border-amber-500 bg-amber-950 text-amber-100",
};

function ToastItem({
  item,
  onDismiss,
}: {
  item: ToastMessage;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Entrada con ligero delay para que React monte el elemento antes del fade-in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  function handleDismiss() {
    setVisible(false);
    timerRef.current = setTimeout(() => onDismiss(item.id), 200);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      role="status"
      onClick={handleDismiss}
      className={[
        "pointer-events-auto flex max-w-xs cursor-pointer items-start gap-2 rounded-lg border px-4 py-3 shadow-lg text-sm",
        "transition-all duration-200",
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        VARIANT_CLS[item.variant],
      ].join(" ")}
    >
      <span className="flex-1">{item.message}</span>
      <button
        aria-label="Cerrar notificación"
        className="shrink-0 opacity-60 hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          handleDismiss();
        }}
      >
        ✕
      </button>
    </div>
  );
}
