import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 網站基礎 URL
const BASE_URL = 'https://alan-cheng.com';

// 載入環境變數檔案
function loadEnvFile() {
  const envFiles = [
    path.join(__dirname, '..', '.env.local'),
    path.join(__dirname, '..', '.env')
  ];
  
  for (const envPath of envFiles) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
            if (!process.env[key.trim()]) {
              process.env[key.trim()] = value;
            }
          }
        }
      }
      return true;
    }
  }
  return false;
}

// 初始化 Supabase 客戶端
function initSupabase() {
  loadEnvFile();
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Supabase 環境變數未設定，將使用本地檔案作為資料來源');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseAnonKey);
}

const supabase = initSupabase();

// 從 markdown 內容中提取第一張圖片 URL
function extractFirstImageFromMarkdown(markdown: string): string | null {
  if (!markdown) return null;

  const imagePatterns = [
    /!\[.*?\]\((.*?)\)/,  // ![alt](url)
    /<img[^>]+src=["']([^"']+)["'][^>]*>/i,  // <img src="url">
  ];

  for (const pattern of imagePatterns) {
    const match = markdown.match(pattern);
    if (match && match[1]) {
      let imageUrl = match[1].trim();
      return imageUrl;
    }
  }

  return null;
}

// 將相對路徑轉換為絕對 URL
function normalizeImageUrl(imageUrl: string | null): string {
  if (!imageUrl) {
    return `${BASE_URL}/avatar.png`;
  }

  // 如果已經是絕對 URL，直接返回
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  // 如果是相對路徑，轉換為絕對 URL
  if (imageUrl.startsWith('/')) {
    return `${BASE_URL}${imageUrl}`;
  }

  // 其他情況，假設是相對於根目錄
  return `${BASE_URL}/${imageUrl}`;
}

// 讀取文章內容（優先從 Supabase，失敗則從本地檔案）
async function loadArticleContent(articleId: string): Promise<string | null> {
  // 優先從 Supabase 讀取
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('articles')
        .select('content')
        .eq('id', articleId)
        .eq('status', 'published')
        .single();

      if (!error && data && data.content) {
        return data.content;
      }
    } catch (error) {
      console.warn(`⚠️ 從 Supabase 讀取文章 "${articleId}" 失敗:`, error);
    }
  }

  // 回退到讀取本地檔案
  const postsDir = path.join(__dirname, '../posts');
  const filePath = path.join(postsDir, `${articleId}.md`);

  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8');
  }

  return null;
}

// 生成文章的 HTML 文件
function generateArticleHTML(article: {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  url: string; // SPA 路由 URL（用於重定向）
  prerenderUrl: string; // 預渲染 URL（用於 canonical 和 og:url）
}): string {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  
  <!-- Primary Meta Tags -->
  <title>Alan Cheng 的文章 | ${escapeHtml(article.title)}</title>
  <meta name="title" content="Alan Cheng 的文章 | ${escapeHtml(article.title)}" />
  <meta name="description" content="${escapeHtml(article.description)}" />
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${escapeHtml(article.prerenderUrl)}" />
  <meta property="og:title" content="${escapeHtml(article.title)} | 鄭人瑄 (Alan Cheng) - 文章" />
  <meta property="og:description" content="${escapeHtml(article.description)}" />
  <meta property="og:image" content="${escapeHtml(article.imageUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="zh_TW" />
  <meta property="og:site_name" content="Alan Cheng - 個人網站" />
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(article.title)}" />
  <meta name="twitter:description" content="${escapeHtml(article.description)}" />
  <meta name="twitter:image" content="${escapeHtml(article.imageUrl)}" />
  
  <!-- Canonical URL -->
  <link rel="canonical" href="${escapeHtml(article.prerenderUrl)}" />
  
  <!-- Redirect to SPA -->
  <script>
    // 立即重定向到 SPA 路由
    window.location.replace('${escapeHtml(article.url)}');
  </script>
  
  <!-- Fallback for non-JS browsers -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(article.url)}" />
</head>
<body>
  <p>正在載入文章：<a href="${escapeHtml(article.url)}">${escapeHtml(article.title)}</a></p>
