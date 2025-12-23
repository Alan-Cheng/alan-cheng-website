import React, { useState, useEffect } from 'react';
import { ProjectCard } from './components/ProjectCard';
import { MarkdownArticle } from './components/MarkdownArticle';
import { AnimatedCard } from './components/AnimatedCard';
import { TypingEffect } from './components/TypingEffect';
import { CopyLinkButton } from './components/CopyLinkButton';
import { CommentSection } from './components/CommentSection';
import { GithubIcon } from './components/icons/GithubIcon';
import { LinkedInIcon } from './components/icons/LinkedInIcon';
import { GmailIcon } from './components/icons/GmailIcon';
import { AdminLayout } from './components/admin/AdminLayout';
import { ArticleList } from './components/admin/ArticleList';
import { ArticleEditor } from './components/admin/ArticleEditor';
import { HistoryView } from './components/admin/HistoryView';
import { isAuthenticated, login } from './lib/admin-auth';
import { supabase } from './lib/supabase';
import type { Project } from './types';

const GITHUB_USERNAME = 'Alan-Cheng';
// 從環境變數讀取 GitHub Token（可選，如果沒有 token 會使用 REST API）
const GITHUB_TOKEN = import.meta.env.VITE_GITHUB_TOKEN || '';

const projects: Project[] = [
  {
    title: "一形設計｜ONE SHAPE",
    description: "一形設計ONE SHAPE - 將無形的空間融入有形的元素，創造出形隨其意的設計風格。台北市信義區專業室內設計公司",
    imageUrl: "https://github.com/Alan-Cheng/one-shape-website/raw/main/assets/img/header.jpg",
    link: "https://oneshapedesign.com/",
    category: 'commercial',
  },
  {
    title: "一暮設計｜iimoo",
    description: "一暮室內設計位於台北市信義區，提供專業住宅與商業空間設計服務。以豐富施作經驗，傾聽客戶需求，提供專業建議及設計規劃。",
    imageUrl: "https://github.com/iimoo-design/iimoo-design.github.io/raw/master/assets/img/header.jpg?raw=true",
    link: "https://iimoo.com.tw/",
    category: 'commercial',
  },
  // {
  //   title: "Friendly Cat - 即期食品查詢",
  //   description: "兩大超商的即期食品查詢（i珍食、友善時光）",
  //   imageUrl: "https://github.com/Alan-Cheng/Friendly-Cat/blob/main/demo/member.png?raw=true",
  //   link: "https://friendlycat.alan-cheng.com/",
  //   category: 'other',
  // },
];

// 文章摘要（只包含 metadata，用於列表顯示）
type ArticleSummary = {
  id: string;
  title: string;
  date?: string;
  cat?: string;
  preview?: string; // 預覽文字（從內容中提取）
  isPinned?: boolean;
  pinMessage?: string | null;
};

// 完整文章（包含內容，用於顯示）
type ArticleMeta = {
  id: string;
  title: string;
  date?: string;
  cat?: string;
  content: string;
};

