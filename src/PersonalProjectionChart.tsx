import { useState, type KeyboardEvent, type TouchEvent } from "react";
import {
  Area, CartesianGrid, Line, ComposedChart, ReferenceDot, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { money, monthLabel } from "./engine";

type Point = { date: string; balance: number };
type Hover = { activeTooltipIndex?: number | string | null };

export default function PersonalProjectionChart({ points }: { points: Point[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const index = selected == null ? points.length - 1 : Math.max(0, Math.min(points.length - 1, selected));
  const active = points[index];

  const move = (event: Hover | undefined) => {
    if (event?.activeTooltipIndex == null) return;
    const n = Number(event.activeTooltipIndex);
    if (Number.isInteger(n) && n >= 0 && n < points.length) setSelected(n);
  };
  const touch = (event: TouchEvent<HTMLDivElement>) => {
    const finger = event.touches[0];
    const svg = event.currentTarget.querySelector<SVGSVGElement>(".recharts-surface");
    if (!finger || !svg || points.length < 2) return;
    const rect = svg.getBoundingClientRect();
    const coordinateWidth = Number(svg.getAttribute("width")) || rect.width;
    const scale = rect.width / coordinateWidth;
    const plotLine = event.currentTarget.querySelector<SVGLineElement>(".recharts-cartesian-grid-horizontal line");
    const left = rect.left + (plotLine ? Number(plotLine.getAttribute("x1")) : 54) * scale;
    const right = rect.left + (plotLine ? Number(plotLine.getAttribute("x2")) : coordinateWidth - 9) * scale;
    const ratio = Math.max(0, Math.min(1, (finger.clientX - left) / Math.max(1, right - left)));
    setSelected(Math.round(ratio * (points.length - 1)));
  };
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft","ArrowRight","Home","End"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home") setSelected(0);
    else if (event.key === "End") setSelected(points.length - 1);
    else setSelected(Math.min(points.length - 1, Math.max(0, index + (event.key === "ArrowRight" ? 1 : -1))));
  };
  if (!active) return <p className="muted">Aucune projection disponible.</p>;

  const tickInterval = Math.max(1, Math.floor(points.length / 4));
  const ticks = points.filter((_,i) => i % tickInterval === 0 || i === points.length - 1).map(p => p.date);
  return (
    <div className="personal-projection-interactive">
      <div className="personal-projection-chart" role="slider" tabIndex={0}
        aria-label="Parcourir les dates de la projection personnelle"
        aria-valuemin={0} aria-valuemax={points.length - 1}
        aria-valuenow={index} aria-valuetext={monthLabel(active.date)}
        onKeyDown={keyboard} onTouchStart={touch} onTouchMove={touch}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{top:13,right:10,left:0,bottom:4}}
            onMouseMove={move} onClick={move}>
            <defs><linearGradient id="wimm-glass-personal-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9478ee" stopOpacity={0.24}/>
              <stop offset="100%" stopColor="#9478ee" stopOpacity={0}/>
            </linearGradient></defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.55}/>
            <XAxis dataKey="date" ticks={ticks} tickFormatter={v=>monthLabel(String(v)).replace(/^(.)/,c=>c.toUpperCase())}
              tickLine={false} axisLine={false} minTickGap={19} tick={{fill:"var(--muted)",fontSize:10}}/>
            <YAxis width={55} tickFormatter={v=>Math.round(Number(v)/100)+" €"}
              tickLine={false} axisLine={false} tick={{fill:"var(--muted)",fontSize:11}}/>
            <Tooltip content={()=>null} isAnimationActive={false}/>
            {selected !== null && <ReferenceLine x={active.date} stroke="#a4adb7" strokeDasharray="3 5"/>}
            <Area type="monotone" dataKey="balance" fill="url(#wimm-glass-personal-area)"
              stroke="none" fillOpacity={1} legendType="none" activeDot={false} isAnimationActive={false}/>
            <Line type="monotone" dataKey="balance" stroke="#8266dc" strokeWidth={3.2}
              dot={false} activeDot={{r:5}} isAnimationActive={false}/>
            {selected !== null && <ReferenceDot x={active.date} y={active.balance} r={5}
              fill="#8266dc" stroke="var(--surface)" strokeWidth={2}/>}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="personal-projection-readout">
        <span>{monthLabel(active.date)}</span>
        <strong>{money(active.balance)}</strong>
      </div>
      <p className="personal-projection-help">Touchez ou faites glisser votre doigt sur la courbe pour consulter un autre mois.</p>
    </div>
  );
}
