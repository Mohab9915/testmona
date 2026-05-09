import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, User, Settings, LogOut, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { NotificationDropdown } from '@/components/NotificationDropdown';
import { ProjectSelector } from '@/components/ProjectSelector';
import { api } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface NavbarProps {
  onMobileMenuToggle: () => void;
  isSidebarCollapsed: boolean;
  onSidebarToggle: () => void;
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
}

export function Navbar({
  onMobileMenuToggle,
  isSidebarCollapsed,
  onSidebarToggle,
  theme,
  onThemeToggle
}: NavbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();
  const { selectedProject, projects } = useProjectStore();
  const { t } = useTranslation();
  const [unreadCount, setUnreadCount] = useState(0);

  const navigation = [
    { name: t('dashboard'), href: '/dashboard' },
    { name: t('projects'), href: '/projects' },
    { name: t('requirements'), href: '/requirements' },
    { name: t('testSuites'), href: '/test-suites' },
    { name: t('testPlans'), href: '/test-plans' },
    { name: t('testRuns'), href: '/test-runs' },
    { name: t('defects'), href: '/defects' },
    { name: t('reports'), href: '/reports' },
    { name: t('milestones'), href: '/milestones' },
    { name: t('customFields'), href: '/custom-fields' },
  ];

  const currentPage = navigation.find(item => location.pathname === item.href)?.name || 
    location.pathname.includes('/test-runs') ? t('testRuns') :
    location.pathname.includes('/test-cases') ? t('testCases') :
    location.pathname.includes('/test-suites') ? t('testSuites') :
    location.pathname.includes('/projects') && selectedProject ? `${selectedProject.name}` :
    t('dashboard');

  const handleProjectSelected = (project: any) => {
    // If user is on a project-scoped route and switches projects, navigate to the new project's equivalent route
    if (location.pathname.startsWith('/projects/') && selectedProject?.id !== project.id) {
      const currentPath = location.pathname;
      const pathParts = currentPath.split('/');
      
      // Replace the project ID in the current route
      if (pathParts.length >= 3) {
        pathParts[2] = project.id.toString();
        const newPath = pathParts.join('/');
        navigate(newPath);
      }
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    // Skip API calls if no user is authenticated
    if (!user) return;

    const fetchUnreadCount = async () => {
      try {
        const response = await api.get('/notifications/unread/count');
        setUnreadCount(response.data.unread_count);
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
        // Silently fail - don't set mock count to avoid confusion
      }
    };

    fetchUnreadCount();
    // Refresh unread count every 60 seconds (reduced from 30)
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 border-b border-gray-200 dark:border-gray-800 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-gray-900/80">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6 max-w-[2000px] mx-auto">
        {/* Left side - Logo/Brand and breadcrumbs */}
        <div className="flex items-center gap-3 lg:gap-5 min-w-0 flex-1">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden h-9 w-9 p-0 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={onMobileMenuToggle}
          >
            <Menu className="h-[18px] w-[18px] text-gray-700 dark:text-gray-300" />
          </Button>

          {/* Desktop sidebar toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="hidden lg:flex h-9 w-9 p-0 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={() => {
              onSidebarToggle();
            }}
            title={isSidebarCollapsed ? t('expandSidebar') : t('collapseSidebar')}
          >
            <Menu className="h-[18px] w-[18px] text-gray-700 dark:text-gray-300" />
          </Button>

          {/* Brand/Logo */}
          <Link to="/dashboard" className="flex items-center gap-2.5 group flex-shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-200 group-hover:scale-105">
              <span className="text-white font-bold text-sm">TM</span>
            </div>
            <div className="hidden sm:block">
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent tracking-tight">TestMona</span>
            </div>
          </Link>

          {/* Breadcrumbs */}
          <div className="hidden md:flex items-center gap-2 text-sm min-w-0">
            <Link
              to="/dashboard"
              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors duration-150 font-medium hover:underline underline-offset-4"
            >
              {t('dashboard')}
            </Link>
            {location.pathname !== '/dashboard' && (
              <>
                <span className="text-gray-400 dark:text-gray-600 select-none">/</span>
                <span className="font-semibold text-gray-900 dark:text-white truncate">
                  {currentPage}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right side - Actions and user menu */}
        <div className="flex items-center gap-2 lg:gap-2.5 flex-shrink-0">
          {/* Project Selector - shown on desktop only when projects exist */}
          {projects.length > 0 && (
            <>
              <div className="hidden sm:block max-w-[200px] lg:max-w-[240px]">
                <ProjectSelector onProjectSelected={handleProjectSelected} />
              </div>

              {/* Divider */}
              <div className="hidden sm:block h-6 w-px bg-gray-200 dark:bg-gray-700" />
            </>
          )}

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onThemeToggle}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            className="h-9 w-9 p-0 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
          >
            {theme === 'light' ? (
              <Moon className="h-[18px] w-[18px] text-gray-700 dark:text-gray-400" />
            ) : (
              <Sun className="h-[18px] w-[18px] text-gray-400" />
            )}
          </Button>

          {/* Notifications */}
          <NotificationDropdown
            unreadCount={unreadCount}
            onUnreadCountChange={setUnreadCount}
          />

          {/* Divider */}
          <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 hover:scale-105 active:scale-95">
                <Avatar className="h-9 w-9 ring-2 ring-gray-200 dark:ring-gray-700 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 transition-all duration-200">
                  <AvatarImage src="" alt={user?.username || 'User'} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-white text-sm font-semibold">
                    {(user?.username || 'U').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 p-2" align="end" forceMount>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <Avatar className="h-10 w-10 ring-2 ring-blue-500/20">
                  <AvatarImage src="" alt={user?.username || 'User'} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-white text-sm font-semibold">
                    {(user?.username || 'U').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-0.5 leading-none min-w-0 flex-1">
                  <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{user?.full_name || user?.username}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {user?.email}
                  </p>
                </div>
              </div>
              <DropdownMenuSeparator className="my-2" />
              <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer rounded-md py-2.5 px-3 transition-colors">
                <User className="mr-3 h-[18px] w-[18px]" />
                <span className="text-sm font-medium">{t('profile')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer rounded-md py-2.5 px-3 transition-colors">
                <Settings className="mr-3 h-[18px] w-[18px]" />
                <span className="text-sm font-medium">{t('settings')}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-2" />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400 cursor-pointer rounded-md py-2.5 px-3 transition-colors focus:bg-red-50 dark:focus:bg-red-950/30">
                <LogOut className="mr-3 h-[18px] w-[18px]" />
                <span className="text-sm font-medium">{t('logout')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}