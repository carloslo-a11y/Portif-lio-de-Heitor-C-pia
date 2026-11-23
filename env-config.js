// ============================================================================
// Configuração pública do Supabase para o browser.
// ATENÇÃO: a anon key do Supabase é PÚBLICA por design (segura no frontend).
// Este arquivo é necessário porque o site é estático (sem node server.js),
// então o navegador precisa destas credenciais disponíveis no deploy.
//
// Fonte de verdade local: .env (gitignored).
// Para regenerar a partir do .env: npm run env:generate
// ============================================================================
window.__SUPABASE_URL__ = "https://yhbpdtooknnvpevhxtvt.supabase.co/rest/v1/";
window.__SUPABASE_ANON_KEY__ = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloYnBkdG9va25udnBldmh4dHZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMjA0MDksImV4cCI6MjEwNTU5NjQwOX0.Mtf8NdKG93HG5Bdp58bGs_SIkTXRYuVuKHd-kCeBaLEsb_publishable_QcfBILqMhKgv064PjrXW-w_NHxAy5Kb";