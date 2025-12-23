import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

type MarkdownArticleProps = {
  /** 要載入的 markdown 檔案路徑（相對於網站根目錄，例如：/posts/first-post.md） */
  src?: string;
  /** 直接傳入的 markdown 內容（如果有就不再發 fetch） */
  content?: string;
  /** 區塊標題（顯示在文章上方） */
  title?: string;
};

export const MarkdownArticle: React.FC<MarkdownArticleProps> = ({
  src,
  content: initialContent,
  title,
}) => {
  const [content, setContent] = useState<string>(initialContent || '');
  const [isLoading, setIsLoading] = useState<boolean>(!!src && !initialContent);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 如果有直接給 content，就不需要發 fetch
    if (initialContent) {
      setContent(initialContent);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (!src) {
      setContent('');
      setIsLoading(false);
      setError('沒有提供文章來源。');
      return;
    }

    let isMounted = true;

    setIsLoading(true);
    setError(null);

    fetch(src)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to load markdown: ${res.status}`);
        }
        const text = await res.text();
        if (isMounted) {
          setContent(text);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error loading markdown:', err);
        if (isMounted) {
          setError('載入文章失敗，請稍後再試。');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [src, initialContent]);

  return (
    <section>
      {title && (
        <h3 className="text-xl font-light text-center text-stone-800 mb-6 tracking-wider">
          {title}
        </h3>
      )}

      {isLoading && (
        <p className="text-center text-stone-400 text-sm">文章載入中...</p>
      )}

      {error && (
        <p className="text-center text-red-400 text-sm">{error}</p>
      )}

      {!isLoading && !error && (
        <article className="markdown-body text-sm md:text-base leading-relaxed text-stone-700">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeHighlight, rehypeKatex]}
            components={{
              img: ({ node, ...props }) => (
                <img
                  {...props}
                  className="max-w-full h-auto rounded-lg my-4 shadow-md"
                  loading="lazy"
                  alt={props.alt || '圖片'}
                />
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </article>
      )}
    </section>
  );
};


