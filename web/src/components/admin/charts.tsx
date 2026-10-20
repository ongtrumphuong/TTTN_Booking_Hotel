// Biểu đồ vẽ bằng SVG thuần, render hoàn toàn ở máy chủ (không thêm thư viện, không cần JavaScript phía trình duyệt).

export function formatCompactVND(n: number) {
  if (n >= 1e9) return `${+(n / 1e9).toFixed(1)} tỷ`;
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)} tr`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(Math.round(n));
}

/** Làm tròn giá trị lớn nhất lên một mốc đẹp (1, 2, 5 × 10^k); chia 5 khoảng thì mỗi mốc là 0.2/0.4/1/2 × 10^k. */
export function niceMax(max: number) {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  const f = max / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

const W = 720;
const H = 240;
const M = { top: 12, right: 12, bottom: 28, left: 52 };
const PW = W - M.left - M.right;
const PH = H - M.top - M.bottom;
const TICKS = 5; // 5 khoảng chia: với mốc 1/2/5 × 10^k các nhãn trục luôn là số tròn

type Datum = { label: string; value: number; tooltip: string };

function Frame({ max, format, children, labels }: { max: number; format: (n: number) => string; children: React.ReactNode; labels: string[] }) {
  const step = Math.max(1, Math.ceil(labels.length / 8)); // chỉ hiện khoảng 8 nhãn ngày để không chồng chữ
  return (
    <>
      {Array.from({ length: TICKS + 1 }, (_, i) => {
        const y = M.top + PH - (i / TICKS) * PH;
        return (
          <g key={i}>
            <line x1={M.left} x2={W - M.right} y1={y} y2={y} className="stroke-border" strokeWidth={1} />
            <text x={M.left - 8} y={y + 4} textAnchor="end" className="fill-muted" fontSize={11}>
              {format((max * i) / TICKS)}
            </text>
          </g>
        );
      })}
      {labels.map((l, i) =>
        i % step === 0 ? (
          <text key={i} x={M.left + ((i + 0.5) / labels.length) * PW} y={H - 8} textAnchor="middle" className="fill-muted" fontSize={11}>
            {l}
          </text>
        ) : null,
      )}
      {children}
    </>
  );
}

function DataTable({ caption, data, unit }: { caption: string; data: Datum[]; unit: string }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th>Ngày</th>
          <th>{unit}</th>
        </tr>
      </thead>
      <tbody>
        {data.map((d) => (
          <tr key={d.label}>
            <td>{d.label}</td>
            <td>{d.tooltip}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function BarChart({ data, title, unit, format }: { data: Datum[]; title: string; unit: string; format: (n: number) => string }) {
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const slot = PW / Math.max(1, data.length);
  const bar = Math.max(2, slot * 0.7);
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. Tổng ${format(total)}.`} className="h-auto w-full">
        <Frame max={max} format={format} labels={data.map((d) => d.label)}>
          {data.map((d, i) => {
            const h = (d.value / max) * PH;
            return (
              <rect key={d.label} x={M.left + i * slot + (slot - bar) / 2} y={M.top + PH - h} width={bar} height={Math.max(h, d.value > 0 ? 1 : 0)} rx={Math.min(3, bar / 2)} className="fill-brand">
                <title>{d.tooltip}</title>
              </rect>
            );
          })}
        </Frame>
      </svg>
      <DataTable caption={title} data={data} unit={unit} />
    </figure>
  );
}

export function AreaChart({ data, title, unit, format, max }: { data: Datum[]; title: string; unit: string; format: (n: number) => string; max: number }) {
  const n = Math.max(1, data.length);
  const x = (i: number) => M.left + ((i + 0.5) / n) * PW;
  const y = (v: number) => M.top + PH - (Math.min(v, max) / max) * PH;
  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const area = data.length ? `${line} L${x(data.length - 1).toFixed(1)},${M.top + PH} L${x(0).toFixed(1)},${M.top + PH} Z` : "";
  const avg = data.reduce((a, d) => a + d.value, 0) / n;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. Trung bình ${format(avg)}.`} className="h-auto w-full">
        <Frame max={max} format={format} labels={data.map((d) => d.label)}>
          <path d={area} className="fill-brand/15" />
          <path d={line} className="fill-none stroke-brand" strokeWidth={2} strokeLinejoin="round" />
          {data.map((d, i) => (
            <circle key={d.label} cx={x(i)} cy={y(d.value)} r={data.length > 40 ? 1.5 : 3} className="fill-brand">
              <title>{d.tooltip}</title>
            </circle>
          ))}
        </Frame>
      </svg>
      <DataTable caption={title} data={data} unit={unit} />
    </figure>
  );
}
