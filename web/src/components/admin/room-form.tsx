"use client";

import { useActionState } from "react";
import { createRoomAction, updateRoomAction, type AdminState } from "@/app/actions/admin";
import { ImageUploader } from "./image-uploader";

type Room = {
  id: string;
  name: string;
  description: string;
  pricePerNight: number;
  capacity: number;
  bedType: string;
  sizeM2: number | null;
  quantity: number;
  images: string[];
  amenities: string[];
};

const input = "w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const label = "mb-1 block text-xs font-semibold text-muted";

export function RoomForm({ hotelId, room }: { hotelId: string; room?: Room }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(
    room ? updateRoomAction.bind(null, room.id) : createRoomAction.bind(null, hotelId),
    {},
  );
  // Sau khi tạo mới thành công, đổi key để form tự xóa dữ liệu đã nhập.
  const key = !room && state.ok ? "done" : "form";

  return (
    <form key={key} action={action} className="grid gap-3 sm:grid-cols-2">
      {state.error && <div role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 sm:col-span-2">{state.error}</div>}
      {state.ok && <div role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 sm:col-span-2">{room ? "Đã lưu." : "Đã thêm phòng."}</div>}

      <div className="sm:col-span-2">
        <label className={label}>Tên loại phòng</label>
        <input name="name" required defaultValue={room?.name} className={input} />
      </div>
      <div>
        <label className={label}>Giá mỗi đêm (₫)</label>
        <input name="pricePerNight" type="number" min={10000} step={1000} required defaultValue={room?.pricePerNight} className={input} />
      </div>
      <div>
        <label className={label}>Loại giường</label>
        <input name="bedType" required defaultValue={room?.bedType} placeholder="1 giường đôi" className={input} />
      </div>
      <div>
        <label className={label}>Sức chứa (khách)</label>
        <input name="capacity" type="number" min={1} max={10} required defaultValue={room?.capacity ?? 2} className={input} />
      </div>
      <div>
        <label className={label}>Số phòng hiện có</label>
        <input name="quantity" type="number" min={1} max={200} required defaultValue={room?.quantity ?? 1} className={input} />
      </div>
      <div>
        <label className={label}>Diện tích (m²)</label>
        <input name="sizeM2" type="number" min={1} defaultValue={room?.sizeM2 ?? ""} className={input} />
      </div>
      <div>
        <label className={label}>Tiện nghi (cách nhau bằng dấu phẩy)</label>
        <input name="amenities" defaultValue={room?.amenities.join(", ")} className={input} />
      </div>
      <div className="sm:col-span-2">
        <label className={label}>Mô tả</label>
        <textarea name="description" rows={2} required defaultValue={room?.description} className={input} />
      </div>
      <div className="sm:col-span-2">
        <span className={label}>Ảnh phòng</span>
        <ImageUploader initial={room?.images ?? []} />
      </div>
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className="rounded-xl bg-brand px-5 py-2 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-60">
          {pending ? "Đang lưu..." : room ? "Lưu phòng" : "Thêm phòng"}
        </button>
      </div>
    </form>
  );
}
