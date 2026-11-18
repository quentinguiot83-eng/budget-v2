import { createClient } from "@supabase/supabase-js";
import { DbError } from "./dbMessages";
export const api = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
export async function rpc(name: string, args?: Record<string, unknown>) {
  const { data, error } = await api.rpc(name, args);
  if (error)
    throw error.message.includes("Could not find")
      ? Error("La base de données doit être initialisée avec le script fourni.")
      : new DbError(error.message);
  if (data?.error) throw new DbError(data.error);
  return data;
}
