// Single source of truth for the Supabase connection.
// Was previously copy-pasted (URL + anon key) into index.html, admin.html and
// cashier.html separately — now defined once here.
//
// Relies on the classic supabase-js UMD build already being loaded via
// `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>`
// in the page's <head> (before this module script), which defines `window.supabase`.

export const SUPABASE_URL = 'https://omyucnjkqeyomtvijqwc.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9teXVjbmprcWV5b210dmlqcXdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1NTQ0NDUsImV4cCI6MjEwNDEzMDQ0NX0.jc8WAbBIpMCDzdLCf3RYk9ruLbInBJ7unmnr2u1SEkA';

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
