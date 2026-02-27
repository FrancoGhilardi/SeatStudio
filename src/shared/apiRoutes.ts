/**
 * Rutas de la API interna de SeatStudio.
 *
 * Centraliza las URLs para que cualquier cambio de ruta se propague
 * automáticamente a todos los consumidores (store, hooks, tests).
 *
 * Regla: ningún fetch a `/api/...` debe hardcodear la ruta directamente.
 */
export const API_ROUTES = {
  /** GET → devuelve el mapa activo; PUT → guarda el mapa activo. */
  seatmapActive: "/api/seatmap/active",
  /** POST → crea/resetea el mapa activo a uno vacío. */
  seatmapNew: "/api/seatmap/new",
} as const;
