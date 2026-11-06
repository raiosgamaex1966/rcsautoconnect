// Supabase client configuration
// Explicitly forces pqantnebpappnanvuluu to prevent any stale build / env var misconfigurations
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// SEMPRE garantir o projeto correto do Supabase: pqantnebpappnanvuluu
export const SUPABASE_URL = (envUrl && !envUrl.includes("ldsbmiwfkrvsgpmgcgfv"))
  ? envUrl
  : "https://pqantnebpappnanvuluu.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY = (envKey && envUrl && !envUrl.includes("ldsbmiwfkrvsgpmgcgfv"))
  ? envKey
  : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxYW50bmVicGFwcG5hbnZ1bHV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTA0NDcsImV4cCI6MjA5MDcyNjQ0N30.mZR4NL0r6EYmxEeeqFyad2Um9BsLxcuhTtczLg12lw0";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
