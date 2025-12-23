import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 從環境變數讀取 GitHub Token（可選）
const GITHUB_USERNAME = 'Alan-Cheng';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

// 手動定義的商業作品（從 App.tsx 中提取）
const manualProjects = [
  {
    title: "一形設計｜ONE SHAPE",
    imageUrl: "https://github.com/Alan-Cheng/one-shape-website/raw/main/assets/img/header.jpg",
    category: 'commercial',
  },
  {
    title: "一暮設計｜iimoo",
    imageUrl: "https://github.com/iimoo-design/iimoo-design.github.io/raw/master/assets/img/header.jpg?raw=true",
    category: 'commercial',
  },
];

// 輸出目錄
const OUTPUT_DIR = path.join(__dirname, '../public/projects-images');
const METADATA_FILE = path.join(__dirname, '../public/projects-images-metadata.json');

// 確保輸出目錄存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 從 markdown 內容中提取第一張圖片 URL
function extractFirstImageFromMarkdown(markdown) {
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

// 從 GitHub 獲取 README 內容並提取第一張圖片
async function fetchReadmeImage(repoOwner, repoName) {
  try {
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
    };

    if (GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/readme`,
      { headers }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data.content) {
      return null;
    }

    // 解碼 base64 內容
    const markdown = Buffer.from(data.content.replace(/\s/g, ''), 'base64').toString('utf-8');

    // 提取第一張圖片
    const imageUrl = extractFirstImageFromMarkdown(markdown);

    if (!imageUrl) {
      return null;
    }

    // 如果是相對路徑，轉換為完整的 GitHub raw URL
    if (imageUrl.startsWith('./') || imageUrl.startsWith('../') || !imageUrl.startsWith('http')) {
      const defaultBranch = data.default_branch || 'main';
      if (imageUrl.startsWith('./')) {
        const relativePath = imageUrl.substring(2);
        return `https://raw.githubusercontent.com/${repoOwner}/${repoName}/${defaultBranch}/${relativePath}`;
      } else if (imageUrl.startsWith('../')) {
        const relativePath = imageUrl.substring(3);
        return `https://raw.githubusercontent.com/${repoOwner}/${repoName}/${defaultBranch}/${relativePath}`;
      } else {
        return `https://raw.githubusercontent.com/${repoOwner}/${repoName}/${defaultBranch}/${imageUrl}`;
      }
    }

    return imageUrl;
  } catch (error) {
    console.error(`❌ 獲取 README 圖片失敗 ${repoOwner}/${repoName}:`, error.message);
    return null;
  }
}

// 從 GitHub 獲取 pinned repositories
async function fetchPinnedRepos() {
  try {
    const projects = [];

    if (GITHUB_TOKEN) {
      // 使用 GraphQL API
      const query = `
        {
          user(login: "${GITHUB_USERNAME}") {
            pinnedItems(first: 6, types: REPOSITORY) {
              nodes {
                ... on Repository {
                  name
                  description
                  url
                  openGraphImageUrl
                  homepageUrl
                  owner {
                    login
                  }
                }
              }
            }
          }
        }
      `;

      const response = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
        },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();

      if (data.errors) {
        console.error('❌ GraphQL 錯誤:', data.errors);
        return [];
      }

      const repos = data.data?.user?.pinnedItems?.nodes || [];

      for (const repo of repos) {
        const readmeImage = await fetchReadmeImage(repo.owner.login, repo.name);
        projects.push({
          title: repo.name,
          imageUrl: readmeImage || repo.openGraphImageUrl || `https://opengraph.githubassets.com/${repo.name}`,
          category: 'other',
        });
      }
    } else {
      // 使用 REST API
      const response = await fetch(`https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=stars&per_page=6`);
      const repos = await response.json();

      if (!Array.isArray(repos)) {
        return [];
      }

      for (const repo of repos) {
        const readmeImage = await fetchReadmeImage(repo.owner.login, repo.name);
        projects.push({
          title: repo.name,
          imageUrl: readmeImage || `https://opengraph.githubassets.com/${repo.full_name}`,
          category: 'other',
        });
      }
    }

    return projects;
  } catch (error) {
    console.error('❌ 獲取 GitHub repos 失敗:', error.message);
    return [];
  }
}

// 從 URL 生成安全的檔案名稱
function generateSafeFilename(url, title) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const ext = path.extname(pathname) || '.jpg';
    
    // 使用標題生成檔案名稱（移除特殊字符）
    const safeTitle = title
      .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    // 如果標題太長，截斷
    const maxLength = 50;
    const truncatedTitle = safeTitle.length > maxLength 
      ? safeTitle.substring(0, maxLength) 
      : safeTitle;
    
    // 添加 hash 來確保唯一性（使用 URL 的簡單 hash）
    const urlHash = Buffer.from(url).toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 8);
    
    return `${truncatedTitle}-${urlHash}${ext}`;
  } catch (error) {
    // 如果 URL 解析失敗，使用簡單的 hash
    const urlHash = Buffer.from(url).toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 16);
    return `${urlHash}.jpg`;
  }
}