function parseFrontMatter(markdown: string): { title?: string; date?: string; cat?: string } {
  // 簡單解析最上方的 frontmatter：
  // ---
  // title: xxx
  // date: yyyy-mm-dd
  // cat: 分類名稱
  // ---
  const frontMatterMatch = markdown.match(/^---\s*[\r\n]+([\s\S]*?)---/);
  if (!frontMatterMatch) return {};

  const lines = frontMatterMatch[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let title: string | undefined;
  let date: string | undefined;
  let cat: string | undefined;

  for (const line of lines) {
    const [rawKey, ...rest] = line.split(':');
    const key = rawKey.trim();
    const value = rest.join(':').trim();

    if (key === 'title') {
      title = value;
    } else if (key === 'date') {
      date = value;
    } else if (key === 'cat') {
      cat = value;
    }
  }

  return { title, date, cat };
}

function stripFrontMatter(markdown: string): string {
  const frontMatterMatch = markdown.match(/^---\s*[\r\n]+([\s\S]*?)---[\r\n]*/);
  if (!frontMatterMatch) return markdown;
  return markdown.slice(frontMatterMatch[0].length);
}

// 從 markdown 內容中提取預覽文字
function extractPreview(markdown: string, maxLength: number = 150): string {
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

// 透過 Vite 的 import.meta.glob 獲取檔案列表（非 eager，按需載入完整內容）
const markdownModules = import.meta.glob('./posts/*.md', {
  as: 'raw',
  eager: false, // 改為 false，只在需要時載入
});

// 從檔案路徑提取文章 ID
function getArticleIdFromPath(path: string): string {
  const fileName = path.split('/').pop() || path;
  return fileName.replace(/\.md$/, '');
}

// 載入 metadata JSON（只包含 metadata 和 preview，不包含完整內容）
async function loadArticlesMetadata(): Promise<ArticleSummary[]> {
  try {
    console.log('📦 [Lazy Loading] 開始從 Supabase 載入 metadata...');
    
    // 優先從 Supabase 讀取
    const { data, error } = await supabase
      .from('articles')
      .select('id, title, date, cat, preview, is_pinned, pin_message')
      .eq('status', 'published')
      .order('date', { ascending: false, nullsFirst: false });

    if (!error && data && data.length > 0) {
      console.log(`✅ [Lazy Loading] 已從 Supabase 載入 ${data.length} 篇文章的 metadata`);
      
      return data.map((item) => ({
        id: item.id,
        title: item.title,
        date: item.date || undefined,
        cat: item.cat || undefined,
        preview: item.preview || undefined,
        isPinned: Boolean(item.is_pinned),
        pinMessage: item.pin_message ?? undefined,
      }));
    }

    // 如果 Supabase 查詢失敗，回退到讀取 JSON 檔案
    console.log('⚠️ [Lazy Loading] Supabase 查詢失敗，回退到讀取 JSON 檔案...');
    const response = await fetch('/articles-metadata.json');
    if (!response.ok) {
      throw new Error(`Failed to load metadata: ${response.status}`);
    }
    const metadata = await response.json() as Array<{
      id: string;
      title: string;
      date: string | null;
      cat: string | null;
      preview: string | null;
      path: string;
      isPinned?: boolean | null;
      pinMessage?: string | null;
    }>;

    console.log(`✅ [Lazy Loading] 已從 JSON 檔案載入 ${metadata.length} 篇文章的 metadata`);

    // 轉換為 ArticleSummary 格式（包含 preview）
    return metadata.map((item) => ({
      id: item.id,
      title: item.title,
      date: item.date || undefined,
      cat: item.cat || undefined,
      preview: item.preview || undefined,
      isPinned: Boolean(item.isPinned),
      pinMessage: item.pinMessage ?? undefined,
    }));
  } catch (error) {
    console.error('Failed to load articles metadata:', error);
    return [];
  }
}

// 載入單篇文章的完整內容（只在點擊時才載入）
async function loadArticleContent(id: string): Promise<string | null> {
  console.log(`📄 [Lazy Loading] 開始載入文章 "${id}" 的完整內容...`);

  try {
    // 優先從 Supabase 讀取
    const { data, error } = await supabase
      .from('articles')
      .select('content')
      .eq('id', id)
      .eq('status', 'published')
      .single();

    if (!error && data && data.content) {
      console.log(`✅ [Lazy Loading] 已從 Supabase 載入文章 "${id}" 的完整內容`);
      return data.content;
    }

    // 如果 Supabase 查詢失敗，回退到讀取檔案
    console.log(`⚠️ [Lazy Loading] Supabase 查詢失敗，回退到讀取檔案...`);
    const modulePath = Object.keys(markdownModules).find((path) =>
      getArticleIdFromPath(path) === id
    );

    if (!modulePath) {
      console.error(`❌ [Lazy Loading] 找不到文章 "${id}" 的檔案路徑`);
      return null;
    }

    const loader = markdownModules[modulePath];
    if (typeof loader === 'function') {
      const content = await loader() as string;
      const contentSize = content.length;
      console.log(`✅ [Lazy Loading] 已從檔案載入文章 "${id}" 的完整內容（大小：${contentSize} bytes）`);
      return stripFrontMatter(content);
    }
    return null;
  } catch (error) {
    console.error(`❌ [Lazy Loading] 載入文章 "${id}" 失敗:`, error);
    return null;
  }
}

// 從 markdown 內容中提取第一張圖片 URL
function extractFirstImageFromMarkdown(markdown: string): string | null {
  if (!markdown) return null;

  // 匹配 markdown 圖片語法: ![alt](url) 或 <img src="url">
  const imagePatterns = [
    /!\[.*?\]\((.*?)\)/,  // ![alt](url)
    /<img[^>]+src=["']([^"']+)["'][^>]*>/i,  // <img src="url">
  ];

  for (const pattern of imagePatterns) {
    const match = markdown.match(pattern);
    if (match && match[1]) {
      let imageUrl = match[1].trim();
      // 如果是相對路徑，需要轉換為完整的 GitHub raw URL
      // 但這裡我們先返回找到的 URL，讓調用者處理
      return imageUrl;
    }
  }

  return null;
}

// 從 GitHub 獲取 README 內容並提取第一張圖片
async function fetchReadmeImage(repoOwner: string, repoName: string): Promise<string | null> {
  try {
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
    };

    if (GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
    }

    // 嘗試獲取 README.md
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
    const markdown = atob(data.content.replace(/\s/g, ''));

    // 提取第一張圖片
    const imageUrl = extractFirstImageFromMarkdown(markdown);

    if (!imageUrl) {
      return null;
    }

    // 如果是相對路徑，轉換為完整的 GitHub raw URL
    if (imageUrl.startsWith('./') || imageUrl.startsWith('../') || !imageUrl.startsWith('http')) {
      // 獲取 README 所在的目錄（通常是根目錄）
      const defaultBranch = data.default_branch || 'main';
      // 構建完整的 raw URL
      if (imageUrl.startsWith('./')) {
        const relativePath = imageUrl.substring(2);
        return `https://raw.githubusercontent.com/${repoOwner}/${repoName}/${defaultBranch}/${relativePath}`;
      } else if (imageUrl.startsWith('../')) {
        // 如果圖片在父目錄，需要處理路徑
        const relativePath = imageUrl.substring(3);
        return `https://raw.githubusercontent.com/${repoOwner}/${repoName}/${defaultBranch}/${relativePath}`;
      } else {
        // 假設是相對於根目錄的路徑
        return `https://raw.githubusercontent.com/${repoOwner}/${repoName}/${defaultBranch}/${imageUrl}`;
      }
    }

    return imageUrl;
  } catch (error) {
    console.error(`Error fetching README for ${repoOwner}/${repoName}:`, error);
    return null;
  }
}

// 從 GitHub 獲取 pinned repositories
async function fetchPinnedRepos(): Promise<Project[]> {
  try {
    // 如果有 token，使用 GraphQL API 獲取 pinned repos
    if (GITHUB_TOKEN) {
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
        console.error('GraphQL errors:', data.errors);
        return [];
      }

      const repos = data.data?.user?.pinnedItems?.nodes || [];

      // 並行獲取每個 repo 的 README 圖片
      const reposWithImages = await Promise.all(
        repos.map(async (repo: any) => {
          const readmeImage = await fetchReadmeImage(repo.owner.login, repo.name);
          return {
            title: repo.name,
            description: repo.description || 'GitHub Repository',
            imageUrl: readmeImage || repo.openGraphImageUrl || `https://opengraph.githubassets.com/${repo.name}`,
            link: repo.homepageUrl || repo.url, // 如果有網站連結就用網站，否則用 GitHub
            githubUrl: repo.url, // 總是包含 GitHub 連結
            category: 'other' as const,
          };
        })
      );

      return reposWithImages;
    } else {
      // 如果沒有 token，使用 REST API 獲取 repos（按 star 數排序，通常 pinned repos 會被 star 較多）
      const response = await fetch(`https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=stars&per_page=6`);
      const repos = await response.json();

      if (!Array.isArray(repos)) {
        return [];
      }

      // 並行獲取每個 repo 的 README 圖片
      const reposWithImages = await Promise.all(
        repos.map(async (repo: any) => {
          const readmeImage = await fetchReadmeImage(repo.owner.login, repo.name);
          return {
            title: repo.name,
            description: repo.description || 'GitHub Repository',
            imageUrl: readmeImage || `https://opengraph.githubassets.com/${repo.full_name}`,
            link: repo.homepage || repo.html_url, // 如果有網站連結就用網站，否則用 GitHub
            githubUrl: repo.html_url, // 總是包含 GitHub 連結
            category: 'other' as const,
          };
        })
      );

      return reposWithImages;
    }
  } catch (error) {
    console.error('Error fetching GitHub repos:', error);
    return [];
  }
}

