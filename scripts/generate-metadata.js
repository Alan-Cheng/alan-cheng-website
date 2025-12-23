import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  // 移除 .md 副檔名
  const nameWithoutExt = filename.replace(/\.md$/, '');
  // 匹配開頭的 8 位數字（YYYYMMDD）
  const dateMatch = nameWithoutExt.match(/^(\d{8})/);
  if (dateMatch) {
    const dateStr = dateMatch[1];
    // 將 YYYYMMDD 轉換為 YYYY-MM-DD
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
  
  // 移除 markdown 語法標記
  let text = markdown
    // 移除代碼塊
    .replace(/```[\s\S]*?```/g, '')
    // 移除行內代碼
    .replace(/`[^`]+`/g, '')
    // 移除標題標記
    .replace(/^#{1,6}\s+/gm, '')
    // 移除粗體/斜體標記
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    // 移除連結標記，保留文字
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    // 移除圖片標記
    .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '')
    // 移除列表標記
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // 移除水平線
    .replace(/^---+$/gm, '')
    // 移除多餘的空白行
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    // 移除行首尾空白
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join(' ')
    // 移除多餘空格
    .replace(/\s+/g, ' ')
    .trim();
  
  // 如果內容太短，直接返回
  if (text.length <= maxLength) {
    return text;
  }
  
  // 在單詞邊界截斷
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.7) {
    // 如果最後一個空格位置合理，就在那裡截斷
    return truncated.substring(0, lastSpace) + '...';
  } else {
    // 否則直接截斷
    return truncated + '...';
  }
}

// 生成 metadata JSON
function generateMetadata() {
  const postsDir = path.join(__dirname, '../posts');
  const outputFile = path.join(__dirname, '../public/articles-metadata.json');

  // 確保 public 目錄存在
  const publicDir = path.dirname(outputFile);
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 檢查 posts 目錄是否存在
  if (!fs.existsSync(postsDir)) {
    console.log('⚠️ posts 目錄不存在，跳過 metadata 生成（如果文章已遷移到 Supabase，這是正常的）');
    // 如果目錄不存在，建立一個空的 metadata 檔案
    fs.writeFileSync(outputFile, JSON.stringify([], null, 2), 'utf-8');
    console.log('✅ 已建立空的 articles-metadata.json');
    return;
  }

  const files = fs.readdirSync(postsDir).filter((file) => file.endsWith('.md'));
  const metadata = [];

  for (const file of files) {
    const filePath = path.join(postsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const id = file.replace(/\.md$/, '');
    const {
      title,
      date: frontmatterDate,
      cat,
      pin,
      pinMessage,
    } = parseFrontMatter(content);
    
    // 優先從檔案名稱提取日期，如果沒有則使用 frontmatter 的日期
    const dateFromFilename = extractDateFromFilename(file);
    const date = dateFromFilename || frontmatterDate || null;
    
    const isPinned = typeof pin === 'string'
      ? ['true', '1', 'yes', 'y'].includes(pin.trim().toLowerCase())
      : Boolean(pin);
    const normalizedPinMessage =
      typeof pinMessage === 'string' && pinMessage.trim().length > 0
        ? pinMessage.trim()
        : null;
    
    // 提取預覽文字（從內容中提取，不包含 frontmatter）
    const markdownContent = stripFrontMatter(content);
    const preview = extractPreview(markdownContent);

    metadata.push({
      id,
      title: title || id,
      date: date,
      cat: cat || null,
      preview: preview || null,
      path: `/posts/${file}`, // 用於載入完整內容
      isPinned,
      pinMessage: normalizedPinMessage,
    });
  }

  // 按日期排序（新的在上面）
  metadata.sort((a, b) => {
    const aTime = a.date ? Date.parse(a.date) : 0;
    const bTime = b.date ? Date.parse(b.date) : 0;
    return bTime - aTime;
  });

  fs.writeFileSync(outputFile, JSON.stringify(metadata, null, 2), 'utf-8');
  console.log(`✅ Generated metadata for ${metadata.length} articles`);
}

generateMetadata();

