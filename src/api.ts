import { createClient } from "@supabase/supabase-js";
export const api = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
export async function rpc(name: string, args?: Record<string, unknown>) {
  const { data, error } = await api.rpc(name, args);
  if (error)
    throw Error(
      error.message.includes("Could not find")
        ? "La base de données doit être initialisée avec le script fourni."
        : error.message,
    );
  if (data?.error) throw Error(data.error);
  return data;
}
