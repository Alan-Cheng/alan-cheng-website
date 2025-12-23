// 後台管理 API 客戶端
// 使用 Edge Function 作為後端，避免在前端暴露 service_role key

// 注意：Vite 只會載入 VITE_ 開頭的環境變數
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

if (!supabaseUrl) {
  console.warn('⚠️ Supabase URL 未設定，請在 .env.local 中設定 VITE_SUPABASE_URL');
}

// 獲取 Edge Function 的 URL
function getAdminApiUrl(): string {
  return `${supabaseUrl}/functions/v1/admin-api`;
}

// 獲取認證 token（從 Supabase Auth session）
async function getAuthToken(): Promise<string | null> {
  const { getAccessToken } = await import('./admin-auth');
  return await getAccessToken();
}

// 建立 API 請求
async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('未登入，請先登入後台');
  }

  if (!supabaseUrl) {
    throw new Error('Supabase URL 未設定，請在 .env.local 中設定 VITE_SUPABASE_URL');
  }

  const url = `${getAdminApiUrl()}${endpoint}`;
  
  // 調試：記錄請求資訊
  console.log('Admin API Request:', {
    url,
    endpoint,
    hasToken: !!token,
    tokenLength: token ? token.length : 0,
    tokenPrefix: token ? token.substring(0, 20) : null,
  });
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`, // 確保使用 Bearer 格式
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '', // Supabase Edge Function 需要 apikey
        ...options.headers,
      },
    });

    // 處理網路錯誤
    if (!response.ok) {
      // 如果是 404，可能是 Edge Function 還沒部署
      if (response.status === 404) {
        throw new Error(
          'Edge Function 未找到。請確認：\n' +
          '1. Edge Function "admin-api" 是否已部署\n' +
          '2. Edge Function URL 是否正確：' + url
        );
      }
      
      // 如果是 401，可能是認證問題
      if (response.status === 401) {
        throw new Error('認證失敗，請重新登入');
      }

      const error = await response.json().catch(() => ({ 
        error: `HTTP ${response.status}: ${response.statusText}` 
      }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response;
  } catch (error: any) {
    // 處理網路連線錯誤
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error(
        '無法連接到 Edge Function。請確認：\n' +
        '1. Edge Function "admin-api" 是否已部署\n' +
        '2. 網路連線是否正常\n' +
        '3. Edge Function URL：' + url + '\n' +
        '4. 檢查瀏覽器 Console 是否有 CORS 錯誤'
      );
    }
    throw error;
  }
}

// API 方法
export const adminApi = {
  // 獲取文章列表
  async getArticles(status?: 'all' | 'published' | 'draft') {
    const endpoint = status && status !== 'all' ? `/articles?status=${status}` : '/articles';
    const response = await apiRequest(endpoint);
    const data = await response.json();
    // 確保返回的是數組
    return Array.isArray(data) ? data : [];
  },

  // 獲取單篇文章
  async getArticle(id: string) {
    const response = await apiRequest(`/articles/${id}`);
    const data = await response.json();
    
    // 檢查是否有錯誤
    if (data && data.error) {
      throw new Error(data.error);
    }
    
    return data;
  },

  // 建立文章
  async createArticle(articleData: any) {
    const response = await apiRequest('/articles', {
      method: 'POST',
      body: JSON.stringify(articleData),
    });
    return response.json();
  },

  // 更新文章
  async updateArticle(id: string, articleData: any) {
    const response = await apiRequest(`/articles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(articleData),
    });
    return response.json();
  },

  // 刪除文章
  async deleteArticle(id: string) {
    const response = await apiRequest(`/articles/${id}`, {
      method: 'DELETE',
    });
    return response.json();
  },

  // 獲取文章編輯歷史
  async getArticleHistory(articleId: string) {
    const response = await apiRequest(`/articles/${articleId}/history`);
    const data = await response.json();
    // 確保返回的是數組
    return Array.isArray(data) ? data : [];
  },

  // 還原文章到指定歷史版本
  async restoreArticle(articleId: string, historyId: string) {
    const response = await apiRequest(`/articles/${articleId}/restore`, {
      method: 'POST',
      body: JSON.stringify({ historyId }),
    });
    return response.json();
  },

  // 上傳圖片到 Cloudflare Worker
  async uploadImage(file: File): Promise<{ url: string; filename: string }> {
    const apiKey = import.meta.env.VITE_IMG_WORKER_API_TOKEN;
    if (!apiKey) {
      throw new Error('圖片上傳 API Token 未設定，請在 .env.local 中設定 IMG_WORKER_API_TOKEN 或 VITE_IMG_WORKER_API_TOKEN');
    }

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('https://image.alan-cheng.com/images', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ 
        error: `HTTP ${response.status}: ${response.statusText}` 
      }));
      throw new Error(error.error || `上傳失敗: HTTP ${response.status}`);
    }

    const data = await response.json();
    return data;
  },
};

