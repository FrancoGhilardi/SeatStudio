import path from "path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma-client/client";

// Ampliar el tipo de `globalThis` para TypeScript estricto
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * Resuelve la ruta absoluta del archivo SQLite a partir de DATABASE_URL.
 *
 * Soporta el formato `file:<ruta>` de Prisma/SQLite.
 * Si la variable de entorno no está definida, cae en el default de desarrollo.
 */
function resolveDbPath(): string {
  const url = process.env["DATABASE_URL"] ?? "file:./prisma/dev.db";
  // Elimina el prefijo "file:" y resuelve relativo a cwd
  const filePath = url.replace(/^file:/, "");
  return path.resolve(process.cwd(), filePath);
}

/**
 * Singleton de PrismaClient para evitar múltiples conexiones durante HMR en dev.
 *
 * Prisma 7 con `provider = "prisma-client"` requiere un driver adapter.
 * Usamos `@prisma/adapter-better-sqlite3` para SQLite en-proceso.
 *
 * IMPORTANTE: Este módulo sólo debe importarse en código server-side
 * (Route Handlers, Server Actions). Nunca en componentes de cliente.
 */
export function createPrismaClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: resolveDbPath() });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalThis.__prisma ?? createPrismaClient();

if (process.env["NODE_ENV"] !== "production") {
  globalThis.__prisma = prisma;
}
