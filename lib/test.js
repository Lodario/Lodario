import 'dotenv/config'
import { supabase } from './supabase.js'

async function run() {
  const { data, error } = await supabase.from('test').select('*')
  console.log("DATA:", data)
  console.log("ERROR:", error)
}

run()