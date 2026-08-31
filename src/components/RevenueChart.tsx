"use client";

import { BarChart3, ChartNoAxesColumnIncreasing } from "lucide-react";
import type { DailyClosingRecord } from "@/types/cashflow";
import { formatIDR } from "@/lib/utils";

type ChartType = "bar" | "line";

export function RevenueChart({ month, closings, type, onTypeChange }: {
  month: string;
  closings: DailyClosingRecord[];
  type: ChartType;
  onTypeChange: (type: ChartType) => void;
}) {
  const points = closings
    .filter(closing => closing.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(closing => ({ day: Number(closing.date.slice(-2)), value: closing.manualIncome }));
  const monthName = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${month}-01T00:00:00.000Z`));
  const max = Math.max(1, ...points.map(point => point.value));
  const width = 480;
  const height = 190;
  const left = 18;
  const bottom = 166;
  const chartHeight = 126;
  const step = points.length > 1 ? (width - 52) / (points.length - 1) : 0;
  const barWidth = points.length > 1 ? Math.max(5, Math.min(24, step * 0.62)) : 24;
  const coordinates = points.map((point, index) => ({
    ...point,
    x: points.length === 1 ? width / 2 : left + index * step,
    y: bottom - point.value / max * chartHeight,
  }));

  return <section className="revenue-chart-card">
    <div className="chart-heading">
      <div><span>STATISTIK OMSET</span><h3>Omset harian</h3></div>
      <div className="chart-toggle" aria-label="Jenis grafik">
        <button type="button" aria-pressed={type === "bar"} onClick={() => onTypeChange("bar")}><ChartNoAxesColumnIncreasing size={15}/> Bar</button>
        <button type="button" aria-pressed={type === "line"} onClick={() => onTypeChange("line")}><BarChart3 size={15}/> Line</button>
      </div>
    </div>
    {points.length ? <>
      <div className="chart-summary"><span>Omset tertinggi</span><strong>{formatIDR(max)}</strong></div>
      <svg className="revenue-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Grafik omset harian ${monthName}`}>
        <line x1="18" y1={bottom} x2={width - 18} y2={bottom} className="chart-axis"/>
        {type === "bar" ? coordinates.map(point => <g key={point.day}>
          <rect x={point.x - barWidth / 2} y={point.y} width={barWidth} height={Math.max(2, bottom - point.y)} rx={Math.min(6, barWidth / 2)} className="chart-bar"/>
          <text x={point.x} y="184" textAnchor="middle">{point.day}</text>
        </g>) : <>
          <polyline points={coordinates.map(point => `${point.x},${point.y}`).join(" ")} className="chart-line"/>
          {coordinates.map(point => <g key={point.day}><circle cx={point.x} cy={point.y} r="5" className="chart-point"/><text x={point.x} y="184" textAnchor="middle">{point.day}</text></g>)}
        </>}
      </svg>
    </> : <div className="chart-empty"><ChartNoAxesColumnIncreasing size={24}/><strong>Belum ada data omset</strong><p>Simpan tutup buku harian untuk mulai melihat tren bulan ini.</p></div>}
  </section>;
}
