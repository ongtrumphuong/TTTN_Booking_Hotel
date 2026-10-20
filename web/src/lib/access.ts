import "server-only";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";

type Actor = Pick<SessionUser, "id" | "role">;

/** Quản trị viên quản lý mọi khách sạn; đối tác chỉ quản lý khách sạn do mình sở hữu. */
export async function canManageHotel(user: Actor, hotelId: string): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  if (user.role !== "HOST") return false;
  return (await prisma.hotel.count({ where: { id: hotelId, ownerId: user.id } })) > 0;
}

export async function canManageRoom(user: Actor, roomId: string): Promise<boolean> {
  const room = await prisma.room.findUnique({ where: { id: roomId }, select: { hotelId: true } });
  return !!room && (await canManageHotel(user, room.hotelId));
}

export async function canManageBooking(user: Actor, bookingId: string): Promise<boolean> {
  const b = await prisma.booking.findUnique({ where: { id: bookingId }, select: { room: { select: { hotelId: true } } } });
  return !!b && (await canManageHotel(user, b.room.hotelId));
}

export const NO_ACCESS = "Bạn không có quyền thực hiện thao tác này.";

/** Đường dẫn gốc của khu vực quản lý theo vai trò. */
export const baseFor = (user: Actor) => (user.role === "ADMIN" ? "/admin" : "/host");
