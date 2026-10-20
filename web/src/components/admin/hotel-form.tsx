"use client";

import { useActionState } from "react";
import { createHotelAction, updateHotelAction, type AdminState } from "@/app/actions/admin";

type Hotel = {
  id: string;
  name: string;
  city: string;
  address: string;
  starRating: number;
  description: string;
  images: string[];
  amenities: string[];
  latitude: number | null;
  longitude: number | null;
};

const input = "w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const label = "mb-1.5 block text-sm font-semibold";

export function HotelForm({ hotel }: { hotel?: Hotel }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(
    hotel ? updateHotelAction.bind(null, hotel.id) : createHotelAction,
    {},
  );

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-border bg-white p-6">
      {state.error && <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{state.error}</div>}
      {state.ok && <div role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">Đã lưu thay đổi.</div>}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="name" className={label}>Tên khách sạn</label>
          <input id="name" name="name" required defaultValue={hotel?.name} className={input} />
        </div>
        <div>
          <label htmlFor="city" className={label}>Thành phố</label>
          <input id="city" name="city" required defaultValue={hotel?.city} className={input} />
        </div>
        <div>
          <label htmlFor="starRating" className={label}>Hạng sao</label>
          <select id="starRating" name="starRating" defaultValue={hotel?.starRating ?? 3} className={input}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} sao</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label htmlFor="address" className={label}>Địa chỉ</label>
          <input id="address" name="address" required defaultValue={hotel?.address} className={input} />
        </div>
        <div>
          <label htmlFor="latitude" className={label}>Vĩ độ (không bắt buộc)</label>
          <input id="latitude" name="latitude" type="number" step="any" defaultValue={hotel?.latitude ?? ""} className={input} />
        </div>
        <div>
          <label htmlFor="longitude" className={label}>Kinh độ (không bắt buộc)</label>
          <input id="longitude" name="longitude" type="number" step="any" defaultValue={hotel?.longitude ?? ""} className={input} />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="description" className={label}>Mô tả</label>
          <textarea id="description" name="description" rows={4} required defaultValue={hotel?.description} className={input} />
        </div>
        <div>
          <label htmlFor="images" className={label}>Ảnh (mỗi dòng một URL https)</label>
          <textarea id="images" name="images" rows={5} required defaultValue={hotel?.images.join("\n")} className={`${input} font-mono text-xs`} />
          <p className="mt-1 text-xs text-muted">Chấp nhận: picsum.photos, images.unsplash.com</p>
        </div>
        <div>
          <label htmlFor="amenities" className={label}>Tiện nghi (cách nhau bằng dấu phẩy hoặc xuống dòng)</label>
          <textarea id="amenities" name="amenities" rows={5} defaultValue={hotel?.amenities.join(", ")} className={input} />
        </div>
      </div>

      <button type="submit" disabled={pending} className="rounded-xl bg-brand px-6 py-2.5 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-60">
        {pending ? "Đang lưu..." : hotel ? "Lưu thay đổi" : "Tạo khách sạn"}
      </button>
    </form>
  );
}
