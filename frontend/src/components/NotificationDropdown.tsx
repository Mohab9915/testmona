import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, Trash2, Settings, Search, X, RefreshCw, Volume2, VolumeX, Moon, Sun, AlertTriangle, Filter, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { Notification } from '@/types';

interface NotificationDropdownProps {
  unreadCount: number;
  onUnreadCountChange: (count: number) => void;
}

export function NotificationDropdown({ unreadCount, onUnreadCountChange }: NotificationDropdownProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState({
    do_not_disturb: false,
    notification_sound_enabled: true,
    notifications_muted_until: null as string | null
  });
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const fetchNotifications = async (pageNum: number = 0, append: boolean = false) => {
    if (!user) return;

    setLoading(true);
    try {
      const limit = 50;
      const skip = pageNum * limit;
      let url = `/notifications/?skip=${skip}&limit=${limit}`;
      
      if (searchQuery && searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }
      if (filterType) {
        url += `&notification_type=${filterType}`;
      }
      
      const response = await api.get(url);
      
      if (append) {
        setNotifications(prev => [...prev, ...response.data]);
      } else {
        setNotifications(response.data);
      }
      
      // Check if there are more notifications
      setHasMore(response.data.length === limit);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(0);
    
    // Clear existing timer
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    
    // Set new timer for debounced search
    const timer = setTimeout(() => {
      fetchNotifications(0, false);
    }, 300);
    
    setSearchDebounceTimer(timer);
  };

  const markAsRead = async (notificationId: number) => {
    // Validate notification ID
    if (!notificationId || notificationId < 1) {
      console.error('Invalid notification ID:', notificationId);
      return;
    }

    try {
      await api.put(`/notifications/${notificationId}`, { is_read: true });
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        )
      );
      onUnreadCountChange(Math.max(0, unreadCount - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      // Revert optimistic update if needed
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, is_read: true }))
      );
      onUnreadCountChange(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId: number) => {
    // Validate notification ID
    if (!notificationId || notificationId < 1) {
      console.error('Invalid notification ID:', notificationId);
      return;
    }

    try {
      await api.delete(`/notifications/${notificationId}`);
      const wasUnread = notifications.find(n => n.id === notificationId)?.is_read === false;
      setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
      if (wasUnread) {
        onUnreadCountChange(Math.max(0, unreadCount - 1));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const loadMore = () => {
    if (loading || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchNotifications(nextPage, true);
  };

  const markAsUnread = async (notificationId: number) => {
    if (!notificationId || notificationId < 1) {
      console.error('Invalid notification ID:', notificationId);
      return;
    }

    try {
      await api.put(`/notifications/${notificationId}/mark-unread`);
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId ? { ...notif, is_read: false } : notif
        )
      );
      onUnreadCountChange(unreadCount + 1);
    } catch (error) {
      console.error('Failed to mark notification as unread:', error);
    }
  };

  const clearAll = async () => {
    try {
      await api.delete('/notifications/all');
      setNotifications([]);
      onUnreadCountChange(0);
      setShowClearConfirm(false);
    } catch (error) {
      console.error('Failed to clear all notifications:', error);
    }
  };

  const toggleBulkMode = () => {
    setBulkMode(!bulkMode);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    setSelectedIds(new Set(notifications.map(n => n.id)));
  };

  const bulkMarkRead = async () => {
    if (selectedIds.size === 0) return;
    try {
      await api.post('/notifications/bulk-update/', {
        notification_ids: Array.from(selectedIds),
        is_read: true
      });
      setNotifications(prev =>
        prev.map(notif =>
          selectedIds.has(notif.id) ? { ...notif, is_read: true } : notif
        )
      );
      const unreadInSelection = notifications.filter(n => selectedIds.has(n.id) && !n.is_read).length;
      onUnreadCountChange(Math.max(0, unreadCount - unreadInSelection));
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Failed to bulk mark as read:', error);
      alert('Failed to mark notifications as read. Please try again.');
    }
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      await api.delete('/notifications/bulk-delete/', {
        data: { notification_ids: Array.from(selectedIds) }
      });
      const unreadInSelection = notifications.filter(n => selectedIds.has(n.id) && !n.is_read).length;
      setNotifications(prev => prev.filter(notif => !selectedIds.has(notif.id)));
      onUnreadCountChange(Math.max(0, unreadCount - unreadInSelection));
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Failed to bulk delete:', error);
      alert('Failed to delete notifications. Please try again.');
    }
  };

  const loadAll = async () => {
    try {
      const response = await api.get('/notifications/?skip=0&limit=100');
      setNotifications(response.data);
      setHasMore(false);
    } catch (error) {
      console.error('Failed to load all notifications:', error);
    }
  };

  const updateNotificationPrefs = async (prefs: Partial<typeof notificationPrefs> | { mute_duration_hours?: number }) => {
    try {
      const response = await api.put('/users/me/notification-preferences', prefs);
      setNotificationPrefs(response.data);
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
      alert('Failed to update notification preferences. Please try again.');
    }
  };

  const fetchNotificationPrefs = async () => {
    try {
      const response = await api.get('/users/me/notification-preferences');
      setNotificationPrefs(response.data);
    } catch (error) {
      console.error('Failed to fetch notification preferences:', error);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh && isOpen) {
      interval = setInterval(() => {
        fetchNotifications(0, false);
      }, 30000); // Refresh every 30 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, isOpen]);

  // Fetch notifications when filterType or page changes
  useEffect(() => {
    if (isOpen) {
      setNotifications([]);
      fetchNotifications(page, false);
    }
  }, [filterType, page, isOpen]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }
    };
  }, [searchDebounceTimer]);

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'error': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  const getDateGroup = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);

    if (date >= today) return 'Today';
    if (date >= yesterday) return 'Yesterday';
    if (date >= thisWeek) return 'This Week';
    return 'Older';
  };

  const groupNotificationsByDate = (notifs: Notification[]) => {
    const groups: Record<string, Notification[]> = {};
    notifs.forEach(notif => {
      const group = getDateGroup(notif.created_at);
      if (!groups[group]) groups[group] = [];
      groups[group].push(notif);
    });
    return groups;
  };

  useEffect(() => {
    if (isOpen) {
      setPage(0);
      setHasMore(true);
      setSearchQuery('');
      setFilterType(null);
      setSelectedIds(new Set());
      fetchNotifications(0, false);
      fetchNotificationPrefs();
    }
  }, [isOpen, user]);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-9 w-9 p-0 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95">
          <Bell className="h-[18px] w-[18px] text-gray-700 dark:text-gray-300" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-[18px] min-w-[18px] px-1 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-white font-semibold shadow-sm ring-2 ring-white dark:ring-gray-900">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[420px] p-0" align="end" forceMount>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-base text-gray-900 dark:text-white">Notifications</h3>
            {unreadCount > 0 && (
              <div className="flex items-center gap-1 text-xs">
                <span className="text-red-500 font-medium">{notifications.filter(n => !n.is_read && n.type === 'error').length} errors</span>
                <span className="text-yellow-500 font-medium">{notifications.filter(n => !n.is_read && n.type === 'warning').length} warnings</span>
                <span className="text-blue-500 font-medium">{notifications.filter(n => !n.is_read && n.type === 'info').length} info</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-md transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Mark all read
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowClearConfirm(true)}
              className="h-7 px-2 text-xs text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors"
              title="Clear all notifications"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleBulkMode}
              className={`h-7 px-2 text-xs rounded-md transition-colors ${bulkMode ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'text-gray-600 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
              title="Bulk select mode"
            >
              <Filter className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        
        {/* Search and Filter Bar */}
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-2 mb-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    if (searchDebounceTimer) {
                      clearTimeout(searchDebounceTimer);
                    }
                    setSearchQuery('');
                    setPage(0);
                    fetchNotifications(0, false);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <Button
              variant={filterType === null ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                setFilterType(null);
                setPage(0);
              }}
              className="h-6 px-2 text-xs"
            >
              All
            </Button>
            <Button
              variant={filterType === 'info' ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                setFilterType('info');
                setPage(0);
              }}
              className="h-6 px-2 text-xs"
            >
              Info
            </Button>
            <Button
              variant={filterType === 'success' ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                setFilterType('success');
                setPage(0);
              }}
              className="h-6 px-2 text-xs"
            >
              Success
            </Button>
            <Button
              variant={filterType === 'warning' ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                setFilterType('warning');
                setPage(0);
              }}
              className="h-6 px-2 text-xs"
            >
              Warning
            </Button>
            <Button
              variant={filterType === 'error' ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                setFilterType('error');
                setPage(0);
              }}
              className="h-6 px-2 text-xs"
            >
              Error
            </Button>
          </div>
        </div>
        <div className="max-h-[480px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                <Bell className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">No notifications yet</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                You'll see updates here when something happens
              </p>
            </div>
          ) : (
            <>
              {bulkMode && selectedIds.size > 0 && (
                <div className="px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800 flex items-center justify-between">
                  <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                    {selectedIds.size} selected
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={selectAll}
                      className="h-6 px-2 text-xs"
                    >
                      Select All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={bulkMarkRead}
                      className="h-6 px-2 text-xs text-blue-600 dark:text-blue-400"
                    >
                      Mark Read
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={bulkDelete}
                      className="h-6 px-2 text-xs text-red-600 dark:text-red-400"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )}
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {Object.entries(groupNotificationsByDate(notifications)).map(([groupName, groupNotifs]) => (
                  <div key={groupName}>
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 text-xs font-semibold text-gray-600 dark:text-gray-400 sticky top-0">
                      {groupName}
                    </div>
                    {groupNotifs.map((notification) => (
                      <div
                        key={notification.id}
                        onClick={() => bulkMode && toggleSelect(notification.id)}
                        className={`px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer ${
                          !notification.is_read ? 'bg-blue-50/50 dark:bg-blue-950/20 border-l-2 border-blue-500' : ''
                        } ${bulkMode && selectedIds.has(notification.id) ? 'bg-blue-100 dark:bg-blue-900/30' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          {bulkMode && (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(notification.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleSelect(notification.id);
                              }}
                              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <Badge
                                className={`text-[10px] font-semibold px-2 py-0.5 ${getNotificationColor(notification.type)}`}
                                variant="secondary"
                              >
                                {notification.type}
                              </Badge>
                              <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                                {formatDate(notification.created_at)}
                              </span>
                              {notification.type === 'error' && (
                                <AlertTriangle className="h-3 w-3 text-red-500" />
                              )}
                            </div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 leading-snug">
                              {notification.title}
                            </h4>
                            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-2">
                              {notification.message}
                            </p>
                            {notification.related_entity_type && (
                              <div className="flex items-center gap-2 mt-1.5">
                                <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                                  Related: {notification.related_entity_type} #{notification.related_entity_id}
                                </p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    // Navigate to related entity
                                    if (notification.related_entity_type === 'defect') {
                                      navigate(`/defects/${notification.related_entity_id}`);
                                    } else if (notification.related_entity_type === 'test_case') {
                                      navigate(`/test-cases/${notification.related_entity_id}`);
                                    }
                                    setIsOpen(false);
                                  }}
                                  className="h-5 px-1.5 text-[10px] text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded"
                                >
                                  View
                                </Button>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {notification.is_read ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsUnread(notification.id);
                                }}
                                className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-md transition-all"
                                title="Mark as unread"
                              >
                                <EyeOff className="h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(notification.id);
                                }}
                                className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-md transition-all"
                                title="Mark as read"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(notification.id);
                              }}
                              className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-all"
                              title="Delete notification"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        {notifications.length > 0 && (
          <>
            <div className="border-t border-gray-200 dark:border-gray-700" />
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loading}
                className="w-full py-3 text-sm text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            )}
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`h-7 px-2 text-xs rounded ${autoRefresh ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' : 'text-gray-600 dark:text-gray-400'}`}
                  title="Auto-refresh every 30s"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${autoRefresh ? 'animate-spin' : ''}`} />
                  Auto-refresh
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateNotificationPrefs({ do_not_disturb: !notificationPrefs.do_not_disturb })}
                  className={`h-7 px-2 text-xs rounded ${notificationPrefs.do_not_disturb ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200' : 'text-gray-600 dark:text-gray-400'}`}
                  title="Do not disturb"
                >
                  <Moon className="h-3.5 w-3.5 mr-1" />
                  DND
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateNotificationPrefs({ notification_sound_enabled: !notificationPrefs.notification_sound_enabled })}
                  className={`h-7 px-2 text-xs rounded ${notificationPrefs.notification_sound_enabled ? 'text-gray-600 dark:text-gray-400' : 'text-gray-400 dark:text-gray-500'}`}
                  title="Toggle sound"
                >
                  {notificationPrefs.notification_sound_enabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateNotificationPrefs({ mute_duration_hours: 1 })}
                className="h-7 px-2 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                title="Mute for 1 hour"
              >
                Mute 1h
              </Button>
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate('/settings');
                setIsOpen(false);
              }}
              className="w-full justify-center text-blue-600 dark:text-blue-400 cursor-pointer py-3 font-medium hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors flex items-center border-t border-gray-200 dark:border-gray-700"
            >
              <Settings className="h-4 w-4 mr-2" />
              Notification Settings
            </button>
          </>
        )}
        
        {/* Clear All Confirmation Dialog */}
        {showClearConfirm && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 max-w-sm mx-4 shadow-lg">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Clear All Notifications?</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                This will delete all your notifications. This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowClearConfirm(false)}
                  className="h-8 px-3"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={clearAll}
                  className="h-8 px-3"
                >
                  Clear All
                </Button>
              </div>
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}