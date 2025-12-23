import React, { useState } from 'react';
import { LinkIcon } from './icons/LinkIcon';

interface CopyLinkButtonProps {
  /** 要複製的連結 */
  url: string;
}

export const CopyLinkButton: React.FC<CopyLinkButtonProps> = ({ url }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000); // 2 秒後恢復
      } else {
        // 降級方案：使用傳統方法
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error('複製失敗:', err);
      // 如果複製失敗，顯示提示讓用戶手動複製
      prompt('請複製以下連結：', url);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-700 transition-colors"
      title={copied ? '已複製！' : '複製文章連結'}
    >
      <LinkIcon className="w-3.5 h-3.5" />
      <span>{copied ? '已複製！' : '複製連結'}</span>
    </button>
  );
};
