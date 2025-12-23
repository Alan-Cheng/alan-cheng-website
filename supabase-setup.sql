-- Supabase 留言板資料庫設定
-- 請在 Supabase Dashboard > SQL Editor 中執行此 SQL

-- 1. 建立 comments 資料表
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id TEXT NOT NULL,
  article_name TEXT NOT NULL, -- 文章名稱
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE -- 用於回覆功能（可選）
);

-- 2. 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_comments_article_id ON comments(article_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id) WHERE parent_id IS NOT NULL;

-- 3. 啟用 Row Level Security (RLS)
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- 4. 設定 RLS 政策：所有人都可以讀取留言
CREATE POLICY "任何人都可以讀取留言"
  ON comments
  FOR SELECT
  USING (true);

-- 5. 設定 RLS 政策：所有人都可以新增留言（不需要登入）
CREATE POLICY "任何人都可以新增留言"
  ON comments
  FOR INSERT
  WITH CHECK (true);

-- 6. 如果資料表已經存在但沒有 article_name 欄位，請執行以下 SQL 來添加：
--    注意：如果資料表中已有資料，建議先添加為可選欄位，然後手動更新現有資料
-- ALTER TABLE comments ADD COLUMN IF NOT EXISTS article_name TEXT;
-- 更新現有資料（根據你的需求設定預設值）
-- UPDATE comments SET article_name = '' WHERE article_name IS NULL;
-- 然後再設定為 NOT NULL（如果需要的話）
-- ALTER TABLE comments ALTER COLUMN article_name SET NOT NULL;

-- ============================================
-- 文章管理系統資料表
-- ============================================

-- 1. 建立 articles 資料表
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  date DATE,
  cat TEXT,
  preview TEXT,
  is_pinned BOOLEAN DEFAULT false,
  pin_message TEXT,
  status TEXT DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT
);

-- 2. 建立 article_history 資料表（編輯歷史記錄）
CREATE TABLE IF NOT EXISTS article_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT,
  changed_fields JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT
);

-- 3. 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_date ON articles(date DESC);
CREATE INDEX IF NOT EXISTS idx_articles_is_pinned ON articles(is_pinned) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_article_history_article_id ON article_history(article_id);
CREATE INDEX IF NOT EXISTS idx_article_history_created_at ON article_history(created_at DESC);

-- 4. 啟用 Row Level Security (RLS)
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_history ENABLE ROW LEVEL SECURITY;

-- 5. 設定 articles 表的 RLS 政策
-- 所有人都可以讀取已發布的文章
CREATE POLICY "任何人都可以讀取已發布的文章"
  ON articles
  FOR SELECT
  USING (status = 'published');

-- 管理員可以讀取所有文章（包括草稿）
-- 注意：這需要在後台使用 service_role key 或自定義驗證邏輯
-- 這裡先設定為允許所有人讀取（後台會用不同的 client）
CREATE POLICY "管理員可以讀取所有文章"
  ON articles
  FOR SELECT
  USING (true);

-- 管理員可以新增文章
-- 注意：實際使用時需要透過後台驗證，這裡先設定為允許所有人
-- 建議在後台使用 service_role key 或建立自定義 policy
CREATE POLICY "管理員可以新增文章"
  ON articles
  FOR INSERT
  WITH CHECK (true);

-- 管理員可以更新文章
CREATE POLICY "管理員可以更新文章"
  ON articles
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 管理員可以刪除文章
CREATE POLICY "管理員可以刪除文章"
  ON articles
  FOR DELETE
  USING (true);

-- 6. 設定 article_history 表的 RLS 政策
-- 管理員可以讀取歷史記錄
CREATE POLICY "管理員可以讀取歷史記錄"
  ON article_history
  FOR SELECT
  USING (true);

-- 管理員可以新增歷史記錄
CREATE POLICY "管理員可以新增歷史記錄"
  ON article_history
  FOR INSERT
  WITH CHECK (true);

-- 7. 建立更新 updated_at 的觸發器函數
CREATE OR REPLACE FUNCTION update_articles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. 建立觸發器，自動更新 updated_at
CREATE TRIGGER trigger_update_articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION update_articles_updated_at();

-- 9. 建立編輯歷史記錄的觸發器函數
CREATE OR REPLACE FUNCTION create_article_history()
RETURNS TRIGGER AS $$
DECLARE
  changed_fields JSONB := '{}'::JSONB;
BEGIN
  -- 記錄變更的欄位
  IF OLD.title IS DISTINCT FROM NEW.title THEN
    changed_fields := changed_fields || jsonb_build_object('title', jsonb_build_object('old', OLD.title, 'new', NEW.title));
  END IF;
  
  IF OLD.content IS DISTINCT FROM NEW.content THEN
    changed_fields := changed_fields || jsonb_build_object('content', jsonb_build_object('changed', true));
  END IF;
  
  IF OLD.date IS DISTINCT FROM NEW.date THEN
    changed_fields := changed_fields || jsonb_build_object('date', jsonb_build_object('old', OLD.date, 'new', NEW.date));
  END IF;
  
  IF OLD.cat IS DISTINCT FROM NEW.cat THEN
    changed_fields := changed_fields || jsonb_build_object('cat', jsonb_build_object('old', OLD.cat, 'new', NEW.cat));
  END IF;
  
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    changed_fields := changed_fields || jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status));
  END IF;
  
  IF OLD.is_pinned IS DISTINCT FROM NEW.is_pinned THEN
    changed_fields := changed_fields || jsonb_build_object('is_pinned', jsonb_build_object('old', OLD.is_pinned, 'new', NEW.is_pinned));
  END IF;
  
  -- 只有在有變更時才建立歷史記錄
  IF changed_fields != '{}'::JSONB THEN
    INSERT INTO article_history (article_id, title, content, changed_fields, created_by)
    VALUES (NEW.id, NEW.title, NEW.content, changed_fields, NEW.created_by);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. 建立觸發器，自動記錄編輯歷史
CREATE TRIGGER trigger_create_article_history
  AFTER UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION create_article_history();

-- ============================================
-- 完成！現在你的資料表已經設定好了
-- 記得在 Supabase Dashboard > Settings > API 中找到你的：
-- - Project URL (VITE_SUPABASE_URL)
-- - anon/public key (VITE_SUPABASE_ANON_KEY)
-- - service_role key (VITE_SUPABASE_SERVICE_ROLE_KEY) - 用於後台管理
-- ============================================

