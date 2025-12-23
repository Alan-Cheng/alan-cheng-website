import React, { useState, useEffect, useRef } from 'react';
import imageCompression from 'browser-image-compression';
// @ts-ignore - heic2any 沒有類型定義
import heic2any from 'heic2any';
import { adminApi } from '../../lib/admin-api';
import { MarkdownArticle } from '../MarkdownArticle';

type ArticleEditorProps = {
  articleId: string | null; // null 表示新增
  onSave: () => void;
  onCancel: () => void;
};

type ArticleData = {
  id: string;
  title: string;
  content: string;
  date: string;
  cat: string;
  preview: string;
  is_pinned: boolean;
  pin_message: string | null;
  status: 'published' | 'draft';
};

// 獲取台北時間的日期字串 (YYYY-MM-DD)
const getTaipeiDate = (): string => {
  const now = new Date();
  // 使用 Intl.DateTimeFormat 獲取台北時間
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
};

type ArticleOption = {
  id: string;
  title: string;
};

export const ArticleEditor: React.FC<ArticleEditorProps> = ({
  articleId,
  onSave,
  onCancel,
}) => {
  const [isLoading, setIsLoading] = useState(!!articleId);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [articleOptions, setArticleOptions] = useState<ArticleOption[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [splitPosition, setSplitPosition] = useState(50); // 預設 50% 分割
  const [isDragging, setIsDragging] = useState(false);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState<Partial<ArticleData>>({
    title: '',
    content: '',
    date: getTaipeiDate(),
    cat: '',
    preview: '',
    is_pinned: false,
    pin_message: null,
    status: 'draft',
  });

  useEffect(() => {
    if (articleId) {
      loadArticle();
    } else {
      // 新增模式時，載入文章列表供複製使用
      loadArticleOptions();
    }
  }, [articleId]);

  const loadArticleOptions = async () => {
    setIsLoadingOptions(true);
    try {
      const articles = await adminApi.getArticles('all');
      setArticleOptions(
        articles.map((article: any) => ({
          id: article.id,
          title: article.title,
        }))
      );
    } catch (err: any) {
      console.error('載入文章列表失敗:', err);
      // 不顯示錯誤，因為這不是必須的功能
    } finally {
      setIsLoadingOptions(false);
    }
  };

  const handleCopyArticle = async (sourceArticleId: string) => {
    if (!sourceArticleId) return;

    setIsLoading(true);
    try {
      const sourceArticle = await adminApi.getArticle(sourceArticleId);
      
      // 複製文章內容和設定，但清除 id（因為是新文章）
      setFormData({
        title: `${sourceArticle.title}（複製）`,
        content: sourceArticle.content || '',
        date: sourceArticle.date || getTaipeiDate(),
        cat: sourceArticle.cat || '',
        preview: sourceArticle.preview || '',
        is_pinned: false, // 複製時不保留置頂狀態
        pin_message: null, // 複製時清除置頂訊息
        status: 'draft', // 複製時預設為草稿
      });
      
      alert('已複製文章內容和設定！');
    } catch (err: any) {
      alert(`載入文章失敗: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 處理拖動分隔線
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const percentage = (relativeX / rect.width) * 100;
      
      // 限制在 20% 到 80% 之間
      const clampedPercentage = Math.max(20, Math.min(80, percentage));
      setSplitPosition(clampedPercentage);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  const loadArticle = async () => {
    setIsLoading(true);
    try {
      const data = await adminApi.getArticle(articleId!);
      
      setFormData({
        id: data.id,
        title: data.title,
        content: data.content,
        date: data.date || getTaipeiDate(),
        cat: data.cat || '',
        preview: data.preview || '',
        is_pinned: data.is_pinned || false,
        pin_message: data.pin_message,
        status: data.status,
      });
    } catch (err: any) {
      alert(`載入文章失敗: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const extractPreview = (content: string, maxLength = 150): string => {
    if (!content) return '';
    
    let text = content
      // 移除 HTML 圖片標籤（<img> 和 <img />）
      .replace(/<img[^>]*>/gi, '')
      // 移除代碼塊（```code```）
      .replace(/```[\s\S]*?```/g, '')
      // 移除行內代碼（`code`）
      .replace(/`[^`]+`/g, '')
      // 移除標題標記（# Title）
      .replace(/^#{1,6}\s+/gm, '')
      // 移除粗體（**bold**）
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      // 移除斜體（*italic*）
      .replace(/\*([^*]+)\*/g, '$1')
      // 移除刪除線（~~strikethrough~~）
      .replace(/~~([^~]+)~~/g, '$1')
      // 移除圖片標記（![alt](url) 和 ![alt](url "title")）
      .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '')
      .replace(/!\[([^\]]*)\]\([^\)]+(?:\s+"[^"]*")?\)/g, '')
      // 移除連結標記，保留文字（[text](url)）
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      // 移除參考式連結（[text][ref]）
      .replace(/\[([^\]]+)\]\[[^\]]+\]/g, '$1')
      // 移除自動連結（<url>）
      .replace(/<https?:\/\/[^>]+>/g, '')
      // 移除列表標記（- item、* item、+ item）
      .replace(/^[\s]*[-*+]\s+/gm, '')
      // 移除有序列表標記（1. item）
      .replace(/^\d+\.\s+/gm, '')
      // 移除水平線（---）
      .replace(/^---+$/gm, '')
      // 移除引用標記（> quote）
      .replace(/^>\s+/gm, '')
      // 移除表格標記（| col |）
      .replace(/\|/g, ' ')
      // 移除多餘的空白行
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // 移除 HTML 標籤（如果還有殘留的）
      .replace(/<[^>]+>/g, '')
      // 移除 HTML 實體
      .replace(/&[#\w]+;/g, ' ')
      // 分割成行，移除空白行
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join(' ')
      // 移除多餘空格
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
  };

  // 自動調整 textarea 高度
  const adjustTextareaHeight = () => {
    const textarea = contentTextareaRef.current;
    if (!textarea) return;
    
    // 重置高度以獲取正確的 scrollHeight
    textarea.style.height = 'auto';
    // 設置為內容高度，但至少保持最小高度
    const newHeight = Math.max(textarea.scrollHeight, 200);
    textarea.style.height = `${newHeight}px`;
  };

  // 當內容改變時自動調整高度
  useEffect(() => {
    adjustTextareaHeight();
  }, [formData.content]);

  // 當載入文章後調整高度
  useEffect(() => {
    if (!isLoading && formData.content) {
      setTimeout(() => adjustTextareaHeight(), 100);
    }
  }, [isLoading]);

  // 在游標位置插入文字
  const insertTextAtCursor = (text: string) => {
    const textarea = contentTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const content = formData.content || '';
    const newContent = content.substring(0, start) + text + content.substring(end);
    
    setFormData({ ...formData, content: newContent });
    
    // 設定游標位置到插入文字之後
    setTimeout(() => {
      const newCursorPos = start + text.length;
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      adjustTextareaHeight();
    }, 0);
  };

  // 處理圖片上傳
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 檢查檔案類型
    if (!file.type.startsWith('image/')) {
      alert('請選擇圖片檔案');
      return;
    }

    // 檢查檔案大小（限制 10MB）
    if (file.size > 10 * 1024 * 1024) {
      alert('圖片大小不能超過 10MB');
      return;
    }

    setIsUploading(true);
    try {
      let processedFile = file;
      const isHEIC = file.type === 'image/heic' || 
                     file.type === 'image/heif' || 
                     file.name.toLowerCase().endsWith('.heic') ||
                     file.name.toLowerCase().endsWith('.heif');

      // 如果是 HEIC 格式，先轉換成 JPEG
      if (isHEIC) {
        try {
          console.log('檢測到 HEIC 格式，開始轉換為 JPEG...');
          const convertedBlob = await heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.9, // 轉換質量
          });
          
          // heic2any 可能返回數組，取第一個
          const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
          
          // 將 Blob 轉換為 File
          const fileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
          processedFile = new File([blob], fileName, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          
          console.log(`HEIC 轉換完成: ${(file.size / (1024 * 1024)).toFixed(2)} MB → ${(processedFile.size / (1024 * 1024)).toFixed(2)} MB`);
        } catch (heicError: any) {
          console.error('HEIC 轉換失敗:', heicError);
          alert('HEIC 格式轉換失敗，請嘗試使用其他格式（如 JPEG 或 PNG）');
          setIsUploading(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          return;
        }
      }

      // 參考 optimize-images.js 的配置進行壓縮
      const isJPEG = processedFile.type === 'image/jpeg' || processedFile.type === 'image/jpg';
      const isPNG = processedFile.type === 'image/png';
      const isWebP = processedFile.type === 'image/webp';
      
      // 壓縮選項（參考 optimize-images.js 的配置）
      const compressionOptions = {
        maxSizeMB: 5, // 最大檔案大小 5MB（壓縮後）
        maxWidthOrHeight: 1200, // 最大寬高（調整為 1200px）
        useWebWorker: true, // 使用 Web Worker 提升效能
        fileType: processedFile.type, // 保持原始格式（轉換後是 JPEG）
        initialQuality: isJPEG ? 0.85 : isPNG ? 0.90 : isWebP ? 0.85 : 0.85, // 質量（參考 optimize-images.js）
        alwaysKeepResolution: false, // 允許調整大小
      };

      // 壓縮圖片
      let compressedFile = processedFile;
      try {
        const compressedBlob = await imageCompression(processedFile, compressionOptions);
        
        // 確保壓縮後的檔案有正確的檔案名稱和類型
        // imageCompression 可能返回 Blob，需要轉換為 File 並保留原始檔案名稱
        compressedFile = new File([compressedBlob], processedFile.name, {
          type: processedFile.type,
          lastModified: Date.now(),
        });
        
        const originalSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        const compressedSizeMB = (compressedFile.size / (1024 * 1024)).toFixed(2);
        const savedPercent = ((1 - compressedFile.size / file.size) * 100).toFixed(1);
        
        console.log(`圖片壓縮: ${originalSizeMB} MB → ${compressedSizeMB} MB (節省 ${savedPercent}%)`);
      } catch (compressionError: any) {
        console.warn('圖片壓縮失敗，使用處理後的檔案:', compressionError.message);
        // 壓縮失敗時使用處理後的檔案（可能是轉換後的 JPEG）
        compressedFile = processedFile;
      }

      // 上傳壓縮後的圖片
      const result = await adminApi.uploadImage(compressedFile);
      // 插入 Markdown 圖片語法
      const imageMarkdown = `![${compressedFile.name}](${result.url})\n`;
      insertTextAtCursor(imageMarkdown);
      alert('圖片上傳成功！');
    } catch (err: any) {
      alert(`圖片上傳失敗: ${err.message}`);
    } finally {
      setIsUploading(false);
      // 清空 input，以便可以再次選擇相同檔案
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSave = async () => {
    if (!formData.title?.trim()) {
      alert('請輸入標題');
      return;
    }

    if (!formData.content?.trim()) {
      alert('請輸入內容');
      return;
    }

    setIsSaving(true);
    try {
      const preview = extractPreview(formData.content || '');

      const articleData: any = {
        title: formData.title,
        content: formData.content,
        date: formData.date || null,
        cat: formData.cat || null,
        preview: preview,
        is_pinned: formData.is_pinned || false,
        pin_message: formData.pin_message || null,
        status: formData.status || 'draft',
        created_by: 'admin',
      };

      if (articleId) {
        // 更新現有文章
        await adminApi.updateArticle(articleId, articleData);
      } else {
        // 建立新文章
        // ID 會在後端自動生成（基於日期，如果衝突則自動添加序號）
        // 可以選擇性地提供一個基礎 ID，後端會確保唯一性
        if (formData.date) {
          // 提供基礎 ID，後端會處理衝突
          articleData.id = formData.date.replace(/-/g, '');
        }
        // 如果不提供 ID，後端會自動生成
        await adminApi.createArticle(articleData);
      }

      // Webhook 觸發已移至 Edge Function 中處理，避免 CORS 問題
      alert('儲存成功！');
      onSave();
    } catch (err: any) {
      alert(`儲存失敗: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-[95%] mx-auto text-center py-12">
        <p className="text-stone-500">載入中...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[95%] mx-auto space-y-6">
      {/* 工具列 */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-stone-200">
        <h2 className="text-xl font-semibold text-stone-800">
          {articleId ? '編輯文章' : '新增文章'}
        </h2>
        <div className="flex items-center space-x-4">
          {/* 置頂和發布選項 */}
          <div className="flex items-center space-x-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_pinned || false}
                onChange={(e) => setFormData({ ...formData, is_pinned: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm text-stone-700">置頂</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.status === 'published'}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status: e.target.checked ? 'published' : 'draft',
                  })
                }
                className="mr-2"
              />
              <span className="text-sm text-stone-700">發布</span>
            </label>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="px-4 py-2 bg-stone-100 text-stone-700 rounded-md hover:bg-stone-200 text-sm"
            >
              {showPreview ? '隱藏預覽' : '顯示預覽'}
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-stone-200 text-stone-700 rounded-md hover:bg-stone-300 text-sm"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-stone-800 text-white rounded-md hover:bg-stone-900 text-sm disabled:opacity-50"
            >
              {isSaving ? '儲存中...' : '儲存'}
            </button>
          </div>
        </div>
      </div>

      {/* 文章基本資訊區塊 */}
      <div className="bg-white rounded-lg border border-stone-200 p-6 space-y-4">
        {/* 複製文章功能（僅在新增模式顯示） */}
        {!articleId && (
          <div className="bg-stone-50 border border-stone-200 rounded-md p-4">
            <label className="block text-sm font-medium text-stone-700 mb-2">
              複製現有文章（選填）
            </label>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  handleCopyArticle(e.target.value);
                  e.target.value = ''; // 重置選單
                }
              }}
              disabled={isLoadingOptions || isLoading}
              className="w-full px-4 py-2 border border-stone-300 rounded-md focus:ring-2 focus:ring-stone-500 focus:border-transparent bg-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {isLoadingOptions ? '載入中...' : '選擇要複製的文章'}
              </option>
              {articleOptions.map((article) => (
                <option key={article.id} value={article.id}>
                  {article.title}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-stone-500">
              選擇文章後，會自動複製其內容和設定（標題會加上「複製」標記，狀態會設為草稿）
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">
            標題 *
          </label>
          <input
            type="text"
            value={formData.title || ''}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-4 py-2 border border-stone-300 rounded-md focus:ring-2 focus:ring-stone-500 focus:border-transparent"
            placeholder="輸入文章標題"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              日期
            </label>
            <input
              type="date"
              value={formData.date || ''}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-2 border border-stone-300 rounded-md focus:ring-2 focus:ring-stone-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              分類
            </label>
            <input
              type="text"
              value={formData.cat || ''}
              onChange={(e) => setFormData({ ...formData, cat: e.target.value })}
              className="w-full px-4 py-2 border border-stone-300 rounded-md focus:ring-2 focus:ring-stone-500 focus:border-transparent"
              placeholder="例如：LeetCode"
            />
          </div>
        </div>

        {/* 置頂訊息 */}
        {formData.is_pinned && (
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              置頂訊息
            </label>
            <input
              type="text"
              value={formData.pin_message || ''}
              onChange={(e) => setFormData({ ...formData, pin_message: e.target.value })}
              className="w-full px-4 py-2 border border-stone-300 rounded-md focus:ring-2 focus:ring-stone-500 focus:border-transparent"
              placeholder="置頂時顯示的訊息"
            />
          </div>
        )}
      </div>

      <div 
        ref={containerRef}
        className={`flex gap-6 ${showPreview ? 'items-stretch' : ''}`}
      >
        {/* 編輯區域 */}
        <div 
          className={`bg-white rounded-lg border border-stone-200 p-6 ${showPreview ? 'flex flex-col' : ''}`}
          style={{ 
            width: showPreview ? `${splitPosition}%` : '100%',
            flex: showPreview ? '0 0 auto' : 'none'
          }}
        >
          <div className={showPreview ? 'flex-1 flex flex-col min-h-0' : ''}>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-stone-700">
                內容 (Markdown) *
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                  id="image-upload-input"
                />
                <label
                  htmlFor="image-upload-input"
                  className={`px-3 py-1.5 text-sm rounded-md cursor-pointer transition-colors ${
                    isUploading
                      ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {isUploading ? '上傳中...' : '📷 上傳圖片'}
                </label>
              </div>
            </div>
            <textarea
              ref={contentTextareaRef}
              value={formData.content || ''}
              onChange={(e) => {
                setFormData({ ...formData, content: e.target.value });
                // 延遲調整高度，確保內容已更新
                setTimeout(() => adjustTextareaHeight(), 0);
              }}
              onInput={adjustTextareaHeight}
              className="w-full px-4 py-2 border border-stone-300 rounded-md focus:ring-2 focus:ring-stone-500 focus:border-transparent font-mono text-sm resize-none overflow-hidden"
              style={{ minHeight: '200px', height: 'auto' }}
              placeholder="輸入 Markdown 內容..."
            />
          </div>
        </div>

        {/* 可拖動的分隔線 */}
        {showPreview && (
          <div
            onMouseDown={handleMouseDown}
            className={`flex-shrink-0 w-1 bg-stone-300 hover:bg-stone-400 cursor-col-resize transition-colors ${
              isDragging ? 'bg-stone-500' : ''
            }`}
          />
        )}

        {/* 預覽區域 */}
        {showPreview && (
          <div 
            className="bg-white rounded-lg border border-stone-200 p-6"
            style={{ 
              width: `${100 - splitPosition}%`,
              flex: '0 0 auto'
            }}
          >
            <h3 className="text-lg font-semibold text-stone-800 mb-4">預覽</h3>
            <MarkdownArticle content={formData.content || ''} />
          </div>
        )}
      </div>
    </div>
  );
};

