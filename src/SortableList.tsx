import { useState, type ReactNode } from "react";
type Item = { date?: string; start?: string; description?: string; title?: string; name?: string; amount: number };
export function SortableList<T extends Item>({ items, children }: { items: T[]; children: (items: T[]) => ReactNode }) {
  const [sort, setSort] = useState("date-desc");
  const [limit, setLimit] = useState(50);
  const sorted = [...items].sort((a, b) => {
    const [key, direction] = sort.split("-");
    const value = key === "amount" ? Math.abs(a.amount) - Math.abs(b.amount) : key === "name" ? (a.description ?? a.title ?? a.name ?? "").localeCompare(b.description ?? b.title ?? b.name ?? "", "fr", { sensitivity: "base", numeric: true }) : (a.date ?? a.start ?? "").localeCompare(b.date ?? b.start ?? "");
    return (direction === "desc" ? -value : value);
  });
  return <>
    <label className="list-sort"><span>Trier par</span><select aria-label="Trier les dépenses" value={sort} onChange={e => { setSort(e.target.value); setLimit(50); }}>
      <option value="date-desc">Date · plus récentes</option><option value="date-asc">Date · plus anciennes</option>
      <option value="name-asc">Nom · A à Z</option><option value="name-desc">Nom · Z à A</option>
      <option value="amount-desc">Montant · décroissant</option><option value="amount-asc">Montant · croissant</option>
    </select></label>
    {children(sorted.slice(0, limit))}
    {sorted.length > limit && <button type="button" className="secondary" onClick={() => setLimit(n => n + 50)}>Afficher davantage</button>}
  </>;
}
