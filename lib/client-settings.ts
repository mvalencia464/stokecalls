import { createClient } from '@supabase/supabase-js';

// Server-side function to get client settings for a user
export async function getClientSettings(userId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase
    .from('client_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No settings found - user hasn't configured yet
      return null;
    }
    throw error;
  }

  return data;
}

// Server-side function to save client settings
export async function saveClientSettings(
  userId: string,
  ghlLocationId: string,
  ghlAccessToken: string
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Upsert (insert or update)
  const { data, error } = await supabase
    .from('client_settings')
    .upsert(
      {
        user_id: userId,
        ghl_location_id: ghlLocationId,
        ghl_access_token: ghlAccessToken,
      },
      {
        onConflict: 'user_id',
      }
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

// Client-side function to get current user's settings
export async function getMyClientSettings(supabase: any) {
  const { data, error } = await supabase
    .from('client_settings')
    .select('*')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No settings found
      return null;
    }
    throw error;
  }

  return data;
}

// Client-side function to save current user's settings
export async function saveMyClientSettings(
  supabase: any,
  ghlLocationId: string,
  ghlAccessToken: string
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('client_settings')
    .upsert(
      {
        user_id: user.id,
        ghl_location_id: ghlLocationId,
        ghl_access_token: ghlAccessToken,
      },
      {
        onConflict: 'user_id',
      }
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export interface ClientSettings {
  id: string;
  user_id: string;
  ghl_location_id: string;
  ghl_access_token: string;
  created_at: string;
  updated_at: string;
}

