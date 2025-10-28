import { getSupabaseBrowser } from './supabase-client';

/**
 * Authenticated fetch wrapper for API calls
 * Automatically adds the user's auth token to requests
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}) {
  const supabase = getSupabaseBrowser();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);

  return fetch(url, {
    ...options,
    headers,
  });
}

