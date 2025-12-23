import React, { useState } from 'react';
import type { Project } from '../types';
import { LinkIcon } from './icons/LinkIcon';
import { GithubIcon } from './icons/GithubIcon';

interface ProjectCardProps {
  project: Project;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const hasGithubUrl = !!project.githubUrl;
  // 判斷 link 是否是網站連結（不是 GitHub 連結）
  const isWebsiteLink = project.link && !project.link.includes('github.com');

  return (
    <div className="group block bg-white rounded-lg overflow-hidden shadow-sm border border-stone-200/80 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col">
      <div className="aspect-w-3 aspect-h-2 overflow-hidden bg-stone-100 relative">
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin"></div>
          </div>
        )}
        {imageError && (
          <div className="absolute inset-0 flex items-center justify-center bg-stone-100">
            <div className="text-stone-400 text-xs">圖片載入失敗</div>
          </div>
        )}
        <img 
          src={project.imageUrl} 
          alt={project.title}
          className={`object-cover w-full h-full transition-all duration-500 group-hover:scale-110 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            setImageError(true);
            setImageLoaded(false);
          }}
          loading="lazy"
        />
      </div>
      <div className="p-5 flex flex-col flex-grow">
        <h4 className="text-md font-medium text-stone-800 truncate">{project.title}</h4>
        <p className="text-xs text-stone-500 mt-1.5 h-16">{project.description}</p>
        <div className="mt-auto pt-3 flex items-center justify-between">
          <div>
            {/* 如果有網站連結，顯示「查看網站」 */}
            {isWebsiteLink && (
              <a
                href={project.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group/website flex items-center text-xs text-stone-400 hover:text-amber-700 transition-all duration-300 hover:underline hover:underline-offset-2"
                onClick={(e) => e.stopPropagation()}
              >
                <LinkIcon className="w-3 h-3 mr-1.5 transition-transform duration-300 group-hover/website:rotate-12" />
                <span>查看網站</span>
              </a>
            )}
            {/* 如果沒有網站連結也沒有 GitHub 連結，顯示一般連結（備用） */}
            {!isWebsiteLink && !hasGithubUrl && project.link && (
              <a
                href={project.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-xs text-stone-400 hover:text-amber-700 transition-colors"
              >
                <LinkIcon className="w-3 h-3 mr-1.5" />
                <span>查看連結</span>
              </a>
            )}
          </div>
          <div>
            {/* 如果有 GitHub 連結，顯示「原始碼」 */}
            {hasGithubUrl && (
              <a
                href={project.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group/github flex items-center text-xs text-stone-400 hover:text-stone-800 transition-all duration-300 hover:bg-stone-100 px-2 py-1 rounded"
                onClick={(e) => e.stopPropagation()}
              >
                <GithubIcon className="w-3 h-3 mr-1.5 transition-transform duration-300 group-hover/github:scale-110" />
                <span>原始碼</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
