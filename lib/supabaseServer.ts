import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  // Do not throw here; let runtime handle missing env vars in API routes.
}

export const supabaseAdmin = createClient(url || '', serviceKey || '')
