import React, { useState, useEffect } from 'react';
import { adminApi } from '../../lib/admin-api';

type Article = {
  id: string;
  title: string;
  date: string | null;
  cat: string | null;
  status: 'published' | 'draft';
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
};

type ArticleListProps = {
  onEdit: (articleId: string) => void;
  onDelete: (articleId: string) => void;
  onViewHistory: (articleId: string) => void;
  refreshTrigger?: number; // 用於觸發重新載入
};

export const ArticleList: React.FC<ArticleListProps> = ({
  onEdit,
  onDelete,
  onViewHistory,
  refreshTrigger,
}) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [error, setError] = useState<string | null>(null);

  const loadArticles = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await adminApi.getArticles(filter);
      setArticles(data || []);
    } catch (err: any) {
      console.error('載入文章失敗:', err);
      const errorMessage = err.message || '載入文章失敗';
      // 如果是 Edge Function 相關錯誤，顯示更詳細的訊息
      if (errorMessage.includes('Edge Function') || errorMessage.includes('無法連接')) {
        setError(errorMessage);
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadArticles();
  }, [filter, refreshTrigger]);

  const handleDelete = async (articleId: string, title: string) => {
    if (!confirm(`確定要刪除文章「${title}」嗎？此操作無法復原。`)) {
      return;
    }

    try {
      await adminApi.deleteArticle(articleId);
      await loadArticles();
    } catch (err: any) {
      alert(`刪除失敗: ${err.message}`);
    }
  };

  const handleToggleStatus = async (article: Article) => {
    const newStatus = article.status === 'published' ? 'draft' : 'published';
    
    try {
      await adminApi.updateArticle(article.id, { status: newStatus });
      await loadArticles();
    } catch (err: any) {
      alert(`更新狀態失敗: ${err.message}`);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-stone-500">載入中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button
          onClick={loadArticles}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          重試
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* 篩選器 */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-stone-800 text-white'
                : 'bg-white text-stone-700 hover:bg-stone-100'
            }`}
          >
            全部 ({articles.length})
          </button>
          <button
            onClick={() => setFilter('published')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === 'published'
                ? 'bg-stone-800 text-white'
                : 'bg-white text-stone-700 hover:bg-stone-100'
            }`}
          >
            已發布 ({articles.filter((a) => a.status === 'published').length})
          </button>
          <button
            onClick={() => setFilter('draft')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === 'draft'
                ? 'bg-stone-800 text-white'
                : 'bg-white text-stone-700 hover:bg-stone-100'
            }`}
          >
            草稿 ({articles.filter((a) => a.status === 'draft').length})
          </button>
        </div>
        <button
          onClick={loadArticles}
          className="px-4 py-2 bg-stone-800 text-white rounded-md hover:bg-stone-900 text-sm"
        >
          重新整理
        </button>
      </div>

      {/* 文章列表 */}
      {articles.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-stone-200">
          <p className="text-stone-500">目前沒有文章</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-200">
              <thead className="bg-stone-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider min-w-[300px]">
                    標題
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider whitespace-nowrap">
                    日期
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider whitespace-nowrap">
                    分類
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider whitespace-nowrap">
                    狀態
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider whitespace-nowrap">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-stone-200">
                {articles.map((article) => (
                  <tr key={article.id} className="hover:bg-stone-50">
                    <td className="px-4 py-4">
                      <div className="flex items-center">
                        {article.is_pinned && (
                          <span className="mr-2 text-yellow-500 flex-shrink-0" title="置頂">📌</span>
                        )}
                        <span className="text-sm font-medium text-stone-900 break-words">
                          {article.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-stone-500">
                      {article.date || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-stone-500">
                      {article.cat || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(article)}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          article.status === 'published'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        } hover:opacity-80`}
                      >
                        {article.status === 'published' ? '已發布' : '草稿'}
                      </button>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => onEdit(article.id)}
                          className="text-blue-600 hover:text-blue-900 whitespace-nowrap"
                        >
                          編輯
                        </button>
                        <button
                          onClick={() => onViewHistory(article.id)}
                          className="text-purple-600 hover:text-purple-900 whitespace-nowrap"
                        >
                          歷史
                        </button>
                        <button
                          onClick={() => handleDelete(article.id, article.title)}
                          className="text-red-600 hover:text-red-900 whitespace-nowrap"
                        >
                          刪除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

