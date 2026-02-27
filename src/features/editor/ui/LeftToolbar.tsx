"use client";

import { useState } from "react";
import { useEditorStore } from "@store/editor.store";
import { selectTool } from "@store/selectors";
import type { EditorTool } from "@store/editor.store";

function IconSelect() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 3l11 7-5.5 1.5L8 17 5 3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRow() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="4" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <line
        x1="4"
        y1="10"
        x2="16"
        y2="10"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
    </svg>
  );
}

function IconTable() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="16" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="4" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconArea() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <polygon
        points="10,3 17,14 3,14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.1"
      />
      <circle cx="10" cy="3" r="1.5" fill="currentColor" />
      <circle cx="17" cy="14" r="1.5" fill="currentColor" />
      <circle cx="3" cy="14" r="1.5" fill="currentColor" />
    </svg>
  );
}

interface ToolConfig {
  id: EditorTool;
  label: string;
  icon: React.ReactNode;
}

const TOOLS: ToolConfig[] = [
  { id: "select", label: "Seleccionar", icon: <IconSelect /> },
  { id: "addRow", label: "Añadir fila", icon: <IconRow /> },
  { id: "addTable", label: "Añadir mesa", icon: <IconTable /> },
  { id: "addArea", label: "Añadir área", icon: <IconArea /> },
];

/** Lookup O(1): id de herramienta → índice en TOOLS */
const TOOL_INDEX: Record<EditorTool, number> = Object.fromEntries(
  TOOLS.map((t, i) => [t.id, i]),
) as Record<EditorTool, number>;

/** Lookup O(1): id de herramienta → label */
const TOOL_LABEL: Record<EditorTool, string> = Object.fromEntries(
  TOOLS.map((t) => [t.id, t.label]),
) as Record<EditorTool, string>;

export function LeftToolbar() {
  const activeTool = useEditorStore(selectTool);
  const setTool = useEditorStore((s) => s.setTool);
  const [hovered, setHovered] = useState<EditorTool | null>(null);

  return (
    <aside className="relative flex w-14 shrink-0 flex-col items-center gap-1 border-r border-zinc-800 bg-zinc-900 py-3">
      {TOOLS.map(({ id, label, icon }) => (
        <ToolButton
          key={id}
          label={label}
          isActive={activeTool === id}
          onClick={() => setTool(id)}
          onHoverChange={(h) => setHovered(h ? id : null)}
        >
          {icon}
        </ToolButton>
      ))}

      {/* Tooltip flotante a la derecha de la toolbar */}
      {hovered && (
        <div
          className="pointer-events-none absolute left-full top-0 ml-2 z-50"
          style={{ top: `${TOOL_INDEX[hovered] * 44 + 12}px` }}
        >
          <span className="whitespace-nowrap rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-100 shadow">
            {TOOL_LABEL[hovered]}
          </span>
        </div>
      )}
    </aside>
  );
}

interface ToolButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  onHoverChange: (hovered: boolean) => void;
  children: React.ReactNode;
}

function ToolButton({
  label,
  isActive,
  onClick,
  onHoverChange,
  children,
}: ToolButtonProps) {
  return (
    <button
      title={label}
      aria-label={label}
      aria-pressed={isActive}
      onClick={onClick}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      className={[
        "flex w-10 h-10 items-center justify-center rounded transition",
        isActive
          ? "bg-indigo-600 text-white"
          : "text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
