import { createClient } from "@supabase/supabase-js";
import { DEMO_MODE } from "./demoMode";
import { demoRpc } from "./demoRpc";
/** Demo builds never initialize a Supabase client or send network writes. */
const demoClient = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    updateUser: async () => ({ data: { user: null }, error: null }),
    signOut: async () => ({ error: null }),
  },
} as unknown as ReturnType<typeof createClient>;
export const api = DEMO_MODE
  ? demoClient
  : createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
export async function rpc(name: string, args?: Record<string, unknown>) {
  if (DEMO_MODE) return demoRpc(name, args);
  const { data, error } = await api.rpc(name, args);
  if (error)
    throw Error(error.message.includes("Could not find")
      ? "La base de données doit être initialisée avec le script fourni."
      : error.message);
  if (data?.error) throw Error(data.error);
  return data;
}
