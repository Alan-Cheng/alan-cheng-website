import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 載入環境變數檔案
function loadEnvFile(envFilePath = null) {
  let envFiles = [];
  
  if (envFilePath) {
    // 如果指定了檔案路徑，使用指定的檔案
    const fullPath = path.isAbsolute(envFilePath) 
      ? envFilePath 
      : path.join(__dirname, '..', envFilePath);
    envFiles = [fullPath];
  } else {
    // 如果沒有指定，使用預設的檔案列表
    envFiles = [
      path.join(__dirname, '..', '.env.local'),
      path.join(__dirname, '..', '.env')
    ];
  }
  
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
      const relativePath = path.relative(path.join(__dirname, '..'), envPath);
      console.log(`✅ 已載入環境變數檔案: ${relativePath}`);
      return true;
    }
  }
  
  if (envFilePath) {
    console.error(`❌ 錯誤：找不到指定的環境變數檔案: ${envFilePath}`);
    process.exit(1);
  }
  
  return false;
}

// 解析命令行參數
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    envFile: null,
  };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--env' || args[i] === '-e') {
      if (i + 1 < args.length) {
        options.envFile = args[i + 1];
        i++;
      } else {
        console.error('❌ 錯誤：--env 參數需要指定檔案路徑');
        process.exit(1);
      }
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log('使用方法:');
      console.log('  node migrate-articles-to-supabase.js [選項]');
      console.log('');
      console.log('選項:');
      console.log('  --env, -e <檔案路徑>  指定環境變數檔案路徑（相對於專案根目錄或絕對路徑）');
      console.log('  --help, -h            顯示此幫助訊息');
      console.log('');
      console.log('範例:');
      console.log('  node migrate-articles-to-supabase.js');
      console.log('  node migrate-articles-to-supabase.js --env .env.production');
      console.log('  node migrate-articles-to-supabase.js -e /path/to/.env.custom');
      process.exit(0);
    }
  }
  
  return options;
}

// 解析命令行參數
const options = parseArgs();

// 載入環境變數
loadEnvFile(options.envFile);

// 從環境變數讀取 Supabase 設定
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ 錯誤：請在 .env.local 或 .env 檔案中設定以下環境變數：');
  console.error('   - VITE_SUPABASE_URL 或 SUPABASE_URL');
  console.error('   - VITE_SUPABASE_SERVICE_ROLE_KEY 或 SUPABASE_SERVICE_ROLE_KEY');
  console.error('');
  console.error('💡 提示：');
  console.error('   1. 檢查 .env.local 檔案是否存在');
  console.error('   2. 確認環境變數名稱是否正確');
  console.error('   3. 確認環境變數值沒有多餘的空格或引號');
  process.exit(1);
}

// 創建 Supabase 客戶端（使用 service_role key 以繞過 RLS）
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// 解析 frontmatter
function parseFrontMatter(markdown) {
  const frontMatterMatch = markdown.match(/^---\s*[\r\n]+([\s\S]*?)---/);
  if (!frontMatterMatch) return {};

  const lines = frontMatterMatch[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const metadata = {};
  for (const line of lines) {
    const [rawKey, ...rest] = line.split(':');
    const key = rawKey.trim();
    const value = rest.join(':').trim();
    metadata[key] = value;
  }

  return metadata;
}

// 移除 frontmatter
function stripFrontMatter(markdown) {
  const frontMatterMatch = markdown.match(/^---\s*[\r\n]+([\s\S]*?)---[\r\n]*/);
  if (!frontMatterMatch) return markdown;
  return markdown.slice(frontMatterMatch[0].length);
}

// 從檔案名稱提取日期（格式：YYYYMMDD 或 YYYYMMDD-後綴）
function extractDateFromFilename(filename) {
  const nameWithoutExt = filename.replace(/\.md$/, '');
  const dateMatch = nameWithoutExt.match(/^(\d{8})/);
  if (dateMatch) {
    const dateStr = dateMatch[1];
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${year}-${month}-${day}`;
  }
  return null;
}

// 從 markdown 內容中提取預覽文字
function extractPreview(markdown, maxLength = 150) {
  if (!markdown) return '';
  
  let text = markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '')
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^---+$/gm, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (text.length <= maxLength) {
    return text;
  }
  
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.7) {
    return truncated.substring(0, lastSpace) + '...';
  } else {
    return truncated + '...';
  }
}

// 遷移文章到 Supabase
async function migrateArticles() {
  const postsDir = path.join(__dirname, '../posts');
  const files = fs.readdirSync(postsDir).filter((file) => file.endsWith('.md'));

  console.log(`📦 開始遷移 ${files.length} 篇文章到 Supabase...\n`);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(postsDir, file);
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const id = file.replace(/\.md$/, '');
      
      // 解析 frontmatter
      const {
        title,
        date: frontmatterDate,
        cat,
        pin,
        pinMessage,
      } = parseFrontMatter(content);
      
      // 優先從檔案名稱提取日期
      const dateFromFilename = extractDateFromFilename(file);
      const date = dateFromFilename || frontmatterDate || null;
      
      // 處理置頂狀態
      const isPinned = typeof pin === 'string'
        ? ['true', '1', 'yes', 'y'].includes(pin.trim().toLowerCase())
        : Boolean(pin);
      const normalizedPinMessage =
        typeof pinMessage === 'string' && pinMessage.trim().length > 0
          ? pinMessage.trim()
          : null;
      
      // 提取預覽文字
      const markdownContent = stripFrontMatter(content);
      const preview = extractPreview(markdownContent);

      // 準備插入資料
      const articleData = {
        id,
        title: title || id,
        content: markdownContent.trim(),
        date: date,
        cat: cat || null,
        preview: preview || null,
        is_pinned: isPinned,
        pin_message: normalizedPinMessage,
        status: 'published', // 現有文章預設為已發布
        created_by: 'migration-script',
      };

      // 檢查文章是否已存在
      const { data: existing } = await supabase
        .from('articles')
        .select('id')
        .eq('id', id)
        .single();

      if (existing) {
        // 更新現有文章
        const { error: updateError } = await supabase
          .from('articles')
          .update(articleData)
          .eq('id', id);

        if (updateError) {
          throw updateError;
        }
        console.log(`✅ [${i + 1}/${files.length}] 更新文章: ${id} - ${articleData.title}`);
      } else {
        // 插入新文章
        const { error: insertError } = await supabase
          .from('articles')
          .insert(articleData);

        if (insertError) {
          throw insertError;
        }
        console.log(`✅ [${i + 1}/${files.length}] 新增文章: ${id} - ${articleData.title}`);
      }

      successCount++;
    } catch (error) {
      errorCount++;
      const errorMsg = `❌ [${i + 1}/${files.length}] 遷移失敗: ${file} - ${error.message}`;
      console.error(errorMsg);
      errors.push({ file, error: error.message });
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 遷移完成！`);
  console.log(`✅ 成功: ${successCount} 篇`);
  console.log(`❌ 失敗: ${errorCount} 篇`);
  
  if (errors.length > 0) {
    console.log('\n錯誤詳情:');
    errors.forEach(({ file, error }) => {
      console.log(`  - ${file}: ${error}`);
    });
  }
  
  console.log('\n💡 提示：原始 .md 檔案已保留作為備份');
}

// 執行遷移
migrateArticles().catch((error) => {
  console.error('❌ 遷移過程發生錯誤:', error);
  process.exit(1);
});

