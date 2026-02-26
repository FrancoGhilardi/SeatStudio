import { NextResponse } from "next/server";
import { seatMapRepository } from "@infrastructure/repos/seatMap.repo.impl";
import { domainToDto } from "@infrastructure/mappers/map.mapper";
import { resetActiveSeatMap } from "@application/usecases/seatmap";

export const runtime = "nodejs"; // SQLite requiere Node.js runtime (no Edge)

// POST /api/seatmap/new → resetea el mapa activo a uno vacío válido
export async function POST(): Promise<NextResponse> {
  try {
    const map = await resetActiveSeatMap(seatMapRepository);
    return NextResponse.json({ map: domainToDto(map) }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
