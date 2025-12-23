import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getCookie, setCookie } from '../lib/cookies';

const COMMENT_AUTHOR_COOKIE = 'comment_author_name';
const COMMENTS_PER_PAGE = 10; // 每頁顯示的留言數量

// 留言資料類型
export type Comment = {
  id: string;
  article_id: string;
  article_name: string;
  author_name: string;
  content: string;
  created_at: string;
  parent_id?: string | null;
};

type CommentSectionProps = {
  articleId: string;
  articleName: string;
};

export const CommentSection: React.FC<CommentSectionProps> = ({ articleId, articleName }) => {
  const [authorName, setAuthorName] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // 從 Supabase 載入留言（重置分頁）
  useEffect(() => {
    setCurrentPage(1);
    loadComments(1);
  }, [articleId]);

  // 當頁碼改變時載入對應頁的留言
  useEffect(() => {
    if (currentPage > 0) {
      loadComments(currentPage);
    }
  }, [currentPage]);

  // 載入時從 Cookie 讀取之前使用的暱稱
  useEffect(() => {
    const savedName = getCookie(COMMENT_AUTHOR_COOKIE);
    if (savedName) {
      setAuthorName(savedName);
    }
  }, []);

  const loadComments = async (page: number) => {
    try {
      setIsLoading(true);

      const from = (page - 1) * COMMENTS_PER_PAGE;
      const to = from + COMMENTS_PER_PAGE - 1;

      const { data, error, count } = await supabase
        .from('comments')
        .select('*', { count: 'exact' })
        .eq('article_id', articleId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('載入留言失敗:', error);
        return;
      }

      setComments(data || []);
      
      // 計算總頁數
      const total = count || 0;
      setTotalCount(total);
      setTotalPages(Math.max(1, Math.ceil(total / COMMENTS_PER_PAGE)));
    } catch (error) {
      console.error('載入留言時發生錯誤:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 格式化時間顯示
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return '剛剛';
    } else if (diffMins < 60) {
      return `${diffMins} 分鐘前`;
    } else if (diffHours < 24) {
      return `${diffHours} 小時前`;
    } else if (diffDays < 7) {
      return `${diffDays} 天前`;
    } else {
      return date.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
  };

  // 取得頭像顯示文字（完整名稱，超過五個字則截斷）
  const getAvatarText = (name: string): string => {
    if (!name) return '?';
    // 如果超過五個字，只顯示前五個字
    if (name.length > 5) {
      return name.substring(0, 5);
    }
    return name;
  };

  // 取得頭像顏色（根據名稱生成一致顏色，使用 hex 色碼）
  const getAvatarColor = (name: string): string => {
    // 根據名稱生成 hash
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    hash = Math.abs(hash);

    // 使用 HSL 色彩空間生成豐富的顏色
    // H (色相): 0-360，S (飽和度): 60-79%，L (亮度): 45-60%（確保文字可讀）
    const hue = hash % 360; // 0-360 度色相，涵蓋所有顏色（紅、橙、黃、綠、青、藍、紫等）
    const saturation = 60 + (hash % 20); // 60-79% 飽和度，顏色鮮豔
    const lightness = 45 + (hash % 15); // 45-60% 亮度，不會太亮或太暗

    // 轉換 HSL 為 RGB，再轉為 hex
    const h = hue / 360;
    const s = saturation / 100;
    const l = lightness / 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
    const m = l - c / 2;

    let r = 0, g = 0, b = 0;

    if (h < 1/6) {
      r = c; g = x; b = 0;
    } else if (h < 2/6) {
      r = x; g = c; b = 0;
    } else if (h < 3/6) {
      r = 0; g = c; b = x;
    } else if (h < 4/6) {
      r = 0; g = x; b = c;
    } else if (h < 5/6) {
      r = x; g = 0; b = c;
    } else {
      r = c; g = 0; b = x;
    }

    // 轉換為 0-255 範圍並轉為 hex
    const toHex = (n: number) => {
      const hex = Math.round((n + m) * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  // 將文字中的 URL 轉換為可點擊的超連結
  const linkifyText = (text: string): React.ReactNode => {
    if (!text) return '';

    // URL 正則表達式：匹配 http://, https://, www. 開頭的 URL
    // 排除已經在 HTML 標籤內的 URL
    const urlRegex = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s<>"']*)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let keyCounter = 0;

    while ((match = urlRegex.exec(text)) !== null) {
      // 添加 URL 之前的文字
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // 處理 URL
      let url = match[0];
      let displayUrl = url;

      // 移除 URL 末尾的標點符號（如果有的話，但保留在顯示中）
      const trailingPunctuation = /[.,;:!?]+$/.exec(url);
      if (trailingPunctuation) {
        url = url.slice(0, -trailingPunctuation[0].length);
        displayUrl = url;
      }

      // 如果 URL 沒有協議，添加 https://
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      // 如果 URL 太長，截斷顯示
      if (displayUrl.length > 50) {
        displayUrl = displayUrl.substring(0, 47) + '...';
      }

      // 添加連結元素
      parts.push(
        <a
          key={`link-${keyCounter++}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-stone-600 underline hover:text-stone-800 break-all"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          {displayUrl}
        </a>
      );

      // 如果有尾隨標點符號，也要添加回去
      if (trailingPunctuation) {
        parts.push(trailingPunctuation[0]);
      }

      lastIndex = match.index + match[0].length;
    }

    // 添加剩餘的文字
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    // 如果沒有找到 URL，直接返回原始文字
    return parts.length > 0 ? parts : text;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!authorName.trim() || !content.trim()) {
      alert('請填寫所有欄位');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('comments').insert([
        {
          article_id: articleId,
          article_name: articleName,
          author_name: authorName.trim(),
          content: content.trim(),
        },
      ]);

      if (error) {
        console.error('提交留言失敗:', error);
        alert('回應送出失敗，請稍後再試');
        return;
      }

      // 將暱稱存到 Cookie（365 天過期）
      setCookie(COMMENT_AUTHOR_COOKIE, authorName.trim(), 365);

      // 清空留言內容，但保留暱稱
      setContent('');
      setShowForm(false);

      // 重置到第一頁並重新載入留言列表
      setCurrentPage(1);
      await loadComments(1);
      
    } catch (error) {
      console.error('提交留言時發生錯誤:', error);
      alert('回應送出失敗，請稍後再試');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mt-8 border-stone-200">
      {/* 標題和新增按鈕 */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-xl font-light text-stone-800 tracking-wider">
          留 言 板
        </h2>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-xs text-stone-500 hover:text-stone-700 px-4 py-2 rounded-md border border-stone-200 hover:border-stone-300 bg-white transition-colors flex-shrink-0"
          >
            + 新增留言
          </button>
        )}
      </div>

      {/* 留言列表 */}
      {isLoading ? (
        <div className="mb-8 text-center py-8 text-stone-400 text-sm">
          載入留言中...
        </div>
      ) : comments.length > 0 ? (
        <>
          <div className="space-y-6 mb-8">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="flex gap-2 sm:gap-4 p-3 sm:p-4 rounded-lg bg-white border border-stone-200 hover:border-stone-300 transition-colors"
              >
                {/* 頭像 */}
                <div
                  className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full text-white flex items-center justify-center text-[9px] sm:text-[10px] font-medium px-1 overflow-hidden"
                  style={{ backgroundColor: getAvatarColor(comment.author_name) }}
                >
                  <span className="block text-center leading-tight break-words" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                    {getAvatarText(comment.author_name)}
                  </span>
                </div>

                {/* 留言內容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs sm:text-sm font-medium text-stone-800 break-words">
                      {comment.author_name}
                    </span>
                    <span className="text-[10px] sm:text-xs text-stone-400 flex-shrink-0">
                      {formatDate(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-stone-700 leading-relaxed whitespace-pre-wrap break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                    {linkifyText(comment.content)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* 分頁控制 */}
          {totalPages > 1 && (
            <div className="pt-6 mt-6 border-t border-stone-200">
              <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
                {/* 顯示留言總數和當前頁資訊 */}
                <div className="text-[10px] sm:text-xs text-stone-400 mr-1 sm:mr-2 text-center sm:text-left">
                  共 {totalCount} 則回應，目前為第 {currentPage} / {totalPages} 頁
                </div>

                {/* 上一頁 */}
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  className={`text-[10px] sm:text-xs text-stone-500 transition-colors ${currentPage === 1
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:text-stone-700'
                    }`}
                >
                  ← 上一頁
                </button>

                {/* 頁碼指示器 */}
                <div className="flex items-center gap-1 sm:gap-1.5">
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
                          <span key={`ellipsis-${index}`} className="text-[10px] sm:text-xs text-stone-300 px-0.5 sm:px-1">
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
                          className={`text-[10px] sm:text-xs min-w-[20px] sm:min-w-[24px] h-5 sm:h-6 px-1 sm:px-1.5 transition-colors ${
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
                  className={`text-[10px] sm:text-xs text-stone-500 transition-colors ${currentPage === totalPages
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:text-stone-700'
                    }`}
                >
                  下一頁 →
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="mb-8 text-center py-8 text-stone-400 text-sm">
          目前還沒有回應，成為第一個回應的人吧！
        </div>
      )}

      {/* 新增留言表單 */}
      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="comment-name"
              className="block text-xs text-stone-600 mb-1.5"
            >
              暱稱 <span className="text-stone-400">*</span>
            </label>
            <input
              id="comment-name"
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="請輸入您的暱稱"
              className="w-full px-3 py-2 rounded-md border border-stone-200 text-sm text-stone-700 placeholder:text-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-400 focus:border-stone-400 bg-white"
              required
            />
          </div>

          <div>
            <label
              htmlFor="comment-content"
              className="block text-xs text-stone-600 mb-1.5"
            >
              留言內容 <span className="text-stone-400">*</span>
            </label>
            <textarea
              id="comment-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="請輸入您的留言..."
              rows={5}
              className="w-full px-3 py-2 rounded-md border border-stone-200 text-sm text-stone-700 placeholder:text-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-400 focus:border-stone-400 bg-white resize-none"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                // 取消時不清空暱稱，保留 Cookie 中的值
                setContent('');
              }}
              className="text-xs text-stone-500 hover:text-stone-700 px-3 py-1.5 rounded-md border border-stone-200 hover:border-stone-300 bg-white transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="text-xs text-stone-50 bg-stone-800 hover:bg-stone-700 px-4 py-1.5 rounded-md border border-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '送出中...' : '送出回應'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
};

