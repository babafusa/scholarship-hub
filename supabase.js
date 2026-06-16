/**
 * supabase.js — ScholarHub
 * Correct anon key — fixed.
 */

const SUPABASE_URL = "https://waatqodbyddpudgjifuk.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhYXRxb2RieWRkcHVkZ2ppZnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NjgyNTEsImV4cCI6MjA5NzA0NDI1MX0.nnNwIJCRiuHypiSjPl5ZRDiu-NOABUsBg13tPahkWvo";

let _client = null;

function getClient() {
  if (_client) return _client;
  if (!window.supabase) throw new Error("Supabase SDK not loaded.");
  _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  return _client;
}

window.DB = {
  async select(table, paramsStr) {
    const client = getClient();
    let query = client.from(table).select("*");

    if (paramsStr) {
      const params = new URLSearchParams(paramsStr);

      if (params.get("limit"))
        query = query.limit(parseInt(params.get("limit")));

      const orderParam = params.get("order");
      if (orderParam) {
        const parts = orderParam.split(".");
        const col = parts[0];
        const asc = parts[1] !== "desc";
        query = query.order(col, { ascending: asc });
      }

      for (const [key, val] of params.entries()) {
        if (key === "order" || key === "limit") continue;
        if (val.startsWith("eq.")) {
          const filterVal = val.slice(3);
          const parsed =
            filterVal === "true"
              ? true
              : filterVal === "false"
                ? false
                : filterVal;
          query = query.eq(key, parsed);
        }
        if (val.startsWith("neq.")) {
          query = query.neq(key, val.slice(4));
        }
      }
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  },

  async insert(table, body) {
    const { data, error } = await getClient().from(table).insert(body).select();
    if (error) throw new Error(error.message);
    return data;
  },

  async update(table, id, body) {
    const { data, error } = await getClient()
      .from(table)
      .update(body)
      .eq("id", id)
      .select();
    if (error) throw new Error(error.message);
    return data;
  },

  async delete(table, id) {
    const { error } = await getClient().from(table).delete().eq("id", id);
    if (error) throw new Error(error.message);
    return null;
  },
};

window.Auth = {
  async signIn(email, password) {
    const { data, error } = await getClient().auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async signOut() {
    await getClient().auth.signOut();
  },

  async getUser() {
    const { data } = await getClient().auth.getUser();
    return data?.user || null;
  },

  async isLoggedIn() {
    const { data } = await getClient().auth.getSession();
    return !!data?.session;
  },
};
