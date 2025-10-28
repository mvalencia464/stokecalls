import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Client-side Supabase client for authentication
// Uses the anon key (safe to expose in browser)
export const createBrowserClient = (): SupabaseClient => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });
};

// Singleton instance for browser
let browserClient: SupabaseClient | null = null;

export const getSupabaseBrowser = (): SupabaseClient => {
  if (typeof window === 'undefined') {
    throw new Error('getSupabaseBrowser can only be called in the browser');
  }

  if (!browserClient) {
    browserClient = createBrowserClient();
  }

  return browserClient;
};

