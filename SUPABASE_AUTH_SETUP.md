# Supabase Auth 設定指南

## 改用 Supabase Auth 登入

現在後台管理系統使用 Supabase Auth 進行登入，更安全且符合最佳實踐。

## 設定步驟

### 1. 在 Supabase Dashboard 建立管理員用戶

有兩種方式：

#### 方法 A：透過 Dashboard 建立（推薦）

1. 進入 Supabase Dashboard > **Authentication** > **Users**
2. 點擊 **Add user** > **Create new user**
3. 輸入：
   - **Email**: 你的管理員電子郵件（例如：`admin@example.com`）
   - **Password**: 設定一個強密碼
4. 點擊 **Create user**

#### 方法 B：使用 SQL 建立

在 Supabase Dashboard > SQL Editor 中執行：

```sql
-- 建立管理員用戶（需要先啟用 Supabase Auth）
-- 注意：這需要在 Supabase Dashboard > Authentication > Settings 中啟用 Email Auth
```

### 2. 確認 Email Auth 已啟用

1. 進入 Supabase Dashboard > **Authentication** > **Providers**
2. 確認 **Email** provider 已啟用
3. 如果需要，可以關閉 **Enable email confirmations**（方便測試，生產環境建議開啟）

### 3. 環境變數設定

**前端環境變數（`.env.local`）**：

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

**注意**：
- ✅ **不再需要 `VITE_ADMIN_PASSWORD`**
- ✅ **不再需要 `VITE_SUPABASE_SERVICE_ROLE_KEY`**（只存在於 Edge Function）

**Edge Function 環境變數（Supabase Dashboard）**：

在 Supabase Dashboard > Project Settings > Edge Functions > Secrets 中設定：

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**注意**：
- ✅ **不再需要 `ADMIN_PASSWORD`**（現在使用 Supabase Auth）

## 使用方式

### 登入後台

1. 訪問 `#admin` 路由
2. 輸入在 Supabase Dashboard 中建立的管理員用戶的：
   - **電子郵件**
   - **密碼**
3. 點擊登入

### 登出

點擊後台右上角的「登出」按鈕。

## 安全性改進

### 使用 Supabase Auth 的優點

1. ✅ **標準的 JWT 認證**：使用業界標準的 JWT token
2. ✅ **自動 token 管理**：Supabase 自動處理 token 刷新
3. ✅ **更安全**：不需要在前端儲存密碼或自定義 token
4. ✅ **可擴展**：未來可以輕鬆加入多個管理員
5. ✅ **Edge Function 驗證**：Edge Function 可以直接驗證 JWT token

### Edge Function 認證流程

1. 前端使用 Supabase Auth 登入，獲得 JWT access_token
2. 前端將 access_token 放在 `Authorization: Bearer <token>` header 中
3. Edge Function 使用 Supabase Admin 客戶端驗證 JWT token
4. 驗證通過後執行操作

## 故障排除

### 問題：登入失敗

**檢查**：
1. 確認用戶已在 Supabase Dashboard 中建立
2. 確認 Email Auth 已啟用
3. 檢查瀏覽器 Console 是否有錯誤訊息
4. 確認環境變數 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY` 已設定

### 問題：Edge Function 返回 401

**檢查**：
1. 確認已成功登入（檢查 localStorage 中是否有 Supabase session）
2. 確認 Edge Function 已重新部署（使用新的認證邏輯）
3. 檢查 Edge Function 日誌是否有錯誤

### 問題：忘記密碼

在 Supabase Dashboard > Authentication > Users 中：
1. 找到對應的用戶
2. 點擊 **Reset password** 或手動更新密碼

## 進階設定（可選）

### 限制只有特定 email 可以登入

在 Edge Function 中可以加入額外的檢查：

```typescript
// 檢查用戶 email 是否為管理員
const adminEmails = ['admin@example.com'];
if (!adminEmails.includes(user.email)) {
  return new Response(JSON.stringify({ error: '未授權：非管理員用戶' }), {
    status: 403,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

### 使用 User Metadata 標記管理員

1. 在 Supabase Dashboard > Authentication > Users 中
2. 編輯用戶的 **User Metadata**，加入 `{ "role": "admin" }`
3. 在 Edge Function 中檢查 `user.user_metadata.role === 'admin'`


