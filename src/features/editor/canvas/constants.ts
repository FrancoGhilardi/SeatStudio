/** Tamaño de celda de la grilla por defecto (world-px). Se sobreescribe con map.canvas.grid.size. */
export const DEFAULT_GRID_SIZE = 40;

/** Color de las líneas de la grilla. */
export const GRID_COLOR = "#27272a"; // zinc-800

/** Límite inferior de zoom. */
export const MIN_ZOOM = 0.1;

/** Límite superior de zoom. */
export const MAX_ZOOM = 8;

/** Factor de escala por tick de rueda de ratón. */
export const ZOOM_SENSITIVITY = 1.08;

/**
 * Desplazamiento mínimo en px (coordenadas de pantalla) para considerar
 * que el puntero fue arrastrado intencionalmente.
 * Por debajo de este valor se trata como un clic puntual.
 */
export const DRAG_THRESHOLD = 5;
