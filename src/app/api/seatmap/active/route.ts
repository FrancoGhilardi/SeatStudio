import { NextResponse, type NextRequest } from "next/server";
import { seatMapRepository } from "@infrastructure/repos/seatMap.repo.impl";
import { domainToDto } from "@infrastructure/mappers/map.mapper";
import {
  getActiveSeatMap,
  saveActiveSeatMap,
} from "@application/usecases/seatmap";

export const runtime = "nodejs"; // SQLite requiere Node.js runtime

// GET  /api/seatmap/active  → devuelve el mapa activo (o null)
export async function GET(): Promise<NextResponse> {
  try {
    const map = await getActiveSeatMap(seatMapRepository);
    if (!map) {
      return NextResponse.json({ map: null }, { status: 200 });
    }
    // Los datos fueron validados al escribir; no re-validamos en lectura.
    return NextResponse.json({ map: domainToDto(map) }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT  /api/seatmap/active  → importa y guarda un JSON como mapa activo
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await request.json();
    const result = await saveActiveSeatMap(seatMapRepository, body);

    if (!result.ok) {
      return NextResponse.json({ errors: result.errors }, { status: 422 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
