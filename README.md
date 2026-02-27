# SeatStudio

Editor visual interactivo de mapas de asientos. Permite diseñar y modificar filas, asientos individuales, mesas circulares y áreas de capacidad sobre un canvas navegable, con persistencia automática en base de datos local.

---

## Índice

1. [Descripción del proyecto](#descripción-del-proyecto)
2. [Arquitectura](#arquitectura)
3. [Patrones de diseño](#patrones-de-diseño)
4. [Estructura de carpetas](#estructura-de-carpetas)
5. [Instalación y puesta en marcha](#instalación-y-puesta-en-marcha)
6. [Esquema de datos](#esquema-de-datos)
7. [Librerías utilizadas](#librerías-utilizadas)
8. [Decisiones técnicas](#decisiones-técnicas)
9. [Guía de uso](#guía-de-uso)
10. [Puntos de mejora](#puntos-de-mejora)
11. [Supuestos asumidos](#supuestos-asumidos)

---

## Descripción del proyecto

SeatStudio es un editor de mapas de asientos inspirado en la experiencia de [Seats.io](https://seats.io). Permite a los usuarios crear y editar desde cero un mapa de venue con tres tipos de entidades:

- **Filas rectas**: líneas de asientos numerables con etiquetado configurable.
- **Mesas circulares**: mesas con asientos distribuidos en la periferia.
- **Áreas poligonales**: zonas de capacidad libre, dibujadas punto a punto.

El flujo completo está soportado: crear un mapa vacío → agregar entidades → renombrar / reconfigurar → exportar JSON → reimportar → continuar editando → volver a exportar sin pérdida de datos.

---

## Arquitectura

El proyecto sigue una arquitectura híbrida: **Feature-Sliced Design (FSD)** para la organización de módulos, con **Clean Architecture** dentro de cada feature. Las dependencias fluyen siempre hacia adentro (hacia el dominio):

```
UI (React/Konva)
     ↓
Store (Zustand)     ←→     Application (Commands / Usecases)
                                   ↓
                           Domain (Entidades + Servicios puros)
                                   ↑
                        Infrastructure (Prisma + Zod + Mappers)
```

### Capas

| Capa | Descripción |
|------|-------------|
| `domain/` | TypeScript puro: entidades, invariantes, servicios deterministas. Sin dependencias externas. |
| `application/` | Orquestación de negocio: comandos tipados, usecases, puertos (interfaces de repositorio). |
| `infrastructure/` | Adaptadores externos: cliente Prisma, repositorio SQLite, schemas Zod, migraciones, mappers DTO↔Dominio. |
| `features/` | Módulos de UI: canvas, herramientas de dibujo, panel inspector, barra superior. |
| `store/` | Estado global con Zustand + Immer: historial, viewport, selección. |
| `shared/` | Utilidades transversales: rutas de API, helpers de formato. |

---

## Patrones de diseño

### Command Pattern
Todas las mutaciones del mapa pasan por comandos tipados (`EditorCommand`). Cada comando es un objeto inmutable con `type` y `payload`. El dispatcher en `execute.ts` aplica el comando sobre el estado actual y devuelve el nuevo estado o una lista de errores de dominio.

Esto habilita de forma natural el **undo/redo**: cada ejecución genera un par de patches Immer (forward/inverse) que se apilan en el historial.

Comandos implementados:
`RESET_MAP`, `IMPORT_MAP`, `CREATE_ROW`, `UPDATE_ROW_GEOMETRY`, `UPDATE_ROW_CONFIG`, `CREATE_TABLE`, `UPDATE_TABLE_GEOMETRY`, `UPDATE_TABLE_CONFIG`, `CREATE_AREA`, `UPDATE_AREA_SHAPE`, `UPDATE_AREA_CAPACITY`, `SET_ENTITY_LABEL`, `SET_SEAT_LABEL_OVERRIDE`, `APPLY_LABEL_RULE`, `DELETE_ENTITIES`

### Repository Pattern
Se define el puerto `SeatMapRepository` en `application/ports/` (interfaz TypeScript). La implementación concreta `PrismaMapRepository` vive en `infrastructure/repos/` y trabaja con Prisma + SQLite. Los componentes de UI nunca importan Prisma directamente; acceden al repositorio únicamente a través de Route Handlers de Next.js.

### Strategy Pattern
Las herramientas del canvas (`select`, `addRow`, `addTable`, `addArea`) implementan la interfaz `CanvasTool`. Cada tool es un objeto con handlers de eventos (`onBgClick`, `onBgDblClick`, `onMouseMove`). El `CanvasStage` delega los eventos al tool activo sin conocer su lógica interna, pudiendo intercambiar herramientas en runtime sin modificar el canvas.

### Factory Pattern
`createEmptyMap()` en `domain/services/seatMapFactory.ts` genera un `SeatMap` completamente válido por defecto. Se utiliza en el bootstrap inicial, en el comando `RESET_MAP` y en el repositorio al crear un documento nuevo.

### Memento Pattern (historial de undo/redo)
El store guarda pilas `past` y `future` de patches Immer. Cada dispatch genera `[forwardPatch, inversePatch]`. Undo aplica la inversa; Redo la reimplica. La pila tiene un tope de 100 entradas para limitar el uso de memoria en sesiones largas.

---

## Estructura de carpetas

```
seatstudio/
├── __tests__/                   Tests unitarios (Vitest)
│   ├── application/commands/    Tests del dispatcher de comandos
│   ├── domain/services/         Tests de geometría, etiquetado, validación, I/O
│   └── infrastructure/          Tests de mappers y persistencia
│
├── prisma/
│   ├── schema.prisma            Definición del modelo de base de datos
│   └── migrations/              Migraciones generadas por Prisma
│
├── src/
│   ├── app/                     Next.js App Router
│   │   ├── page.tsx             Punto de entrada (monta EditorShell)
│   │   ├── globals.css          Estilos globales (Tailwind)
│   │   └── api/seatmap/         Route Handlers para persistencia
│   │       ├── active/route.ts  GET y PATCH del mapa activo
│   │       └── new/route.ts     POST para crear/resetear mapa
│   │
│   ├── domain/
│   │   ├── model/seatmap.ts     Tipos TypeScript: Row, Table, Area, SeatMap, etc.
│   │   └── services/
│   │       ├── errors.ts        Tipo Result<T> y helpers ok/fail
│   │       ├── geometry.ts      Posiciones de asientos, bounding box, midpoint
│   │       ├── hitTest.ts       Detección de clics en entidades
│   │       ├── labeling.ts      Derivación de labels (template + overrides)
│   │       ├── seatMapFactory.ts createEmptyMap()
│   │       └── validateMap.ts   Validación completa de invariantes de dominio
│   │
│   ├── application/
│   │   ├── commands/
│   │   │   ├── types.ts         Definición tipada de todos los comandos
│   │   │   ├── execute.ts       Dispatcher: aplica comando → nuevo SeatMap
│   │   │   └── index.ts         Re-exportaciones
│   │   ├── ports/
│   │   │   └── seatMap.repo.ts  Interfaz SeatMapRepository (puerto de salida)
│   │   └── usecases/
│   │       ├── io.ts            importMap / exportMap con validación
│   │       └── seatmap.ts       Helpers de alto nivel sobre el repositorio
│   │
│   ├── infrastructure/
│   │   ├── db/
│   │   │   └── prismaClient.ts  Singleton del cliente Prisma (server-only)
│   │   ├── mappers/
│   │   │   └── map.mapper.ts    dtoToDomain / domainToDto (sin pérdida)
│   │   ├── repos/
│   │   │   └── seatMap.repo.impl.ts  PrismaMapRepository
│   │   └── schemas/
│   │       ├── map.schema.ts    SeatMapDtoSchema (Zod) + tipos inferidos
│   │       └── migrate.ts       parseAndMigrate: validación + migración de versión
│   │
│   ├── features/editor/
│   │   ├── canvas/              Rendering Konva: CanvasStage, RowRenderer, TableRenderer, AreaRenderer
│   │   ├── tools/               Herramientas de dibujo (Strategy Pattern)
│   │   └── ui/
│   │       ├── EditorShell.tsx  Layout raíz del editor con bootstrap
│   │       ├── TopBar.tsx       Barra superior (Nuevo, Import, Export, Undo/Redo, Zoom)
│   │       ├── LeftToolbar.tsx  Selector de herramienta activa
│   │       ├── InspectorPanel.tsx Panel de propiedades (enrutador de selección)
│   │       ├── ConfirmDialog.tsx Diálogo de confirmación de borrado
│   │       ├── ImportDialog.tsx  Diálogo de importación JSON
│   │       ├── Toast.tsx         Sistema de notificaciones en pantalla
│   │       └── inspector/        Sub-componentes del inspector por tipo de entidad
│   │
│   ├── store/
│   │   ├── editor.store.ts      Store Zustand + Immer: estado, historial, viewport
│   │   ├── selectors.ts         Selectores puros del store
│   │   └── useBootstrap.ts      Hook de inicialización: carga el mapa desde la API
│   │
│   └── shared/
│       ├── apiRoutes.ts         Constantes de rutas de la API
│       └── format.ts            Helpers de formato de texto
│
├── tsconfig.json                TypeScript strict mode + path aliases
├── vitest.config.ts             Configuración de tests
└── package.json
```

---

## Instalación y puesta en marcha

### Requisitos previos

- **Node.js** >= 20
- **pnpm** >= 9

```bash
npm install -g pnpm
```

### Pasos

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd seatstudio

# 2. Instalar dependencias
pnpm install

# 3. Aplicar migraciones de base de datos
#    Esto crea el archivo seatstudio.db en la raíz del proyecto
pnpm db:migrate

# 4. Levantar el servidor de desarrollo
pnpm dev
```

Abrir [http://localhost:3000](http://localhost:3000) en el navegador.

> **Nota**: no es necesaria ninguna variable de entorno. La base de datos SQLite se crea automáticamente en la raíz del proyecto con `pnpm db:migrate`.

### Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Servidor de desarrollo Next.js en modo watch |
| `pnpm build` | Build de producción |
| `pnpm start` | Servidor en modo producción (requiere `build` previo) |
| `pnpm test` | Suite de tests unitarios con Vitest |
| `pnpm test:watch` | Tests en modo watch |
| `pnpm db:migrate` | Aplica migraciones pendientes de Prisma |
| `pnpm db:generate` | Regenera el cliente Prisma (tras cambios en `schema.prisma`) |
| `pnpm db:studio` | Abre Prisma Studio para inspeccionar la DB visualmente |
| `pnpm lint` | Ejecuta ESLint sobre todo el proyecto |

---

## Esquema de datos

### Base de datos (SQLite via Prisma)

```prisma
model SeatMapDocument {
  id            String   @id @default(cuid())
  name          String
  schemaVersion Int      @default(1)
  dtoJson       String   // JSON del mapa completo serializado (TEXT en SQLite)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  isActive      Boolean  @default(false)
}
```

Solo existe un documento con `isActive = true` por sesión. El campo `dtoJson` almacena el DTO completo, lo que permite reconstruir el mapa sin pérdida de datos en cualquier momento.

### Modelo de dominio (TypeScript)

```
SeatMap
├── schemaVersion: 1
├── id: string (nanoid)
├── meta: { name, createdAt, updatedAt }
├── canvas: { width, height, grid: { enabled, size, snap } }
└── entities:
    ├── rows:   Record<string, Row>
    ├── tables: Record<string, Table>
    └── areas:  Record<string, Area>

Row
├── id, start: Point, end: Point
├── seatCount, seatSpacing, seatRadius
├── label
├── labeling: LabelingRule
└── seatOverrides: Record<number, { label }>

Table
├── id, center: Point, radius
├── seatCount, seatRadius
├── label
├── labeling: LabelingRule
└── seatOverrides: Record<number, { label }>

Area
├── id, points: Polygon (mínimo 3 puntos)
├── label
└── capacity: number

LabelingRule
├── template: string  (soporta {row}, {table}, {n})
├── startIndex: number
└── pad: number       (relleno con ceros, 0–8 dígitos)
```

### Flujo de importación / exportación

```
Archivo JSON
    ↓  JSON.parse
    ↓  parseAndMigrate  →  Zod + migración de schemaVersion
    ↓  dtoToDomain      →  mapper DTO → entidades de dominio
    ↓  validateMap      →  verifica invariantes de negocio
    →  SeatMap válido en store + persistido en SQLite

SeatMap (desde store)
    ↓  validateMap      →  bloquea export si hay errores
    ↓  domainToDto      →  mapper dominio → DTO serializable
    ↓  JSON.stringify
    →  Archivo seatmap.json descargable
```

---

## Librerías utilizadas

| Librería | Versión | Justificación |
|----------|---------|---------------|
| **Next.js** | 16 | Framework full-stack que unifica el cliente React con los Route Handlers del servidor, permitiendo usar Prisma en el backend sin exponer el cliente de DB al navegador. |
| **React** | 19 | UI declarativa con el modelo de componentes más maduro del ecosistema. |
| **react-konva / Konva** | 19 / 10 | Canvas 2D de alto rendimiento con modelo de objetos (Layer, Group, Shape) y manejo de eventos equivalente al DOM. Ideal para editores visuales interactivos sin la complejidad de WebGL. |
| **Zustand** | 5 | Store minimalista sin boilerplate. Los selectores evitan re-renders innecesarios. Compatible con el middleware Immer sin configuración extra. |
| **Immer** | 11 | Mutaciones de estado inmutable con sintaxis imperativa. Genera patches automáticos que se aprovechan directamente para implementar undo/redo. |
| **Zod** | 4 | Validación y parsing de DTOs de importación JSON. El tipado inferido (`z.infer`) elimina la duplicación entre schema en runtime y tipo TypeScript. |
| **Prisma** | 7 | ORM type-safe con cliente generado. Las migraciones son reproducibles y el schema es la fuente de verdad de la base de datos. |
| **better-sqlite3** | 12 | Driver SQLite síncrono y de alta performance. Perfecto para MVP local sin infraestructura de servidor de base de datos. |
| **nanoid** | 5 | Generación de IDs únicos compactos y URL-safe. Más liviano que UUID v4 para el volumen esperado de entidades. |
| **Tailwind CSS** | 4 | Utility-first CSS. Permite iterar la UI rápidamente sin cambiar entre archivos de estilos. |
| **Vitest** | 4 | Test runner compatible con el ecosistema Vite/ESM. Más rápido que Jest para proyectos TypeScript modernos. |

---

## Decisiones técnicas

### 1. Lógica de dominio completamente desacoplada de React
Todos los servicios del dominio (`geometry.ts`, `labeling.ts`, `validateMap.ts`) son funciones TypeScript puras sin imports de React ni de ninguna librería de UI. Esto permite:
- Testearlos de forma unitaria sin necesidad de montar componentes.
- Reutilizarlos en cualquier contexto: server, worker, tests de integración, CLI.

### 2. Command Pattern obligatorio para todas las mutaciones
No existe ningún `setState` directo que modifique el mapa. Toda mutación se expresa como un objeto serializable `{ type, payload }`. Ventajas concretas:
- El historial de undo/redo es automático: el store observa cada dispatch y apila los patches inverse/forward.
- Los comandos son testeables de forma completamente aislada.
- El código es auditable: se puede loguear la secuencia de comandos para debugging.

### 3. Filas rectas únicamente en el MVP
Las filas curvas tienen complejidad adicional en la geometría de posicionamiento de asientos y en los controles de edición interactivos. La arquitectura soporta extensión sin romper lo existente: el tipo `Row` puede extenderse con un campo `curve` opcional sin afectar los comandos ni los renderers actuales.

### 4. Los asientos derivados no se persisten como entidades
Los labels de asientos se computan en memoria a partir de la `LabelingRule` y los `seatOverrides` de cada `Row` o `Table`. Esto mantiene la base de datos normalizada y evita sincronizar entidades derivadas. Solo se persiste lo necesario para reconstruir el estado completo fielmente.

### 5. SQLite como base de datos por defecto
Se eligió SQLite via `better-sqlite3` por ser gratuita, sin servidor y sin configuración adicional. La arquitectura de repositorio permite reemplazarla por PostgreSQL (Neon, Supabase) modificando únicamente el `datasource` en `prisma/schema.prisma` y agregando la variable de entorno `DATABASE_URL`. El resto del código no cambia.

### 6. Un único mapa activo por sesión
El MVP mantiene un solo documento activo en la base de datos (`isActive = true`). Simplifica el bootstrap y el flujo de usuario. La arquitectura soporta múltiples mapas: el repositorio tiene `listMaps()` y `loadMap(id)` listos para conectar a una pantalla de gestión de proyectos.

### 7. Autosave con debounce de 1.5 s
Cada dispatch de comando reinicia un timer. Si no hay cambios nuevos en 1.5 segundos, se persiste automáticamente en background via `PATCH /api/seatmap/active`. El estado del guardado (`idle / pending / saved / error`) se refleja en la barra superior en tiempo real.

### 8. Validación bloqueante en importación y exportación
La importación rechaza JSON que no cumpla el schema Zod con errores específicos por campo. La exportación se bloquea si el mapa tiene errores de dominio (label vacío, polígono con menos de 3 puntos, etc.). Esto garantiza que el ciclo import → edit → export sea siempre lossless y que ningún archivo corrompido entre al sistema.

### 9. Path aliases obligatorios en todos los imports
Todos los imports usan aliases (`@domain/`, `@store/`, `@features/`, etc.) en lugar de rutas relativas profundas. El código es legible independientemente de la ubicación del archivo y es trivialmente refactorizable al mover módulos entre carpetas.

---

## Guía de uso

### Pantalla inicial
Al abrir la aplicación, se carga el mapa activo desde la base de datos. Si no existe ninguno, se genera automáticamente un mapa vacío. El layout tiene tres zonas:

- **Barra superior**: acciones globales (Nuevo, Importar, Exportar, Undo/Redo, controles de zoom).
- **Barra izquierda**: selector de herramienta activa.
- **Canvas central**: área de dibujo navegable.
- **Panel derecho**: inspector de propiedades de la entidad seleccionada.

### Herramientas del panel izquierdo

| Herramienta | Interacción |
|-------------|-------------|
| **Selección** | Clic para seleccionar. Shift+clic para selección múltiple. Arrastrar sobre espacio vacío para rectángulo de selección. |
| **Agregar fila** | Primer clic define el punto de inicio. Segundo clic define el final y crea la fila inmediatamente. |
| **Agregar mesa** | Un clic en el canvas coloca la mesa en esa posición. |
| **Agregar área** | Cada clic agrega un vértice al polígono. Doble-clic cierra el polígono y crea el área. |

### Panel inspector

Al seleccionar una entidad el panel muestra sus propiedades editables:

- **Fila**: label, cantidad de asientos, espaciado, radio. Editor de regla de etiquetado con template (`{row}-{n}`, `A{n}`, etc.), índice inicial y relleno con ceros. Al hacer clic sobre un asiento seleccionado, aparece el campo de override de label individual.
- **Mesa**: label, radio de mesa, cantidad de asientos, radio de cada asiento. Mismas opciones de regla de etiquetado y overrides individuales.
- **Área**: label, capacidad.

Con múltiples entidades seleccionadas el inspector muestra el conteo de la selección y el botón de eliminación batch.

### Eliminar entidades
Seleccionar una o más entidades y presionar `Delete` / `Backspace`, o usar el botón de eliminar en el inspector. Se muestra un diálogo de confirmación antes de proceder.

### Importar un JSON
Clic en **"Importar JSON"** en la barra superior → pegar el JSON en el cuadro de texto o subir un archivo → confirmar. Si el JSON contiene errores de schema se muestran en el diálogo con el campo exacto que falló.

### Exportar el mapa
Clic en **"Exportar JSON"**. El archivo `seatmap.json` se descarga automáticamente. Si el mapa contiene errores de validación, la exportación se bloquea y los errores se muestran en el panel de validación del inspector.

### Undo / Redo
Botones en la barra superior o `Ctrl+Z` / `Ctrl+Shift+Z`. Historial de hasta 100 acciones.

### Navegación del canvas
- **Rueda del mouse**: zoom centrado en la posición del cursor.
- **Clic y arrastre** sobre el fondo del canvas: desplazamiento (pan).
- **Botón "Ajustar vista"**: encuadra automáticamente todas las entidades visibles.
- Indicador de zoom con botones `−` y `+` para ajuste fino.

### Nuevo mapa
Clic en **"Nuevo mapa"**. Se solicita confirmación y el estado se resetea por completo (incluido el historial de undo).

---

## Puntos de mejora

### Funcionalidad pendiente
- **Mover entidades**: arrastrar filas, mesas y áreas con snap opcional a la grilla.
- **Handles de resize**: extender extremos de filas y modificar radio de mesas interactivamente.
- **Filas curvas**: geometría de arco con distribución uniforme de asientos.
- **Copiar / pegar**: duplicar bloques de entidades seleccionadas.
- **Múltiples mapas**: listado de proyectos con creación, renombramiento y eliminación.
- **Categorías de asientos**: asignar tipos (VIP, General, Accesible) y precios.

### Rendimiento
- **Virtualización del canvas**: para mapas con miles de asientos, renderizar únicamente las entidades visibles en el viewport actual usando bounding box culling.
- **Cálculo en WebWorker**: mover la derivación de posiciones de asientos y el hit-testing fuera del hilo principal para no bloquear la UI.

### UX / UI
- **Nombre de mapa editable inline**: campo editable en la barra superior sin necesidad de ir al inspector.
- **Tooltips y onboarding**: guía de primeros pasos para usuarios nuevos.
- **Temas de color**: modo claro y paletas personalizables para los asientos.
- **Panel de historial**: lista de acciones recientes con timestamps.

### Infraestructura
- **Base de datos remota**: migrar de SQLite a PostgreSQL (Neon o Supabase) para soporte multi-usuario. Solo requiere cambiar el `datasource` en `prisma/schema.prisma` y agregar `DATABASE_URL`.
- **Autenticación**: integrar NextAuth.js para sesiones de usuario y mapas privados.
- **Tests de integración**: cubrir los Route Handlers con tests de API.
- **CI/CD**: pipeline de GitHub Actions con lint + test + build en cada Pull Request.

---

## Supuestos asumidos

- El editor trabaja en unidades de mundo (world coordinates) independientes de los píxeles de pantalla. El zoom/pan es una transformación exclusivamente visual.
- `schemaVersion: 1` es la única versión del schema de exportación en el MVP. La infraestructura de migración (`parseAndMigrate`) está preparada para incorporar versiones futuras sin romper la compatibilidad hacia atrás.
- El autosave persiste el mapa completo serializado en un único campo JSON. Para un sistema productivo multi-usuario se recomendaría normalizar las entidades en tablas relacionales separadas.
- La aplicación está pensada para un único usuario en entorno local. No se implementa control de concurrencia ni bloqueo optimista.
