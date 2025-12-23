import React, { useState, useEffect } from 'react';
import { adminApi } from '../../lib/admin-api';

type HistoryRecord = {
  id: string;
  article_id: string;
  title: string;
  content: string;
  changed_fields: any;
  created_at: string;
  created_by: string | null;
};

type HistoryViewProps = {
  articleId: string;
  onClose: () => void;
  onRestore?: (historyId: string) => void;
};

export const HistoryView: React.FC<HistoryViewProps> = ({
  articleId,
  onClose,
  onRestore,
}) => {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, [articleId]);

  const loadHistory = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await adminApi.getArticleHistory(articleId);
      setHistory(data || []);
    } catch (err: any) {
      console.error('載入歷史記錄失敗:', err);
      setError(err.message || '載入歷史記錄失敗');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (historyRecord: HistoryRecord) => {
    if (!confirm('確定要還原到此版本嗎？這會覆蓋目前的文章內容。')) {
      return;
    }

    try {
      await adminApi.restoreArticle(articleId, historyRecord.id);
      alert('還原成功！');
      onRestore?.(historyRecord.id);
      onClose();
    } catch (err: any) {
      alert(`還原失敗: ${err.message}`);
    }
  };

  const formatChangedFields = (changedFields: any): string[] => {
    if (!changedFields || typeof changedFields !== 'object') {
      return [];
    }

    const fields: string[] = [];
    Object.keys(changedFields).forEach((key) => {
      fields.push(key);
    });
    return fields;
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
          onClick={loadHistory}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          重試
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-stone-800">編輯歷史</h2>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-stone-200 text-stone-700 rounded-md hover:bg-stone-300 text-sm"
        >
          關閉
        </button>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-stone-200">
          <p className="text-stone-500">目前沒有歷史記錄</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((record) => {
            const changedFields = formatChangedFields(record.changed_fields);
            const date = new Date(record.created_at).toLocaleString('zh-TW');

            return (
              <div
                key={record.id}
                className="bg-white rounded-lg border border-stone-200 p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm text-stone-500">{date}</p>
                    {changedFields.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {changedFields.map((field) => (
                          <span
                            key={field}
                            className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                          >
                            {field}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleRestore(record)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                  >
                    還原此版本
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  <div>
                    <p className="text-sm font-medium text-stone-700">標題：</p>
                    <p className="text-sm text-stone-600">{record.title}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-stone-700">內容預覽：</p>
                    <p className="text-sm text-stone-600 line-clamp-3">
                      {record.content.substring(0, 200)}...
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

