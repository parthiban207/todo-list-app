import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Use service role key if available (server-side only, bypasses RLS)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL env variable.');
}

const keyToUse = supabaseServiceKey || supabaseAnonKey;
if (!keyToUse) {
  throw new Error('Missing Supabase Service Role Key or Anon Key.');
}

export const supabaseAdmin = createClient(supabaseUrl, keyToUse, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

/**
 * Creates a Supabase client authenticated with the user's access token.
 * This allows the server-side client to act as the authenticated user,
 * satisfying RLS policies that check auth.uid().
 */
export function createAuthenticatedClient(accessToken: string): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase URL or Anon Key.');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

/**
 * Returns an authenticated Supabase client if an access token is provided,
 * otherwise falls back to the admin client (which uses service role key or anon key).
 */
export function getSupabaseClient(accessToken?: string | null): SupabaseClient {
  if (accessToken) {
    return createAuthenticatedClient(accessToken);
  }
  return supabaseAdmin;
}
