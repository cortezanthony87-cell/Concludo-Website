import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteApiPlugin } from './src/server/viteApiPlugin';

export default defineConfig(({ mode }) => {
  // Load environment variables from .env and .env.local
  const env = loadEnv(mode, process.cwd(), '');

  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '';
  const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || '';

  return {
    plugins: [react(), viteApiPlugin(supabaseUrl, supabaseServiceRoleKey)],
    base: '/',
    server: {
      host: '0.0.0.0',
      port: 3000,
    },
    define: {
      // Expose only SUPABASE_URL and SUPABASE_ANON_KEY to the client bundle
      // SUPABASE_SERVICE_ROLE_KEY is strictly excluded to prevent exposure in the browser
      'import.meta.env.SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
      'process.env.SUPABASE_URL': JSON.stringify(supabaseUrl),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
    },
  };
});
