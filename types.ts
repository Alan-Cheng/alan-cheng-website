export interface Project {
  title: string;
  description: string;
  imageUrl: string;
  link: string;
  category: 'commercial' | 'other';
  githubUrl?: string; // GitHub 原始碼連結（可選）
}