</body>
</html>`;
}

// HTML 轉義函數
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// 主函數
async function prerenderArticles() {
  console.log('🚀 開始預渲染文章...');

  let metadata: Array<{
    id: string;
    title: string;
    date?: string | null;
    cat?: string | null;
    preview?: string | null;
    path?: string;
    isPinned?: boolean;
    pinMessage?: string | null;
  }> = [];

  // 優先從 Supabase 讀取 metadata
  if (supabase) {
    try {
      console.log('📦 嘗試從 Supabase 載入文章 metadata...');
      const { data, error } = await supabase
        .from('articles')
        .select('id, title, date, cat, preview, is_pinned, pin_message')
        .eq('status', 'published')
        .order('date', { ascending: false, nullsFirst: false });

      if (!error && data && data.length > 0) {
        console.log(`✅ 已從 Supabase 載入 ${data.length} 篇文章的 metadata`);
        metadata = data.map((item) => ({
          id: item.id,
          title: item.title,
          date: item.date || undefined,
          cat: item.cat || undefined,
          preview: item.preview || undefined,
          isPinned: Boolean(item.is_pinned),
          pinMessage: item.pin_message ?? undefined,
        }));
      }
    } catch (error) {
      console.warn('⚠️ 從 Supabase 讀取 metadata 失敗:', error);
    }
  }

  // 如果 Supabase 查詢失敗或未配置，回退到讀取本地 JSON 檔案
  if (metadata.length === 0) {
    console.log('📦 回退到讀取本地 JSON 檔案...');
    const metadataPath = path.join(__dirname, '../public/articles-metadata.json');
    if (!fs.existsSync(metadataPath)) {
      console.error('❌ 找不到 articles-metadata.json 文件');
      process.exit(1);
    }

    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8')) as Array<{
      id: string;
      title: string;
      date?: string | null;
      cat?: string | null;
      preview?: string | null;
      path?: string;
      isPinned?: boolean;
      pinMessage?: string | null;
    }>;
    console.log(`✅ 已從本地 JSON 檔案載入 ${metadata.length} 篇文章的 metadata`);
  }

  console.log(`📚 總共找到 ${metadata.length} 篇文章`);

  // 確定輸出目錄（優先使用 dist，如果不存在則使用 public）
  const distDir = path.join(__dirname, '../dist');
  const publicDir = path.join(__dirname, '../public');
  
  let outputDir: string;
  if (fs.existsSync(distDir)) {
    outputDir = distDir;
    console.log('📁 使用 dist 目錄作為輸出目錄（生產模式）');
  } else {
    outputDir = publicDir;
    console.log('📁 使用 public 目錄作為輸出目錄（開發模式）');
    // 確保 public 目錄存在
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
  }

  const articlesDir = path.join(outputDir, 'articles');
  if (!fs.existsSync(articlesDir)) {
    fs.mkdirSync(articlesDir, { recursive: true });
  }

  let successCount = 0;
  let errorCount = 0;

  // 為每篇文章生成 HTML
  for (const article of metadata) {
    try {
      const articleId = article.id;
      // 使用 /articles/{id}/ 作為預渲染 URL，這樣爬蟲可以直接訪問
      const prerenderUrl = `${BASE_URL}/articles/${encodeURIComponent(articleId)}/`;
      // SPA 路由 URL（用於重定向）
      const spaUrl = `${BASE_URL}/#articles/${encodeURIComponent(articleId)}`;
      
      // 獲取文章描述
      const description = article.pinMessage || article.preview || `閱讀文章：${article.title}`;
      
      // 嘗試從文章內容中提取圖片
      let imageUrl = `${BASE_URL}/avatar.png`; // 預設圖片
      const articleContent = await loadArticleContent(articleId);
      if (articleContent) {
        const firstImage = extractFirstImageFromMarkdown(articleContent);
        if (firstImage) {
          imageUrl = normalizeImageUrl(firstImage);
        }
      }

      // 生成 HTML
      const html = generateArticleHTML({
        id: articleId,
        title: article.title,
        description: description.substring(0, 200), // 限制長度
        imageUrl,
        url: spaUrl, // 重定向到 SPA 路由
        prerenderUrl, // 預渲染 URL（用於 canonical）
      });

      // 為每篇文章創建目錄
      const articleOutputDir = path.join(articlesDir, articleId);
      if (!fs.existsSync(articleOutputDir)) {
        fs.mkdirSync(articleOutputDir, { recursive: true });
      }

      // 寫入 HTML 文件
      const outputPath = path.join(articleOutputDir, 'index.html');
      fs.writeFileSync(outputPath, html, 'utf-8');

      console.log(`✅ 已生成: ${articleId}`);
      successCount++;
    } catch (error) {
      console.error(`❌ 處理文章 "${article.id}" 時發生錯誤:`, error);
      errorCount++;
    }
  }

  console.log(`\n✨ 預渲染完成！`);
  console.log(`   ✅ 成功: ${successCount} 篇`);
  if (errorCount > 0) {
    console.log(`   ❌ 失敗: ${errorCount} 篇`);
  }
}

// 執行
prerenderArticles().catch((error) => {
  console.error('❌ 預渲染過程發生錯誤:', error);
  process.exit(1);
});
