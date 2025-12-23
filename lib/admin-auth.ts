// 後台身份驗證系統
// 使用 Supabase Auth 進行登入

import { supabase } from './supabase';

// 登入（使用 email 和 password）
export async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || '登入失敗' };
  }
}

// 登出
export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

// 檢查是否已登入
export async function isAuthenticated(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}

// 獲取當前用戶
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// 獲取 session（包含 access_token）
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// 獲取 access token（用於 API 請求）
export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  return session?.access_token || null;
}
