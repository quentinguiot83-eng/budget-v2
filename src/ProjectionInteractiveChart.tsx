import { useMemo, useState, type KeyboardEvent, type TouchEvent } from "react";
import { CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { monthLabel, type project } from "./engine";
import { projectionMoney } from "./projectionMoney";

type ProjectionPoint = ReturnType<typeof project>[number];
type ChartPoint = ProjectionPoint & { globalGross: number; globalNet: number };
type EventState = { activeTooltipIndex?: number | string | null };

export default function ProjectionInteractiveChart({ points }: { points: ProjectionPoint[] }) {
  const data = useMemo<ChartPoint[]>(() => points.map(p => ({
    ...p,
    // Voyages are already included in the total and must not be double counted.
    globalGross: p.current + p.wealth + p.travel,
    globalNet: p.current + p.wealthNet + p.travel,
  })), [points]);
  const [selection, setSelection] = useState<number | null>(null);
  const index = selection !== null && selection >= 0 && selection < data.length ? selection : data.length - 1;
  const active = data[index];
  const ticks = useMemo(() => {
    if (!data.length) return [];
    const initialYear = Number(data[0].date.slice(0, 4));
    const endYear = Number(data[data.length - 1].date.slice(0, 4));
    const stride = Math.max(1, Math.ceil((endYear - initialYear) / 5));
    const keys = [data[0].date];
    let lastYear = initialYear;
    data.forEach(p => {
      const year = Number(p.date.slice(0, 4));
      if (p.date.endsWith("-01") && year !== lastYear && ((year - initialYear) % stride === 0)) {
        keys.push(p.date);
        lastYear = year;
      }
    });
    const final = data[data.length - 1].date;
    if (!keys.some(v => v.slice(0, 4) === final.slice(0, 4))) keys.push(final);
    return keys;
  }, [data]);
  const selectFrom = (event: EventState | undefined) => {
    if (!event || event.activeTooltipIndex === undefined || event.activeTooltipIndex === null) return;
    const next = Number(event.activeTooltipIndex);
    if (Number.isInteger(next) && next >= 0 && next < data.length) setSelection(next);
  };
  // Recharts ne fournit pas systématiquement activeTooltipIndex sur Safari iOS.
  // On repère le doigt sur la zone du tracé pour synchroniser le mois affiché.
  const selectByTouch = (event: TouchEvent<HTMLDivElement>) => {
    const finger = event.touches[0];
    if (!finger || data.length < 2) return;
    const svg = event.currentTarget.querySelector<SVGSVGElement>(".recharts-surface");
    if (!svg) return;
    const bounds = svg.getBoundingClientRect();
    const drawnWidth = Number(svg.getAttribute("width")) || bounds.width;
    const scale = bounds.width / drawnWidth;
    const plotLine = event.currentTarget.querySelector<SVGLineElement>(".recharts-cartesian-grid-horizontal line");
    const left = bounds.left + (plotLine ? Number(plotLine.getAttribute("x1")) : 49) * scale;
    const right = bounds.left + (plotLine ? Number(plotLine.getAttribute("x2")) : drawnWidth - 10) * scale;
    const ratio = Math.max(0, Math.min(1, (finger.clientX - left) / Math.max(1, right - left)));
    setSelection(Math.round(ratio * (data.length - 1)));
  };
  const selectByKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const key = event.key;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(key)) return;
    event.preventDefault();
    if (key === "Home") setSelection(0);
    else if (key === "End") setSelection(Math.max(0, data.length - 1));
    else setSelection(Math.max(0, Math.min(data.length - 1, index + (key === "ArrowRight" ? 1 : -1))));
  };
  if (!active) return <p className="muted">Les prévisions ne sont pas encore disponibles.</p>;

  return (
    <div className="projection-interactive">
      <div className="projection-chart-v2" role="slider" tabIndex={0}
        aria-label="Parcourir les mois de la projection"
        aria-valuemin={0} aria-valuemax={Math.max(0, data.length - 1)}
        aria-valuenow={index} aria-valuetext={monthLabel(active.date)}
        onKeyDown={selectByKeyboard} onTouchStart={selectByTouch} onTouchMove={selectByTouch}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 10, left: 0, bottom: 3 }}
            onMouseMove={selectFrom} onClick={selectFrom}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.8}/>
            <XAxis dataKey="date" ticks={ticks} tickFormatter={v=>String(v).slice(0,4)}
              tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={13}/>
            <YAxis width={49} tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false}
              axisLine={false} tickFormatter={n => String(Math.round(Number(n)/100000)) + " k€"}/>
            <Tooltip content={() => null} isAnimationActive={false}/>
            {selection !== null && (
              <ReferenceLine x={active.date} stroke="#a4adb7" strokeWidth={1.25} strokeDasharray="3 5"/>
            )}
            <Line type="monotone" name="Patrimoine total" dataKey="globalGross" stroke="#38866c" strokeWidth={3}
              dot={false} activeDot={{r:5}} isAnimationActive={false}/>
            <Line type="monotone" name="Épargne voyage" dataKey="travel" stroke="#7d8ed8" strokeWidth={2.7}
              dot={false} activeDot={{r:4}} isAnimationActive={false}/>
            <Line type="monotone" name="Patrimoine après fiscalité" dataKey="globalNet" stroke="#8e95a8"
              strokeWidth={2.4} strokeDasharray="7 6" dot={false} activeDot={{r:4}} isAnimationActive={false}/>
            {selection !== null && (
              <>
                <ReferenceDot x={active.date} y={active.globalGross} r={4.5} fill="#38866c" stroke="var(--surface)" strokeWidth={2}/>
                <ReferenceDot x={active.date} y={active.globalNet} r={4} fill="#8e95a8" stroke="var(--surface)" strokeWidth={2}/>
                <ReferenceDot x={active.date} y={active.travel} r={4} fill="#7d8ed8" stroke="var(--surface)" strokeWidth={2}/>
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="projection-legend-v2" aria-label="Légende du graphique">
        <span><i className="projection-legend-line gross"/> Patrimoine total</span>
        <span><i className="projection-legend-line net"/> Après fiscalité</span>
        <span><i className="projection-legend-line travel"/> Épargne voyage</span>
      </div>
      <div className="projection-chart-reading" aria-live="polite">
        <div className="projection-chart-reading-header">
          <strong>{monthLabel(active.date)}</strong>
          <small>Touchez le graphique pour explorer</small>
        </div>
        <div className="projection-chart-reading-values">
          <div><span>Patrimoine total</span><strong>{projectionMoney(active.globalGross)}</strong></div>
          <div><span>Après fiscalité</span><strong>{projectionMoney(active.globalNet)}</strong></div>
          <div><span>Dont épargne voyage</span><strong>{projectionMoney(active.travel)}</strong></div>
        </div>
      </div>
    </div>
  );
}
