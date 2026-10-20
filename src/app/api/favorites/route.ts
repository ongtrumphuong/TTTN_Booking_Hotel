import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ loggedIn: false, ids: [] }, { headers: { "Cache-Control": "no-store" } });

  const rows = await prisma.favorite.findMany({ where: { userId: user.id }, select: { hotelId: true } });
  return NextResponse.json(
    { loggedIn: true, ids: rows.map((r) => r.hotelId) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
