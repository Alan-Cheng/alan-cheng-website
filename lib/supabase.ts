import { createClient } from '@supabase/supabase-js';

// 從環境變數讀取 Supabase 設定
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️ Supabase 環境變數未設定。請在 .env 檔案中設定 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY'
  );
}

// 創建 Supabase 客戶端（一般使用者）
export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
);

// 注意：後台管理現在使用 Edge Function API（lib/admin-api.ts）
// 不再直接使用 service_role key，更安全

