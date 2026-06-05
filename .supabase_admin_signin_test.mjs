import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue;
  const [key, value] = line.split('=', 2);
  env[key] = value.replace(/^"|"$/g, '');
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY);
const email = 'admin123@gmail.com';
const password = 'Admin@2026#Hub';
const res = await supabase.auth.signInWithPassword({ email, password });
console.log(JSON.stringify(res, null, 2));
