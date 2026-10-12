import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { monthLabel, money, type project } from "./engine";

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
  if (!active) return <p className="muted">Les prévisions ne sont pas encore disponibles.</p>;

  return (
    <div className="projection-interactive">
      <div className="projection-chart-v2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 10, left: 0, bottom: 3 }}
            onMouseMove={selectFrom} onClick={selectFrom}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.8}/>
            <XAxis dataKey="date" ticks={ticks} tickFormatter={v=>String(v).slice(0,4)}
              tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={13}/>
            <YAxis width={49} tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false}
              axisLine={false} tickFormatter={n => String(Math.round(Number(n)/100000)) + " k€"}/>
            <Tooltip content={() => null} isAnimationActive={false}/>
            <Line type="monotone" name="Patrimoine total" dataKey="globalGross" stroke="#38866c" strokeWidth={3}
              dot={false} activeDot={{r:5}} isAnimationActive={false}/>
            <Line type="monotone" name="Épargne voyage" dataKey="travel" stroke="#7d8ed8" strokeWidth={2.7}
              dot={false} activeDot={{r:4}} isAnimationActive={false}/>
            <Line type="monotone" name="Patrimoine après fiscalité" dataKey="globalNet" stroke="#8e95a8"
              strokeWidth={2.4} strokeDasharray="7 6" dot={false} activeDot={{r:4}} isAnimationActive={false}/>
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
          <small>Faites glisser le curseur pour explorer</small>
        </div>
        <div className="projection-chart-reading-values">
          <div><span>Patrimoine total</span><strong>{money(active.globalGross)}</strong></div>
          <div><span>Après fiscalité</span><strong>{money(active.globalNet)}</strong></div>
          <div><span>Dont épargne voyage</span><strong>{money(active.travel)}</strong></div>
        </div>
        <input type="range" aria-label="Choisir le mois de la projection"
          min={0} max={Math.max(0, data.length - 1)} step={1} value={index}
          onChange={e => setSelection(Number(e.target.value))}/>
      </div>
      <p className="projection-chart-note">La courbe grise en pointillés représente l’estimation après fiscalité des placements. Les montants sont indicatifs.</p>
    </div>
  );
}
