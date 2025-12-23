import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  // 處理 CORS preflight 請求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 從環境變數獲取 Supabase 設定
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminPassword = Deno.env.get('ADMIN_PASSWORD') || 'admin123';

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ error: '伺服器設定錯誤：缺少必要的環境變數' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 建立 Supabase 客戶端（使用 service_role key）
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 解析請求
    const url = new URL(req.url);
    // 處理不同的路徑格式：/functions/v1/admin-api/... 或 /admin-api/...
    let path = url.pathname;
    if (path.includes('/admin-api')) {
      path = path.substring(path.indexOf('/admin-api') + '/admin-api'.length);
    }
    // 確保路徑以 / 開頭
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    const method = req.method;
    
    console.log('請求路徑:', url.pathname, '解析後:', path, '方法:', method);

    // 驗證管理員身份 - 使用 Supabase Auth JWT
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: '未授權：需要管理員認證' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const token = authHeader.replace('Bearer ', '').trim();
    
    // 使用 Supabase Admin 客戶端驗證 JWT token
    // 建立一個臨時的 Supabase 客戶端來驗證 token
    const supabaseForAuth = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 驗證 JWT token
    const { data: { user }, error: authError } = await supabaseForAuth.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          error: '未授權：無效的認證 token',
          message: '請重新登入'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 可選：檢查用戶是否為管理員（可以透過檢查 email 或 user metadata）
    // 這裡我們假設所有通過 Supabase Auth 的用戶都是管理員
    // 如果需要更嚴格的檢查，可以在這裡加入額外的驗證邏輯
    
    // 在生產環境中，可以考慮：
    // 1. 使用 JWT 簽名和驗證
    // 2. 將 token 儲存在資料庫中並驗證
    // 3. 使用 Supabase Auth 進行認證

    // 路由處理
    if (path === '/articles' && method === 'GET') {
      // 獲取文章列表
      const status = url.searchParams.get('status') || 'all';
      
      let query = supabaseAdmin.from('articles').select('*').order('created_at', { ascending: false });
      
      if (status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('查詢文章列表錯誤:', error);
        throw error;
      }

      // 確保返回的是數組格式
      const result = Array.isArray(data) ? data : [];
      
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path.startsWith('/articles/') && method === 'GET' && !path.endsWith('/history') && !path.endsWith('/restore')) {
      // 獲取單篇文章
      // 更可靠的路徑解析：移除前綴並提取 ID
      const pathParts = path.split('/').filter(p => p);
      const articleIndex = pathParts.indexOf('articles');
      
      if (articleIndex === -1 || articleIndex >= pathParts.length - 1) {
        return new Response(
          JSON.stringify({ error: '無效的文章 ID' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      
      const articleId = decodeURIComponent(pathParts[articleIndex + 1]);
      console.log('獲取單篇文章，ID:', articleId, '路徑:', path);
      
      const { data, error } = await supabaseAdmin
        .from('articles')
        .select('*')
        .eq('id', articleId)
        .maybeSingle();

      if (error) {
        console.error('查詢單篇文章錯誤:', error);
        console.error('錯誤詳情:', JSON.stringify(error, null, 2));
        throw error;
      }

      if (!data) {
        console.log('找不到文章，ID:', articleId);
        return new Response(
          JSON.stringify({ error: '找不到指定的文章', articleId }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      console.log('成功獲取文章，ID:', articleId);
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path === '/articles' && method === 'POST') {
      // 建立新文章
      const body = await req.json();
      
      // 如果沒有提供 ID，自動生成一個基於日期的 ID
      let articleId = body.id;
      if (!articleId) {
        const date = body.date || new Date().toISOString().split('T')[0];
        articleId = date.replace(/-/g, '');
      }
      
      // 檢查 ID 是否已存在，如果存在則自動添加序號
      let finalId = articleId;
      let counter = 1;
      let maxAttempts = 100; // 防止無限循環
      
      while (counter <= maxAttempts) {
        const { data: existing } = await supabaseAdmin
          .from('articles')
          .select('id')
          .eq('id', finalId)
          .maybeSingle();
        
        if (!existing) {
          // ID 不存在，可以使用
          break;
        }
        
        // ID 已存在，生成新的 ID（添加序號）
        counter++;
        finalId = `${articleId}-${counter}`;
      }
      
      if (counter > maxAttempts) {
        throw new Error('無法生成唯一的文章 ID，請稍後再試');
      }
      
      const { data, error } = await supabaseAdmin
        .from('articles')
        .insert({
          ...body,
          id: finalId,
          created_by: 'admin',
        })
        .select()
        .single();

      if (error) {
        console.error('建立文章錯誤:', error);
        throw error;
      }

      console.log('成功建立文章，ID:', finalId, '標題:', data?.title);

      // 觸發 Cloudflare Pages build
      try {
        const webhookUrl = 'https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/ee7986a9-18ae-42f7-a2ff-6b8921fc4685';
        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!webhookResponse.ok) {
          console.warn('Cloudflare Pages webhook 觸發失敗:', webhookResponse.status, webhookResponse.statusText);
        } else {
          console.log('Cloudflare Pages build 已觸發');
        }
      } catch (webhookError) {
        console.error('觸發 Cloudflare Pages webhook 時發生錯誤:', webhookError);
        // 不影響主要流程，繼續返回成功
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path.startsWith('/articles/') && method === 'PUT' && !path.endsWith('/restore')) {
      // 更新文章
      const pathParts = path.split('/').filter(p => p);
      const articleIndex = pathParts.indexOf('articles');
      const rawArticleId = articleIndex !== -1 && articleIndex < pathParts.length - 1 
        ? pathParts[articleIndex + 1] 
        : path.replace('/articles/', '');
      const articleId = decodeURIComponent(rawArticleId);
      const body = await req.json();
      
      const { data, error } = await supabaseAdmin
        .from('articles')
        .update({
          ...body,
          created_by: 'admin',
        })
        .eq('id', articleId)
        .select()
        .single();

      if (error) {
        console.error('更新文章錯誤:', error);
        throw error;
      }

      console.log('成功更新文章，ID:', articleId, '標題:', data?.title);

      // 觸發 Cloudflare Pages build
      try {
        const webhookUrl = 'https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/ee7986a9-18ae-42f7-a2ff-6b8921fc4685';
        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!webhookResponse.ok) {
          console.warn('Cloudflare Pages webhook 觸發失敗:', webhookResponse.status, webhookResponse.statusText);
        } else {
          console.log('Cloudflare Pages build 已觸發');
        }
      } catch (webhookError) {
        console.error('觸發 Cloudflare Pages webhook 時發生錯誤:', webhookError);
        // 不影響主要流程，繼續返回成功
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (path.startsWith('/articles/') && method === 'DELETE') {
      // 刪除文章
      const pathParts = path.split('/').filter(p => p);
      const articleIndex = pathParts.indexOf('articles');
      const rawArticleId = articleIndex !== -1 && articleIndex < pathParts.length - 1 
        ? pathParts[articleIndex + 1] 
        : path.replace('/articles/', '').replace('/history', '').replace('/restore', '');
      const articleId = decodeURIComponent(rawArticleId);
      
      const { data, error } = await supabaseAdmin
        .from('articles')
        .delete()
        .eq('id', articleId);

      if (error) {
        throw error;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path.startsWith('/articles/') && path.endsWith('/history') && method === 'GET') {
      // 獲取文章編輯歷史
      const pathParts = path.split('/').filter(p => p);
      const articleIndex = pathParts.indexOf('articles');
      const rawArticleId = articleIndex !== -1 && articleIndex < pathParts.length - 1 
        ? pathParts[articleIndex + 1] 
        : path.replace('/articles/', '').replace('/history', '');
      const articleId = decodeURIComponent(rawArticleId);
      
      const { data, error } = await supabaseAdmin
        .from('article_history')
        .select('*')
        .eq('article_id', articleId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('查詢文章歷史錯誤:', error);
        throw error;
      }

      // 確保返回的是數組格式
      const result = Array.isArray(data) ? data : [];
      
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path.startsWith('/articles/') && path.endsWith('/restore') && method === 'POST') {
      // 還原文章到指定歷史版本
      const pathParts = path.split('/').filter(p => p);
      const articleIndex = pathParts.indexOf('articles');
      const rawArticleId = articleIndex !== -1 && articleIndex < pathParts.length - 1 
        ? pathParts[articleIndex + 1] 
        : path.replace('/articles/', '').replace('/restore', '');
      const articleId = decodeURIComponent(rawArticleId);
      const body = await req.json();
      const { historyId } = body;

      // 先獲取歷史記錄
      const { data: history, error: historyError } = await supabaseAdmin
        .from('article_history')
        .select('*')
        .eq('id', historyId)
        .maybeSingle();

      if (historyError) {
        console.error('查詢歷史記錄錯誤:', historyError);
        throw historyError;
      }

      if (!history) {
        throw new Error('找不到指定的歷史記錄');
      }

      // 還原文章
      const { data, error } = await supabaseAdmin
        .from('articles')
        .update({
          title: history.title,
          content: history.content,
          created_by: 'admin',
        })
        .eq('id', articleId);

      if (error) {
        throw error;
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ error: '找不到指定的路由' }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || '伺服器錯誤' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});