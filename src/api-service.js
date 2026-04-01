import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)
// Can be imported and used in any file like: import { supabase } from './api-service.js'

// Example API function to fetch items from a "products" table in Supabase
/*
export async function getProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')

  return data
}
*/