import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Server-side auth helper for API routes
 * Verifies the user's session from the Authorization header
 */
export async function getServerSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  // Create a Supabase client with the anon key
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Get the access token from the Authorization header
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, session: null };
  }

  const token = authHeader.replace('Bearer ', '');

  // Verify the token
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { user: null, session: null };
  }

  return { user, session: { access_token: token } };
}

/**
 * Middleware to require authentication in API routes
 * Returns the user if authenticated, or throws an error response
 */
export async function requireAuth(request: NextRequest) {
  const { user } = await getServerSession(request);

  if (!user) {
    return {
      authenticated: false,
      user: null,
      error: { message: 'Unauthorized', status: 401 }
    };
  }

  return {
    authenticated: true,
    user,
    error: null
  };
}

