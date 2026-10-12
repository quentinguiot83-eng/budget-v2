import { useState } from "react";
import { Bookmark, Sparkles, X } from "lucide-react";
import { money, type State } from "./engine";
import { checkFavorite, quickSuggestions } from "./quickEntry";
import "./quickEntry.css";

type Props = {
  state: State;
  type: "expense" | "income";
  values: Record<string, string>;
  apply: (values: Record<string, string>) => void;
  removeFavorite: (id: string) => Promise<void>;
};

/** Shortcuts live inside the existing Add expense/income form, not in a separate form. */
export default function TransactionQuickAssist({ state, type, values, apply, removeFavorite }: Props) {
  const [removed, setRemoved] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const isSimple = type === "income" || values.expenseKind === "once";
  const accounts = state.accounts.filter(a => !a.archived && a.group === "current");
  const categories = state.categories.filter(c => !c.archived);
  const favorites = (state.quickFavorites || []).filter(f => f.type === type && !removed.includes(f.id));
  const input = values.description?.trim() || "";
  const suggestions = input.length >= 2 ? quickSuggestions(state, type, input, 4) : [];

  if (!isSimple) return null;

  function pick(item: { description: string; account: string; category?: string; amount: number; id?: string }) {
    const validAccount = accounts.some(a => a.id === item.account);
    if (!validAccount) return;
    const validCategory = item.category && categories.some(c => c.id === item.category);
    const source = item.id ? state.transactions.find(t => t.id === item.id) : undefined;
    apply({
      description: item.description,
      account: item.account,
      ...(type === "expense" && validCategory ? { category: item.category! } : {}),
      ...(type === "income" && source?.incomeType ? { incomeType: source.incomeType } : {}),
      // Recurring merchant suggestions never guess an amount.
      ...(item.id ? { amount: (item.amount / 100).toFixed(2) } : {}),
    });
  }

  async function remove(id: string) {
    setRemoving(id);
    setError("");
    try {
      await removeFavorite(id);
      setRemoved(old => [...old, id]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de retirer ce favori.");
    } finally {
      setRemoving(null);
    }
  }

  return <div className="wimm-inline-entry-assist" aria-label="Suggestions de saisie">
    {favorites.length > 0 && <div className="wimm-quick-favorites">
      <strong><Bookmark size={15} /> Mes favoris</strong>
      <div className="wimm-quick-pills">
        {favorites.map(f => {
          let valid = true;
          try { checkFavorite(f, state.accounts, state.categories); } catch { valid = false; }
          return <span className="wimm-quick-favorite" key={f.id}>
            <button type="button" disabled={!valid || !!removing} onClick={() => pick(f)}
              title={valid ? "Préremplir · " + money(f.amount) : "Compte ou catégorie indisponible"}>
              {f.description}
            </button>
            <button type="button" disabled={!!removing} aria-label={"Retirer " + f.description + " des favoris"}
              title="Retirer ce favori" onClick={() => void remove(f.id)}><X size={13}/></button>
          </span>;
        })}
      </div>
    </div>}
    {suggestions.length > 0 && <div className="wimm-quick-suggestions">
      <strong><Sparkles size={15} /> Suggestions de l’historique</strong>
      <div className="wimm-quick-pills">
        {suggestions.map(s => <button type="button" key={s.account + ":" + s.description}
          onClick={() => pick(s)} title="Reprendre le libellé, le compte et la catégorie">
          {s.description}{s.count > 1 && <small> ×{s.count}</small>}
        </button>)}
      </div>
      <small>Le montant reste à saisir : il n’est jamais estimé à partir des anciens achats.</small>
    </div>}
    {error && <p className="error" role="alert">{error}</p>}
  </div>;
}
