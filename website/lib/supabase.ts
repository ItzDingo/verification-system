import { createClient } from '@supabase/supabase-js';

// Set NEXT_PUBLIC_SUPABASE_* and SUPABASE_SERVICE_ROLE_KEY in .env.local (see repo .env.example).
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnon =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
const supabaseService =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key';

export const supabaseClient = createClient(supabaseUrl, supabaseAnon);
export const supabaseServer = createClient(supabaseUrl, supabaseService);