type View = 'home' | 'articles' | 'admin';

const App: React.FC = () => {
  const [githubProjects, setGithubProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [view, setView] = useState<View>('home');
  const [articleSearch, setArticleSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const ARTICLES_PER_PAGE = 5;

  // 後台相關狀態
  const [adminView, setAdminView] = useState<'list' | 'new' | 'edit' | 'history'>('list');
  const [adminArticleId, setAdminArticleId] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [articleListRefreshTrigger, setArticleListRefreshTrigger] = useState(0);

  // 文章摘要列表（用於列表顯示）
  const [articleSummaries, setArticleSummaries] = useState<ArticleSummary[]>([]);
  const [isLoadingSummaries, setIsLoadingSummaries] = useState(true);

  // 選中文章的完整內容（按需載入）
  const [selectedArticleContent, setSelectedArticleContent] = useState<string | null>(null);
  const [isLoadingArticleContent, setIsLoadingArticleContent] = useState(false);
  // 是否顯示回到頂端按鈕（滾動超過一個螢幕高度時顯示）
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  // 預設的工作描述
  const defaultJobDescription = '目前在台灣大哥大擔任資深工程師';
  
  // Avatar 翻轉效果狀態
  const [isAvatarFlipped, setIsAvatarFlipped] = useState(false);
  const [hasPerformedInitialFlip, setHasPerformedInitialFlip] = useState(false);

  useEffect(() => {
    // 載入 GitHub 專案
    fetchPinnedRepos()
      .then((repos) => {
        setGithubProjects(repos);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Failed to fetch GitHub repos:', error);
        setIsLoading(false);
      });
  }, []);

  // Avatar 翻轉效果：只在第一次進入首頁時執行一次
  useEffect(() => {
    if (view === 'home' && !hasPerformedInitialFlip) {
      // 第一次進入首頁，1.5 秒後翻轉到 Instagram 頭像
      const timer = setTimeout(() => {
        setIsAvatarFlipped(true);
        setHasPerformedInitialFlip(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
    // 之後不再執行任何翻轉邏輯，保持當前狀態
  }, [view, hasPerformedInitialFlip]);

  // 初始化時只載入 metadata JSON（不載入完整內容）
  useEffect(() => {
    const loadSummaries = async () => {
      setIsLoadingSummaries(true);
      try {
        // 只載入輕量的 metadata JSON，不載入任何 markdown 內容
        const summaries = await loadArticlesMetadata();
        setArticleSummaries(summaries);
      } catch (error) {
        console.error('Failed to load article summaries:', error);
      } finally {
        setIsLoadingSummaries(false);
      }
    };

    loadSummaries();
  }, []);

  // 當選中文章時，載入完整內容
  useEffect(() => {
    if (selectedArticleId) {
      setIsLoadingArticleContent(true);
      setSelectedArticleContent(null);

      loadArticleContent(selectedArticleId)
        .then((content) => {
          setSelectedArticleContent(content);
        })
        .catch((error) => {
          console.error('Failed to load article content:', error);
          setSelectedArticleContent(null);
        })
        .finally(() => {
          setIsLoadingArticleContent(false);
        });
    } else {
      // 取消選中時，清除內容
      setSelectedArticleContent(null);
    }
  }, [selectedArticleId]);

  // 初始化年份
  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  // 後台認證狀態
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  // 檢查後台認證狀態
  useEffect(() => {
    if (view === 'admin') {
      const checkAuth = async () => {
        const authStatus = await isAuthenticated();
        setIsAdminAuthenticated(authStatus);
        setIsAuthChecked(true);
      };
      checkAuth();
    } else {
      setIsAuthChecked(false);
      setIsAdminAuthenticated(false);
    }
  }, [view]);

  // 根據網址 hash 初始化/同步當前頁面（#articles / #articles/{articleId} / #home / #admin）
  useEffect(() => {
    const applyHashView = () => {
      const hash = window.location.hash.replace('#', '');

      if (hash.startsWith('admin/')) {
        const adminPath = hash.replace('admin/', '');
        
        if (adminPath === 'new') {
          setView('admin');
          setAdminView('new');
          setAdminArticleId(null);
        } else if (adminPath.startsWith('edit/')) {
          const articleId = adminPath.replace('edit/', '');
          setView('admin');
          setAdminView('edit');
          setAdminArticleId(articleId);
        } else if (adminPath.startsWith('history/')) {
          const articleId = adminPath.replace('history/', '');
          setView('admin');
          setAdminView('history');
          setAdminArticleId(articleId);
        } else {
          setView('admin');
          setAdminView('list');
          setAdminArticleId(null);
        }
      } else if (hash === 'admin') {
        setView('admin');
        setAdminView('list');
        setAdminArticleId(null);
      } else if (hash.startsWith('articles/')) {
        const encodedArticleId = hash.replace('articles/', '');
        let articleId = encodedArticleId;

        try {
          articleId = decodeURIComponent(encodedArticleId);
        } catch { }

        if (view !== 'articles') {
          setView('articles');
        }
        if (selectedArticleId !== articleId) {
          setSelectedArticleId(articleId);
        }

      } else if (hash === 'articles') {
        if (view !== 'articles') {
          setView('articles');
        }
        if (selectedArticleId !== null) {
          setSelectedArticleId(null);
        }

      } else {
        if (view !== 'home') {
          setView('home');
        }
        if (selectedArticleId !== null) {
          setSelectedArticleId(null);
        }
      }
    };

    applyHashView();
    window.addEventListener('hashchange', applyHashView);
    return () => window.removeEventListener('hashchange', applyHashView);
  }, [view, selectedArticleId]);

  const commercialProjects = projects.filter(p => p.category === 'commercial');
  const manualOtherProjects = projects.filter(p => p.category === 'other');
  // 合併手動添加的其他作品和從 GitHub 獲取的作品
  const allOtherProjects = [...manualOtherProjects, ...githubProjects];

  const nonPinnedSummaries = articleSummaries.filter((article) => !article.isPinned);

  // 選中的文章摘要（用於顯示標題等 metadata）
  const selectedArticleSummary = selectedArticleId
    ? articleSummaries.find((a) => a.id === selectedArticleId) ?? null
    : null;

  // 動態更新 SEO meta 標籤和 title
  useEffect(() => {
    // 用於 meta 標籤的標題（包含名字，用於 SEO）
    const baseMetaTitle = '鄭人瑄 (Alan Cheng) - 軟體工程師 | 個人作品集';
    // 用於瀏覽器標籤頁的標題（不包含名字）
    const baseDisplayTitle = 'Alan Cheng - 個人網站';
    const baseDescription = '鄭人瑄 (Alan Cheng) 的個人作品集網站。目前在台灣大哥大擔任資深工程師，從保險業務轉職軟體業，喜歡寫程式也喜歡研究各種技術。展示軟體開發專案、文章與技能，涵蓋前端與後端開發。';
    const baseUrl = 'https://alan-cheng.com';
    const defaultImage = `${baseUrl}/avatar.png`;
    
    let pageTitle = baseDisplayTitle; // 瀏覽器標籤頁顯示的標題
    let pageMetaTitle = baseMetaTitle; // meta 標籤使用的標題（包含名字）
    let pageDescription = baseDescription;
    let pageUrl = baseUrl;
    let pageImage = defaultImage;
    
    if (view === 'articles') {
      if (selectedArticleSummary) {
        // 單篇文章頁面
        pageTitle = `Alan Cheng - ${selectedArticleSummary.title}`;
        pageMetaTitle = `${selectedArticleSummary.title} | ${baseMetaTitle}`;
        pageDescription = selectedArticleSummary.preview || selectedArticleSummary.pinMessage || `閱讀文章：${selectedArticleSummary.title}`;
        pageUrl = `${baseUrl}/#articles/${encodeURIComponent(selectedArticleSummary.id)}`;
        
        // 從文章內容中提取第一張圖片
        if (selectedArticleContent) {
          const firstImage = extractFirstImageFromMarkdown(selectedArticleContent);
          if (firstImage) {
            // 將相對路徑轉換為絕對 URL
            if (firstImage.startsWith('http://') || firstImage.startsWith('https://')) {
              pageImage = firstImage;
            } else if (firstImage.startsWith('/')) {
              pageImage = `${baseUrl}${firstImage}`;
            } else {
              pageImage = `${baseUrl}/${firstImage}`;
            }
          }
        }
      } else {
        // 文章列表頁面
        pageTitle = 'Alan Cheng - 文章列表';
        pageMetaTitle = `文章 | ${baseMetaTitle}`;
        pageDescription = '文章列表，記錄軟體開發、LeetCode 刷題與學習心得。';
        pageUrl = `${baseUrl}/#articles`;
      }
    } else {
      // 首頁（作品頁面）
      pageTitle = baseDisplayTitle; // 'Alan Cheng - 個人網站'
      pageMetaTitle = baseMetaTitle;
      pageDescription = baseDescription;
      pageUrl = baseUrl;
    }
    
    // 更新 document title（瀏覽器標籤頁，不包含名字）
    document.title = pageTitle;
    
    // 更新 meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', pageDescription);
    
    // 更新 Open Graph tags
    const updateMetaTag = (property: string, content: string) => {
      let meta = document.querySelector(`meta[property="${property}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('property', property);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };
    
    // 使用包含名字的標題作為 meta 標籤（用於 SEO，不會顯示在網頁內容中）
    updateMetaTag('og:title', pageMetaTitle);
    updateMetaTag('og:description', pageDescription);
    updateMetaTag('og:url', pageUrl);
    updateMetaTag('og:image', pageImage);
    
    // 更新 Twitter Card tags
    const updateTwitterTag = (name: string, content: string) => {
      let meta = document.querySelector(`meta[name="${name}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', name);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };
    
    updateTwitterTag('twitter:card', 'summary_large_image');
    updateTwitterTag('twitter:title', pageMetaTitle);
    updateTwitterTag('twitter:description', pageDescription);
    updateTwitterTag('twitter:image', pageImage);
    
    // 更新 canonical URL
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', pageUrl);
  }, [view, selectedArticleSummary, selectedArticleContent]);

  // 搜集所有不重複的分類
  const allCategories = Array.from(
    new Set(
      nonPinnedSummaries
        .map((a) => a.cat)
        .filter((cat) => cat !== undefined && cat !== null) as string[]
    )
  ).sort();

  const shouldShowPinned = selectedCategory === null;

  const filteredArticles = articleSummaries.filter((article) => {
    if (article.isPinned && !shouldShowPinned) {
      return false;
    }
    // 先過濾分類
    if (selectedCategory && article.cat !== selectedCategory) {
      return false;
    }
    // 再過濾搜尋關鍵字（搜尋標題和預覽文字）
    if (!articleSearch.trim()) return true;
    const q = articleSearch.toLowerCase();
    return (
      article.title.toLowerCase().includes(q) ||
      (article.preview && article.preview.toLowerCase().includes(q))
    );
  });

  const pinnedArticles = filteredArticles.filter((article) => article.isPinned);
  const regularArticles = filteredArticles.filter((article) => !article.isPinned);

  // 計算總頁數
  const totalPages = Math.ceil(regularArticles.length / ARTICLES_PER_PAGE);

  // 根據當前頁碼計算要顯示的文章
  const startIndex = (currentPage - 1) * ARTICLES_PER_PAGE;
  const endIndex = startIndex + ARTICLES_PER_PAGE;
  const visibleRegularArticles = regularArticles.slice(startIndex, endIndex);
  const visibleArticles =
    currentPage === 1
      ? [...pinnedArticles, ...visibleRegularArticles]
      : visibleRegularArticles;

  // 當搜尋或分類改變時，重置到第一頁
  useEffect(() => {
    setCurrentPage(1);
  }, [articleSearch, selectedCategory]);

  return (
    <div
      className={`bg-stone-50 min-h-screen text-stone-700 ${
        selectedArticleSummary ? 'is-reading-article' : ''
      }`}
    >
      {/* 純 CSS 的文章進度條（僅支援 scroll-timeline 的瀏覽器會顯示） */}
      <div className="article-progress">
        <div className="article-progress-inner" />
      </div>

      <main className={`mx-auto px-6 py-16 md:py-24 ${
        view === 'admin' ? 'max-w-full' : 'max-w-4xl'
      }`}>
        <>
          {/* 後台管理介面 */}
          {view === 'admin' && (
            <>
              {!isAuthChecked ? (
                <div className="max-w-md mx-auto mt-20">
                  <div className="bg-white rounded-lg border border-stone-200 p-8 shadow-sm">
                    <p className="text-center text-stone-500">檢查登入狀態...</p>
                  </div>
                </div>
              ) : !isAdminAuthenticated ? (
                <div className="max-w-md mx-auto mt-20">
                  <div className="bg-white rounded-lg border border-stone-200 p-8 shadow-sm">
                    <h2 className="text-2xl font-semibold text-stone-800 mb-6 text-center">
                      後台登入
                    </h2>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        setIsCheckingAuth(true);
                        setAdminAuthError('');
                        
                        const result = await login(adminEmail, adminPassword);
                        
                        if (result.success) {
                          setIsCheckingAuth(false);
                          setAdminEmail('');
                          setAdminPassword('');
                          // 重新檢查認證狀態
                          const authStatus = await isAuthenticated();
                          setIsAdminAuthenticated(authStatus);
                          if (authStatus) {
                            window.location.hash = '#admin';
                          }
                        } else {
                          setIsCheckingAuth(false);
                          setAdminAuthError(result.error || '登入失敗');
                        }
                      }}
                    >
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-stone-700 mb-2">
                          電子郵件
                        </label>
                        <input
                          type="email"
                          value={adminEmail}
                          onChange={(e) => {
                            setAdminEmail(e.target.value);
                            setAdminAuthError('');
                          }}
                          className="w-full px-4 py-2 border border-stone-300 rounded-md focus:ring-2 focus:ring-stone-500 focus:border-transparent"
                          placeholder="輸入管理員電子郵件"
                          autoFocus
                          required
                        />
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-stone-700 mb-2">
                          密碼
                        </label>
                        <input
                          type="password"
                          value={adminPassword}
                          onChange={(e) => {
                            setAdminPassword(e.target.value);
                            setAdminAuthError('');
                          }}
                          className="w-full px-4 py-2 border border-stone-300 rounded-md focus:ring-2 focus:ring-stone-500 focus:border-transparent"
                          placeholder="輸入管理員密碼"
                          required
                        />
                        {adminAuthError && (
                          <p className="mt-2 text-sm text-red-600">{adminAuthError}</p>
                        )}
                      </div>
                      <button
                        type="submit"
                        disabled={isCheckingAuth}
                        className="w-full px-4 py-2 bg-stone-800 text-white rounded-md hover:bg-stone-900 disabled:opacity-50"
                      >
                        {isCheckingAuth ? '登入中...' : '登入'}
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
              <AdminLayout
                currentView={adminView}
                onNavigate={(view) => {
                  setAdminView(view as any);
                  if (view === 'list') {
                    window.location.hash = '#admin';
                  } else if (view === 'new') {
                    window.location.hash = '#admin/new';
                  }
                }}
              >
                {adminView === 'list' && (
                  <ArticleList
                    refreshTrigger={articleListRefreshTrigger}
                    onEdit={(articleId) => {
                      setAdminView('edit');
                      setAdminArticleId(articleId);
                      window.location.hash = `#admin/edit/${articleId}`;
                    }}
                    onDelete={async () => {
                      // 刪除後重新載入列表
                      setAdminView('list');
                      setArticleListRefreshTrigger(prev => prev + 1);
                      window.location.hash = '#admin';
                    }}
                    onViewHistory={(articleId) => {
                      setAdminView('history');
                      setAdminArticleId(articleId);
                      window.location.hash = `#admin/history/${articleId}`;
                    }}
                  />
                )}
                {adminView === 'new' && (
                  <ArticleEditor
                    articleId={null}
                    onSave={() => {
                      setAdminView('list');
                      setArticleListRefreshTrigger(prev => prev + 1);
                      window.location.hash = '#admin';
                    }}
                    onCancel={() => {
                      setAdminView('list');
                      window.location.hash = '#admin';
                    }}
                  />
                )}
                {adminView === 'edit' && adminArticleId && (
                  <ArticleEditor
                    articleId={adminArticleId}
                    onSave={() => {
                      setAdminView('list');
                      setArticleListRefreshTrigger(prev => prev + 1);
                      window.location.hash = '#admin';
                    }}
                    onCancel={() => {
                      setAdminView('list');
                      window.location.hash = '#admin';
                    }}
                  />
                )}
                {adminView === 'history' && adminArticleId && (
                  <HistoryView
                    articleId={adminArticleId}
                    onClose={() => {
                      setAdminView('list');
                      window.location.hash = '#admin';
                    }}
                    onRestore={() => {
                      setAdminView('list');
                      setArticleListRefreshTrigger(prev => prev + 1);
                      window.location.hash = '#admin';
                    }}
                  />
                )}
              </AdminLayout>
              )}
            </>
          )}

          {/* 一般頁面（首頁和文章） */}
          {view !== 'admin' && (
            <>
        {/* Header Section */}
        {/* Header 區域（共用） */}
        <header className="flex flex-col md:flex-row items-center md:items-start mb-8 md:mb-10">
          <div className="avatar-container mb-6 md:mb-0 md:mr-8">
            <div className="avatar-glow"></div>
            <div className="avatar-ring avatar-ring-1"></div>
            <div className="avatar-ring avatar-ring-2"></div>
            <div className="avatar-ring avatar-ring-3"></div>
            <div className={`avatar-flip-container ${isAvatarFlipped ? 'flipped' : ''}`}>
              <div className="avatar-flip-inner">
                <div className="avatar-flip-front">
                  <img
                    src="/avatar.png"
                    alt="GitHub 頭像"
                    className="avatar-image rounded-full object-cover shadow-md"
                  />
                </div>
                <div className="avatar-flip-back">
                  <img
                    src="/avatar-ig.png"
                    alt="Instagram 頭像"
                    className="avatar-image rounded-full object-cover shadow-md"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-center md:text-left">
              <h1 className="text-3xl font-light text-stone-800">
                <TypingEffect
                  text="Alan Cheng"
                  speed={100}
                  startDelay={0}
                  className="inline"
                />
              </h1>
              <h2 className="text-md text-stone-500 mt-1 mb-4">
                軟體工程師 / Software Engineer
              </h2>
              <p className="text-sm leading-relaxed max-w-md mx-auto md:mx-0">
                從保險業務轉職軟體業，{defaultJobDescription}。喜歡寫程式也喜歡研究各種技術，希望能做出有趣的東西。
              </p>
            </div>

            {/* 導覽列：首頁 / 文章 */}
            <nav className="mt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex justify-center md:justify-start space-x-4">
                <button
                  type="button"
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${view === 'home'
                      ? 'bg-stone-800 text-stone-50 border-stone-800'
                      : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400 hover:text-stone-700'
                    }`}
                  onClick={() => {
                    setView('home');
                    setSelectedArticleId(null);
                    window.location.hash = '#home';
                  }}
                >
                  首 頁
                </button>
                <button
                  type="button"
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${view === 'articles'
                      ? 'bg-stone-800 text-stone-50 border-stone-800'
                      : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400 hover:text-stone-700'
                    }`}
                  onClick={() => {
                    setView('articles');
                    setSelectedArticleId(null);
                    window.location.hash = '#articles';
                  }}
                >
                  文 章
                </button>
              </div>

              <div className="flex justify-center md:justify-end space-x-4">
                <a
                  href="https://www.linkedin.com/in/jhcheng-alan/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0077B5] opacity-80 hover:opacity-100 hover:scale-110 transition-all duration-200"
                  aria-label="LinkedIn Profile"
                >
                  <LinkedInIcon className="w-5 h-5" />
                </a>
                <a
                  href="mailto:jhcheng.alan@gmail.com"
                  className="text-[#EA4335] opacity-80 hover:opacity-100 hover:scale-110 transition-all duration-200"
                  aria-label="Email"
                >
                  <GmailIcon className="w-5 h-5" />
                </a>
                <a
                  href="https://github.com/Alan-Cheng"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#24292e] opacity-80 hover:opacity-100 hover:scale-110 transition-all duration-200"
                  aria-label="GitHub Profile"
                >
                  <GithubIcon className="w-5 h-5" />
                </a>
              </div>
            </nav>
          </div>
        </header>

        {/* 主要內容：依照 view 切換 */}
        {view === 'home' && (
          <div className="space-y-16">
            {/* Commercial Projects Section */}
            <section>
              <h3 className="text-xl font-light text-center text-stone-800 mb-10 tracking-wider">
                商 業 作 品
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {commercialProjects.map((project, index) => {
                  const delay = Math.min(index * 0.15, 0.5); // 最多延遲 0.5 秒
                  return (
                    <AnimatedCard key={project.title} delay={delay}>
                      <ProjectCard project={project} />
                    </AnimatedCard>
                  );
                })}
              </div>
            </section>

            {/* Other Projects Section */}
            <section>
              <h3 className="text-xl font-light text-center text-stone-800 mb-10 tracking-wider">
                其 他 作 品
              </h3>
              {isLoading ? (
                <div className="text-center text-stone-400 text-sm">載入中...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-center">
                  {allOtherProjects.map((project, index) => {
                    const delay = Math.min(index * 0.1, 0.5); // 最多延遲 0.5 秒
                    return (
                      <AnimatedCard key={project.title} delay={delay}>
                        <ProjectCard project={project} />
                      </AnimatedCard>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {view === 'articles' && (
          <div className="space-y-10">
            <section>
              <h3 className="text-xl font-light text-center text-stone-800 mb-6 tracking-wider">
                文 章
              </h3>

              {/* 分類標籤 + 搜尋列 */}
              <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
                {/* 分類標籤（左邊） */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${selectedCategory === null
                        ? 'bg-stone-800 text-stone-50 border-stone-800'
                        : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400 hover:text-stone-700'
                      }`}
                    onClick={() => {
                      setSelectedCategory(null);
                      setSelectedArticleId(null);
                      window.location.hash = '#articles';
                    }}
                  >
                    全部
                  </button>
                  {allCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${selectedCategory === cat
                          ? 'bg-stone-800 text-stone-50 border-stone-800'
                          : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400 hover:text-stone-700'
                        }`}
                      onClick={() => {
                        setSelectedCategory(cat);
                        setSelectedArticleId(null);
                        window.location.hash = '#articles';
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* 搜尋框（右邊） */}
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={articleSearch}
                    onChange={(e) => {
                      setArticleSearch(e.target.value);
                      setSelectedArticleId(null);
                      window.location.hash = '#articles';
                    }}
                    placeholder="搜尋文章標題或內文關鍵字..."
                    className="w-64 px-3 py-2 rounded-md border border-stone-200 text-xs text-stone-700 placeholder:text-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-400 focus:border-stone-400 bg-white"
                  />

                  {articleSearch && (
                    <button
                      type="button"
                      className="text-[11px] text-stone-400 hover:text-stone-600 underline"
                      onClick={() => {
                        setArticleSearch('');
                        setSelectedArticleId(null);
                        window.location.hash = '#articles';
                      }}
                    >
                      清除搜尋
                    </button>
                  )}
                </div>
              </div>

              {/* 文章列表（未選擇任何文章時顯示） */}
              {!selectedArticleSummary && (
                <div className="space-y-3">
                  {isLoadingSummaries ? (
                    <p className="text-center text-xs text-stone-400">載入文章列表中...</p>
                  ) : (
                    <>
                      {visibleArticles.map((article, index) => {
                        const delay = Math.min(index * 0.1, 0.5); // 最多延遲 0.5 秒
                        return (
                          <AnimatedCard
                            key={article.id}
                            delay={delay}
                            as="button"
                            type="button"
                            className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${article.isPinned
                                ? 'bg-stone-100 border-stone-300 text-stone-700 hover:bg-stone-200 hover:border-stone-400'
                                : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50 hover:border-stone-300'
                              }`}
                            onClick={() => {
                              setSelectedArticleId(article.id);
                              // 對文章 ID 進行 URL 編碼，以支援中文字符等特殊字符
                              window.location.hash = `#articles/${encodeURIComponent(article.id)}`;
                            }}
                          >
                          <div className="flex justify-between items-start mb-1">
                            <div className="flex items-start flex-1 gap-2">
                              {article.isPinned && (
                                <span
                                  className="text-sm mt-0.5"
                                  role="img"
                                  aria-label="Pinned announcement"
                                >
                                  📌
                                </span>
                              )}
                              <p className="text-lg font-medium flex-1 text-stone-800">
                                {article.title}
                              </p>
                            </div>
                            {article.date && (
                              <span
                                className={`text-[11px] ml-4 flex-shrink-0 ${article.isPinned ? 'text-stone-500' : 'text-stone-400'
                                  }`}
                              >
                                {article.date}
                              </span>
                            )}
                          </div>
                          {/* 標籤顯示（顯示 cat 分類） */}
                          {article.cat && (
                            <div className="flex flex-wrap gap-1.5 mt-2 mb-1">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                                {article.cat}
                              </span>
                            </div>
                          )}
                          {(article.pinMessage || article.preview) && (
                            <p
                              className={`text-xs article-preview mt-1 ${article.isPinned ? 'text-stone-600' : 'text-stone-500'
                                }`}
                            >
                              {article.pinMessage || article.preview}
                            </p>
                          )}
                          </AnimatedCard>
                        );
                      })}
                    </>
                  )}

                  {regularArticles.length === 0 && pinnedArticles.length === 0 && (
                    <p className="text-center text-xs text-stone-400">
                      {articleSearch.trim()
                        ? <>找不到符合「{articleSearch}」的文章。</>
                        : '目前還沒有文章。'}
                    </p>
                  )}

                  {/* 分頁控制（只在有文章時顯示）- 簡約風格 */}
                  {regularArticles.length > 0 && totalPages > 1 && (
                    <div className="pt-6 mt-6 border-t border-stone-200" data-pagination-bottom>
                      <div className="flex items-center justify-center gap-3 flex-wrap">
                        {/* 上一頁 */}
                        <button
                          type="button"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                          className={`text-xs text-stone-500 transition-colors ${currentPage === 1
                              ? 'opacity-40 cursor-not-allowed'
                              : 'hover:text-stone-700'
                            }`}
                        >
                          ← 上一頁
                        </button>

                        {/* 頁碼指示器 */}
                        <div className="flex items-center gap-1.5">
                          {(() => {
                            const pages: (number | string)[] = [];
                            const showEllipsis = totalPages > 7; // 超過 7 頁才顯示省略號

                            if (!showEllipsis) {
                              // 頁數少時，顯示所有頁碼
                              for (let i = 1; i <= totalPages; i++) {
                                pages.push(i);
                              }
                            } else {
                              // 頁數多時，使用省略號邏輯
                              pages.push(1); // 總是顯示第一頁

                              if (currentPage <= 4) {
                                // 當前頁在前幾頁時
                                for (let i = 2; i <= 5; i++) {
                                  pages.push(i);
                                }
                                pages.push('ellipsis');
                                pages.push(totalPages);
                              } else if (currentPage >= totalPages - 3) {
                                // 當前頁在後幾頁時
                                pages.push('ellipsis');
                                for (let i = totalPages - 4; i <= totalPages; i++) {
                                  pages.push(i);
                                }
                              } else {
                                // 當前頁在中間時
                                pages.push('ellipsis');
                                for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                                  pages.push(i);
                                }
                                pages.push('ellipsis');
                                pages.push(totalPages);
                              }
                            }

                            return pages.map((item, index) => {
                              if (item === 'ellipsis') {
                                return (
                                  <span key={`ellipsis-${index}`} className="text-xs text-stone-300 px-1">
                                    ...
                                  </span>
                                );
                              }

                              const page = item as number;
                              const isActive = currentPage === page;
                              return (
                                <button
                                  key={page}
                                  type="button"
                                  onClick={() => setCurrentPage(page)}
                                  className={`text-xs min-w-[24px] h-6 px-1.5 transition-colors ${
                                    isActive
                                      ? 'text-stone-800 font-medium border-b-2 border-stone-600'
                                      : 'text-stone-400 hover:text-stone-600'
                                  }`}
                                >
                                  {page}
                                </button>
                              );
                            });
                          })()}
                        </div>

                        {/* 下一頁 */}
                        <button
                          type="button"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                          className={`text-xs text-stone-500 transition-colors ${currentPage === totalPages
                              ? 'opacity-40 cursor-not-allowed'
                              : 'hover:text-stone-700'
                            }`}
                        >
                          下一頁 →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 文章內容（選到文章之後顯示） */}
              {selectedArticleSummary && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className="text-xs text-stone-500 hover:text-stone-700 underline"
                      onClick={() => {
                        setSelectedArticleId(null);
                        window.location.hash = '#articles';
                      }}
                    >
                      ← 返回文章列表
                    </button>
                    <CopyLinkButton
                      url={`${window.location.origin}/articles/${encodeURIComponent(selectedArticleSummary.id)}/`}
                    />
                  </div>

                  <div className="px-4 py-3 rounded-lg border border-stone-200 bg-white">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-8">
                      <div className="flex items-center gap-3">
                        {selectedArticleSummary.isPinned && (
                          <span
                            className="text-xl"
                            role="img"
                            aria-label="Pinned announcement"
                          >
                            📌
                          </span>
                        )}
                        <h4 className="text-3xl font-light text-stone-800">
                          {selectedArticleSummary.title}
                        </h4>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        {selectedArticleSummary.date && (
                          <span className="text-[12px] text-stone-400 flex-shrink-0">
                            {selectedArticleSummary.date}
                          </span>
                        )}
                      </div>
                    </div>

                    {isLoadingArticleContent ? (
                      <p className="text-center text-xs text-stone-400 py-8">載入文章內容中...</p>
                    ) : selectedArticleContent ? (
                      <MarkdownArticle content={selectedArticleContent} />
                    ) : (
                      <p className="text-center text-xs text-red-400 py-8">載入文章失敗，請稍後再試。</p>
                    )}
                  </div>

                  {/* 留言板 */}
                  <div className="px-4 py-3 rounded-lg border border-stone-200 bg-white">
                    <CommentSection articleId={selectedArticleSummary.id} articleName={selectedArticleSummary.title} />
                  </div>
                </div>
              )}

              {/* 浮動回到頂端按鈕 - 只在文章展開且滾動超過一個螢幕高度時顯示 */}
              {selectedArticleSummary && (
                <button
                  type="button"
                  className={`fixed bottom-8 right-8 w-10 h-10 rounded-full border border-stone-300 bg-white text-stone-600 hover:bg-stone-50 hover:border-stone-400 shadow-lg transition-all hover:shadow-xl z-50 flex items-center justify-center ${showScrollToTop
                      ? 'opacity-100 translate-y-0 pointer-events-auto'
                      : 'opacity-0 translate-y-2 pointer-events-none'
                    }`}
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  title="回到頂端"
                  aria-label="回到頂端"
                >
                  <span className="text-base">↑</span>
                </button>
              )}
            </section>
          </div>
        )}
            </>
          )}
        </>
      </main>

      {/* Footer */}
      {view !== 'admin' && (
        <footer className="text-center py-8 mt-8">
          <p className="text-xs text-stone-400">&copy; {currentYear} All Rights Reserved.</p>
        </footer>
      )}
    </div>
  );
};

export default App;
