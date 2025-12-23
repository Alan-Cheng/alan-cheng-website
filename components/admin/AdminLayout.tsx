import React, { ReactNode } from 'react';
import { logout } from '../../lib/admin-auth';

type AdminLayoutProps = {
  children: ReactNode;
  currentView?: string;
  onNavigate?: (view: string) => void;
};

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  currentView = 'list',
  onNavigate,
}) => {
  const handleLogout = async () => {
    if (confirm('確定要登出嗎？')) {
      await logout();
      window.location.hash = '#home';
    }
  };

  const menuItems = [
    { id: 'list', label: '文章列表', icon: '📝' },
    { id: 'new', label: '新增文章', icon: '➕' },
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      {/* 頂部導航欄 */}
      <header className="bg-white border-b border-stone-200 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-stone-800">後台管理</h1>
              <nav className="flex space-x-1">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onNavigate?.(item.id)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      currentView === item.id
                        ? 'bg-stone-100 text-stone-900'
                        : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                    }`}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  window.location.hash = '#home';
                }}
                className="text-sm text-stone-600 hover:text-stone-900"
              >
                返回首頁
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
              >
                登出
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 主要內容區域 */}
      <main className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};

