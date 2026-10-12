import type { Account, Category, State, Tx } from "./engine";
import { normalizeBankLabel } from "./bankImport";

export type QuickFavorite = {
  id: string;
  type: "expense" | "income";
  description: string;
  account: string;
  category?: string;
  amount: number;
};
export type EntrySuggestion = { description:string; account:string; category?:string; amount:number; count:number };
/** Uses existing history, never AI or a bank connection, and never writes automatically. */
export function quickSuggestions(state:State,type:"expense"|"income",search="",limit=5):EntrySuggestion[]{
  const accounts=new Set(state.accounts.filter(a=>!a.archived&&a.group==="current").map(a=>a.id));
  const categories=new Set(state.categories.filter(c=>!c.archived).map(c=>c.id));
  const query=normalizeBankLabel(search);
  const collected=new Map<string,EntrySuggestion>();
  const ordered=[...state.transactions].filter(t=>t.type===type&&!t.dueKey&&!t.trip&&!t.fixed&&accounts.has(t.account)&&!!t.description.trim())
    .sort((a,b)=>b.date.localeCompare(a.date));
  for(const t of ordered){
    const canonical=normalizeBankLabel(t.description);
    if(query&&!canonical.includes(query))continue;
    if(!canonical)continue;
    const key=canonical+":"+t.account;
    const previous=collected.get(key);
    if(previous){previous.count++;continue;}
    collected.set(key,{description:t.description,account:t.account,
      category:t.category&&categories.has(t.category)?t.category:undefined,
      amount:t.amount,count:1});
  }
  return [...collected.values()].sort((a,b)=>b.count-a.count).slice(0,limit);
}
export function checkFavorite(f:QuickFavorite,accounts:Account[],categories:Category[]){
  if(!f.id||!["expense","income"].includes(f.type)||!f.description.trim()||f.description.length>180)
    throw Error("Favori invalide.");
  if(!accounts.some(a=>a.id===f.account&&!a.archived&&a.group==="current"))
    throw Error("Le compte du favori n’est plus disponible.");
  if(f.type==="expense"&&(!f.category||!categories.some(c=>c.id===f.category&&!c.archived)))
    throw Error("La catégorie de ce favori n’est plus disponible.");
  if(!Number.isSafeInteger(f.amount)||f.amount<=0)throw Error("Montant du favori invalide.");
}
export function favoriteFromTransaction(t:Tx):QuickFavorite{
  if((t.type!=="expense"&&t.type!=="income")||t.dueKey||t.trip||t.fixed)
    throw Error("Seules les dépenses et revenus ponctuels peuvent être ajoutés aux favoris.");
  return {id:t.id,type:t.type,description:t.description,account:t.account,category:t.category,amount:t.amount};
}
