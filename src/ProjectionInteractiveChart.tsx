import { useMemo, useState, type KeyboardEvent, type TouchEvent } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { monthLabel, type project } from "./engine";

type ProjectionPoint = ReturnType<typeof project>[number];
type ChartPoint = ProjectionPoint & { globalGross: number; globalNet: number };
type EventState = { activeTooltipIndex?: number | string | null };
const roundedEuros = (cents: number) => Math.round(cents / 100).toLocaleString("fr-FR") + " €";

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
          <ComposedChart data={data} margin={{ top: 18, right: 11, left: 0, bottom: 4 }}
            onMouseMove={selectFrom} onClick={selectFrom}>
            <defs>
              <linearGradient id="wimm-aurora-wealth-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4eac8d" stopOpacity={0.21}/>
                <stop offset="70%" stopColor="#4eac8d" stopOpacity={0.07}/>
                <stop offset="100%" stopColor="#4eac8d" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.48}/>
            <XAxis dataKey="date" ticks={ticks} tickFormatter={v=>String(v).slice(0,4)}
              tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={13}/>
            <YAxis width={49} tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false}
              axisLine={false} tickFormatter={n => String(Math.round(Number(n)/100000)) + " k€"}/>
            <Tooltip content={() => null} isAnimationActive={false}/>
            {selection !== null && (
              <ReferenceLine x={active.date} stroke="#71b8a0" strokeOpacity={0.68} strokeWidth={1.3} strokeDasharray="3 6"/>
            )}
            <Area type="monotone" name="Surface patrimoine" dataKey="globalGross"
              stroke="none" fill="url(#wimm-aurora-wealth-fill)" fillOpacity={1}
              activeDot={false} isAnimationActive={false} legendType="none"/>
            <Line type="monotone" name="Patrimoine total" dataKey="globalGross" stroke="#338c71" strokeWidth={3.6}
              strokeLinecap="round" strokeLinejoin="round"
              dot={false} activeDot={{r:6, stroke:"#fff", strokeWidth:2.5, fill:"#338c71"}} isAnimationActive={false}/>
            <Line type="monotone" name="Épargne voyage" dataKey="travel" stroke="#8585da" strokeWidth={3}
              strokeLinecap="round" strokeLinejoin="round"
              dot={false} activeDot={{r:5, stroke:"#fff", strokeWidth:2, fill:"#8585da"}} isAnimationActive={false}/>
            <Line type="monotone" name="Patrimoine après fiscalité" dataKey="globalNet" stroke="#9ba2b2"
              strokeWidth={2.2} strokeDasharray="5 7" strokeLinecap="round"
              dot={false} activeDot={{r:4, stroke:"#fff", strokeWidth:2, fill:"#9ba2b2"}} isAnimationActive={false}/>
            {selection !== null && (
              <>
                <ReferenceDot x={active.date} y={active.globalGross} r={12} fill="#69bca0" fillOpacity={0.2} stroke="none"/>
                <ReferenceDot x={active.date} y={active.globalGross} r={5.5} fill="#338c71" stroke="var(--surface)" strokeWidth={2.5}/>
                <ReferenceDot x={active.date} y={active.globalNet} r={4} fill="#9ba2b2" stroke="var(--surface)" strokeWidth={2}/>
                <ReferenceDot x={active.date} y={active.travel} r={4.5} fill="#8585da" stroke="var(--surface)" strokeWidth={2}/>
              </>
            )}
          </ComposedChart>
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
          <small>Glissez sur la courbe pour explorer</small>
        </div>
        <div className="projection-chart-reading-values">
          <div className="projection-reading-gross"><span>Patrimoine total</span><strong>{roundedEuros(active.globalGross)}</strong></div>
          <div className="projection-reading-net"><span>Après fiscalité</span><strong>{roundedEuros(active.globalNet)}</strong></div>
          <div className="projection-reading-travel"><span>Épargne voyage</span><strong>{roundedEuros(active.travel)}</strong></div>
        </div>
      </div>
    </div>
  );
}