// 下載圖片（處理重定向）
function downloadImage(url, outputPath, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error('重定向次數過多'));
      return;
    }

    const protocol = url.startsWith('https:') ? https : http;
    
    protocol.get(url, (response) => {
      // 處理重定向
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (!redirectUrl) {
          reject(new Error('重定向位置未找到'));
          return;
        }
        console.log(`↪️  重定向到 ${redirectUrl}...`);
        return downloadImage(redirectUrl, outputPath, redirectCount + 1).then(resolve).catch(reject);
      }

      // 處理錯誤狀態碼
      if (response.statusCode !== 200) {
        reject(new Error(`下載失敗: HTTP ${response.statusCode}`));
        return;
      }

      // 下載檔案
      const fileStream = fs.createWriteStream(outputPath);
      response.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        const stats = fs.statSync(outputPath);
        if (stats.size === 0) {
          fs.unlinkSync(outputPath);
          reject(new Error('下載的檔案為空'));
          return;
        }
        resolve(stats.size);
      });
      
      fileStream.on('error', (err) => {
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// 載入現有的 metadata
function loadMetadata() {
  try {
    if (fs.existsSync(METADATA_FILE)) {
      const content = fs.readFileSync(METADATA_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn('⚠️  讀取 metadata 失敗，將重新建立:', error.message);
  }
  return {};
}

// 儲存 metadata
function saveMetadata(metadata) {
  try {
    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2), 'utf-8');
  } catch (error) {
    console.error('❌ 儲存 metadata 失敗:', error.message);
  }
}

// 主函數
async function downloadProjectImages() {
  console.log('📥 開始下載作品集圖片...\n');

  // 載入現有的 metadata
  const metadata = loadMetadata();

  // 收集所有專案
  const allProjects = [...manualProjects];
  
  console.log(`📋 找到 ${manualProjects.length} 個手動定義的專案`);
  
  // 獲取 GitHub 專案
  console.log('🔍 正在從 GitHub 獲取 pinned repositories...');
  const githubProjects = await fetchPinnedRepos();
  console.log(`📋 找到 ${githubProjects.length} 個 GitHub 專案\n`);
  
  allProjects.push(...githubProjects);

  if (allProjects.length === 0) {
    console.log('ℹ️  未找到需要下載圖片的專案');
    return;
  }

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  // 下載每個專案的圖片
  for (const project of allProjects) {
    const { title, imageUrl } = project;
    
    // 檢查是否已經下載過
    if (metadata[imageUrl] && fs.existsSync(path.join(OUTPUT_DIR, metadata[imageUrl].filename))) {
      console.log(`⏭️  ${title} (已存在，跳過)`);
      skipCount++;
      continue;
    }

    try {
      console.log(`📥 正在下載: ${title}`);
      console.log(`   URL: ${imageUrl}`);

      const filename = generateSafeFilename(imageUrl, title);
      const outputPath = path.join(OUTPUT_DIR, filename);

      const fileSize = await downloadImage(imageUrl, outputPath);
      
      // 更新 metadata
      metadata[imageUrl] = {
        filename,
        localPath: `/projects-images/${filename}`,
        title,
        downloadedAt: new Date().toISOString(),
        size: fileSize,
      };

      console.log(`✅ ${title} (${(fileSize / 1024).toFixed(2)} KB)\n`);
      successCount++;
    } catch (error) {
      console.error(`❌ ${title} 下載失敗: ${error.message}\n`);
      failCount++;
    }
  }

  // 清理不存在的檔案記錄
  const existingFiles = new Set(
    Object.values(metadata).map(m => m.filename)
  );
  const actualFiles = fs.readdirSync(OUTPUT_DIR).filter(f => 
    fs.statSync(path.join(OUTPUT_DIR, f)).isFile()
  );
  
  for (const file of actualFiles) {
    if (!existingFiles.has(file)) {
      // 檔案存在但沒有 metadata，保留檔案但添加警告
      console.warn(`⚠️  發現未記錄的檔案: ${file}`);
    }
  }

  // 移除不存在的檔案的 metadata
  for (const url in metadata) {
    const record = metadata[url];
    const filePath = path.join(OUTPUT_DIR, record.filename);
    if (!fs.existsSync(filePath)) {
      delete metadata[url];
    }
  }

  // 儲存 metadata
  saveMetadata(metadata);

  // 統計信息
  console.log('\n📊 下載完成！');
  console.log(`   總共 ${allProjects.length} 個專案`);
  console.log(`   成功: ${successCount} 個`);
  if (skipCount > 0) {
    console.log(`   跳過: ${skipCount} 個`);
  }
  if (failCount > 0) {
    console.log(`   失敗: ${failCount} 個`);
  }
}

// 執行下載
downloadProjectImages().catch((error) => {
  console.error('❌ 下載過程發生錯誤:', error.message);
  process.exit(1);
});
