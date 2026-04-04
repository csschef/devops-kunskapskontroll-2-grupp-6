import { supabase } from "./api-service.js";

function requireSupabaseConfig() {
    if (!supabase) throw new Error("Supabase är inte konfigurerat. Ange VITE_SUPABASE_URL och VITE_SUPABASE_ANON_KEY.");
}

export async function getCurrentSession() {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
}

export async function signInWithPassword({ email, password }) {
    requireSupabaseConfig();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

export async function signUp({ email, password, options }) {
    requireSupabaseConfig();
    const { data, error } = await supabase.auth.signUp({ email, password, options });
    if (error) throw error;
    return data;
}

export async function ensureProfileRow() {
    requireSupabaseConfig();
    const { data: { user }, error: userError, } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error("Ingen inloggad användare hittades.");

    const firstName = String(user.user_metadata?.first_name || "").trim();
    const lastName = String(user.user_metadata?.last_name || "").trim();
    const fullNameFromParts = `${firstName} ${lastName}`.trim();
    const profileName = fullNameFromParts || String(user.user_metadata?.name || "").trim() || user.email || "Användare";
    const profilePayload = { id: user.id, email: user.email, name: profileName, };
    const { error } = await supabase.from("profiles").upsert(profilePayload, { onConflict: "id" });

    if (error) throw error;
}

export async function getMyProfile() {
    requireSupabaseConfig();
    const { data: { user }, error: userError, } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) return null;
    const { data, error } = await supabase.from("profiles").select("id, email, name, created_at").eq("id", user.id).maybeSingle();
    if (error) throw error;
    return data;
}

export async function signOut() {
    requireSupabaseConfig();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

export function onAuthStateChange(callback) {
    if (!supabase) {
        return {
            data: {
                subscription: {
                    unsubscribe: () => {},
                },
            },
        };
    }

  return supabase.auth.onAuthStateChange(callback);
}
