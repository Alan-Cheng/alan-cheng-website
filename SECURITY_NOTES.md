# 安全性說明

## ⚠️ 重要安全警告

### Service Role Key 的使用

目前實作中，`VITE_SUPABASE_SERVICE_ROLE_KEY` 被用在前端代碼中，這**不安全**，因為：

1. **Vite 會將所有 `VITE_` 開頭的環境變數打包到前端**
   - 任何人都可以在瀏覽器的開發者工具中看到這個 key
   - Service Role Key 具有完整資料庫權限，非常危險

2. **目前的使用位置**：
   - `lib/supabase.ts`：建立管理員客戶端
   - `scripts/migrate-articles-to-supabase.js`：遷移腳本（這個是安全的，因為是 Node.js 腳本）

## 🔒 安全改進方案

### 方案 1：使用 Supabase Edge Function（推薦）

建立 Edge Function 作為後端 API，在前端只呼叫 API，不直接使用 service_role key。

**優點**：
- Service Role Key 只存在於後端
- 可以加入額外的驗證邏輯
- 更安全

**步驟**：
1. 在 `supabase/functions/admin-api/` 建立 Edge Function
2. 在 Edge Function 中使用 service_role key
3. 前端透過 HTTP 請求呼叫 Edge Function
4. Edge Function 驗證管理員身份後執行操作

### 方案 2：使用 Supabase Auth + 自定義 RLS

使用 Supabase 的認證系統，配合自定義的 RLS 政策。

**步驟**：
1. 建立管理員用戶表
2. 使用 Supabase Auth 進行登入
3. 在 RLS 政策中檢查用戶是否為管理員
4. 前端使用 anon key，但透過 RLS 政策限制權限

### 方案 3：暫時方案（僅供開發使用）

如果暫時需要快速使用，可以：

1. **不要將 `VITE_SUPABASE_SERVICE_ROLE_KEY` 加入版本控制**
   - 確保 `.env` 在 `.gitignore` 中
   - 不要將 key 提交到 Git

2. **限制 RLS 政策**
   - 雖然前端可以看到 key，但可以透過 IP 白名單或其他方式限制訪問

3. **定期輪換 key**
   - 定期在 Supabase Dashboard 中重新生成 service_role key

## 📝 目前實作的限制

- ✅ 開發環境：可以使用，但需注意安全
- ❌ 生產環境：**不建議**，應該改用 Edge Function 或 Supabase Auth

## 🚀 遷移腳本的安全性

`scripts/migrate-articles-to-supabase.js` 使用 service_role key 是**安全的**，因為：
- 這是 Node.js 腳本，不會被打包到前端
- 只在本地執行，不會暴露給用戶

## 建議

對於個人專案或開發環境，目前的實作可以暫時使用，但請：
1. 確保 `.env` 檔案不會被提交到 Git
2. 定期檢查是否有安全漏洞
3. 考慮在生產環境中改用 Edge Function


