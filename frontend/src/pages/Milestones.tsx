import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Flag, Search, ChevronLeft, ChevronRight, Edit, Trash2, Calendar, TrendingUp, AlertCircle, Filter, LayoutGrid, List, Target, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { milestonesAPI } from '@/lib/api';
import { Milestone, MilestoneStats } from '@/types';

export function Milestones() {
  const { projectId } = useParams<{ projectId: string }>();
  const { t, isRTL } = useTranslation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const milestoneTitleInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDescription, setMilestoneDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [milestoneStatus, setMilestoneStatus] = useState<'planned' | 'in_progress' | 'completed' | 'cancelled'>('planned');
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'progress' | 'status'>('date');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const itemsPerPage = 10;

  // API state
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<MilestoneStats>({
    total: 0,
    planned: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    overdue: 0
  });

  // Load milestones from API
  const loadMilestones = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await milestonesAPI.getAll(projectId ? parseInt(projectId) : undefined);
      setMilestones(data);

      // Handle empty arrays gracefully
      if (data && data.length > 0) {
        // Calculate stats from the data
        const calculatedStats = {
          total: data.length,
          planned: data.filter((m: any) => m.status === 'planned').length,
          inProgress: data.filter((m: any) => m.status === 'in_progress').length,
          completed: data.filter((m: any) => m.status === 'completed').length,
          cancelled: data.filter((m: any) => m.status === 'cancelled').length,
          overdue: data.filter((m: any) => {
            if (!m.due_date || m.status === 'completed' || m.status === 'cancelled') return false;
            return new Date(m.due_date) < new Date();
          }).length
        };
        setStats(calculatedStats);
      } else {
        // Set empty stats if no data
        setStats({
          total: 0,
          planned: 0,
          inProgress: 0,
          completed: 0,
          cancelled: 0,
          overdue: 0
        });
      }
    } catch (error: any) {
      console.error('Failed to load milestones:', error);
      if (error.response?.status === 403) {
        setError('You do not have permission to view milestones.');
      } else if (error.response?.status === 429) {
        setError('Too many requests. Please wait a moment and try again.');
      } else {
        setError('Failed to load milestones. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMilestones();
  }, [projectId]);

  // Auto-focus on title input when dialog opens
  useEffect(() => {
    if (isCreateDialogOpen && milestoneTitleInputRef.current) {
      setTimeout(() => milestoneTitleInputRef.current?.focus(), 100);
    }
  }, [isCreateDialogOpen]);

  // Track unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(
      milestoneTitle.trim() !== '' || 
      milestoneDescription.trim() !== '' ||
      targetDate.trim() !== ''
    );
  }, [milestoneTitle, milestoneDescription, targetDate]);

  // Filter and sort milestones
  const filteredMilestones = milestones
    .filter(milestone => {
      const matchesSearch = milestone.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (milestone.description && milestone.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || milestone.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'date') {
        const dateA = a.target_date ? new Date(a.target_date).getTime() : 0;
        const dateB = b.target_date ? new Date(b.target_date).getTime() : 0;
        return dateA - dateB;
      } else if (sortBy === 'progress') {
        return b.progress_percentage - a.progress_percentage;
      } else {
        return a.status.localeCompare(b.status);
      }
    });

  const totalPages = Math.ceil(filteredMilestones.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMilestones = filteredMilestones.slice(startIndex, startIndex + itemsPerPage);

  const handleCreateMilestone = async () => {
    try {
      setIsCreating(true);
      if (!projectId) {
        throw new Error('Project ID is required');
      }

      // Validate title length
      if (milestoneTitle.trim().length > 255) {
        setError('Title cannot exceed 255 characters');
        return;
      }

      // Validate description length
      if (milestoneDescription && milestoneDescription.length > 5000) {
        setError('Description cannot exceed 5000 characters');
        return;
      }

      // Warn about past dates
      if (targetDate) {
        const selectedDate = new Date(targetDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate < today) {
          if (!confirm('Warning: You are creating a milestone with a past date. Continue?')) {
            return;
          }
        }
      }

      await milestonesAPI.create({
        title: milestoneTitle,
        description: milestoneDescription,
        target_date: targetDate ? new Date(targetDate).toISOString() : undefined,
        project_id: parseInt(projectId),
        created_by: 1
      });

      setMilestoneTitle('');
      setMilestoneDescription('');
      setTargetDate('');
      setHasUnsavedChanges(false);
      setIsCreateDialogOpen(false);
      await loadMilestones();
    } catch (error: any) {
      console.error('Failed to create milestone:', error);
      if (error.response?.status === 403) {
        setError('You do not have permission to create milestones.');
      } else if (error.response?.status === 429) {
        setError('Too many requests. Please wait a moment and try again.');
      } else if (error.response?.data?.detail) {
        setError(error.response.data.detail);
      } else {
        setError('Failed to create milestone. Please try again.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open && hasUnsavedChanges) {
      setShowUnsavedDialog(true);
    } else {
      setIsCreateDialogOpen(open);
      if (!open) {
        setMilestoneTitle('');
        setMilestoneDescription('');
        setTargetDate('');
        setHasUnsavedChanges(false);
        setTouchedFields({});
      }
    }
  };

  const handleUnsavedConfirm = (discard: boolean) => {
    setShowUnsavedDialog(false);
    if (discard) {
      setMilestoneTitle('');
      setMilestoneDescription('');
      setTargetDate('');
      setHasUnsavedChanges(false);
      setTouchedFields({});
      setIsCreateDialogOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleCreateMilestone();
    }
  };

  const handleEditMilestone = async () => {
    if (!editingMilestone) return;

    try {
      // Validate title length
      if (milestoneTitle.trim().length > 255) {
        setError('Title cannot exceed 255 characters');
        return;
      }

      // Validate description length
      if (milestoneDescription && milestoneDescription.length > 5000) {
        setError('Description cannot exceed 5000 characters');
        return;
      }

      // Warn about past dates
      if (targetDate) {
        const selectedDate = new Date(targetDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate < today) {
          if (!confirm('Warning: You are setting a past date for this milestone. Continue?')) {
            return;
          }
        }
      }

      await milestonesAPI.update(editingMilestone.id, {
        title: milestoneTitle,
        description: milestoneDescription,
        target_date: targetDate ? new Date(targetDate).toISOString() : undefined,
        status: milestoneStatus,
        progress_percentage: progressPercentage
      });

      setMilestoneTitle('');
      setMilestoneDescription('');
      setTargetDate('');
      setMilestoneStatus('planned');
      setProgressPercentage(0);
      setEditingMilestone(null);
      setIsEditDialogOpen(false);
      await loadMilestones();
    } catch (error: any) {
      console.error('Failed to update milestone:', error);
      if (error.response?.status === 403) {
        setError('You do not have permission to update milestones.');
      } else if (error.response?.status === 429) {
        setError('Too many requests. Please wait a moment and try again.');
      } else if (error.response?.data?.detail) {
        setError(error.response.data.detail);
      } else {
        setError('Failed to update milestone. Please try again.');
      }
    }
  };

  const openEditDialog = (milestone: Milestone) => {
    setEditingMilestone(milestone);
    setMilestoneTitle(milestone.title);
    setMilestoneDescription(milestone.description || '');
    setTargetDate(milestone.target_date ? milestone.target_date.split('T')[0] : '');
    setMilestoneStatus(milestone.status);
    setProgressPercentage(milestone.progress_percentage);
    setIsEditDialogOpen(true);
  };

  const handleDeleteMilestone = async (id: number) => {
    if (!confirm('Are you sure you want to delete this milestone?')) return;

    try {
      await milestonesAPI.delete(id);
      await loadMilestones();
    } catch (error: any) {
      console.error('Failed to delete milestone:', error);
      if (error.response?.status === 403) {
        setError('You do not have permission to delete milestones.');
      } else if (error.response?.status === 429) {
        setError('Too many requests. Please wait a moment and try again.');
      } else {
        setError('Failed to delete milestone. Please try again.');
      }
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      planned: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    };
    return variants[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 60) return 'bg-blue-500';
    if (percentage >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getDaysRemaining = (targetDate: string) => {
    if (!targetDate) return 0;
    const now = new Date();
    const target = new Date(targetDate);
    const diffTime = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const isOverdue = (milestone: Milestone) => {
    if (!milestone.target_date) return false;
    return milestone.status !== 'completed' && 
           milestone.status !== 'cancelled' && 
           getDaysRemaining(milestone.target_date) < 0;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Milestones</h1>
          <p className="text-gray-600">Track project milestones and progress</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button disabled={!projectId}>
              <Plus className="h-4 w-4 mr-2" />
              Add Milestone
            </Button>
          </DialogTrigger>
          <DialogContent isRTL={isRTL} className="sm:max-w-[500px]" onKeyDown={handleKeyDown}>
            <DialogHeader>
              <DialogTitle>Create New Milestone</DialogTitle>
              <DialogDescription>
                Define a project milestone with target completion date.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="milestoneTitle" className="text-right">Title</Label>
                <div className="col-span-3 space-y-1">
                  <Input
                    ref={milestoneTitleInputRef}
                    id="milestoneTitle"
                    value={milestoneTitle}
                    onChange={(e) => setMilestoneTitle(e.target.value)}
                    onBlur={() => setTouchedFields({...touchedFields, milestoneTitle: true})}
                    className={touchedFields.milestoneTitle && milestoneTitle.trim() === '' ? 'border-red-300 focus:border-red-500' : ''}
                    placeholder="Enter milestone title"
                    maxLength={255}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Enter milestone title</span>
                    <span>{milestoneTitle.length}/255</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="milestoneDescription" className="text-right pt-2">Description</Label>
                <div className="col-span-3 space-y-1">
                  <Textarea
                    id="milestoneDescription"
                    value={milestoneDescription}
                    onChange={(e) => setMilestoneDescription(e.target.value)}
                    placeholder="Describe the milestone (optional)"
                    rows={3}
                    maxLength={5000}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Describe the milestone (optional)</span>
                    <span>{milestoneDescription.length}/5000</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="targetDate" className="text-right">Target Date</Label>
                <Input
                  id="targetDate"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <div className="text-xs text-gray-500 mb-2 sm:mb-0 sm:mr-auto">
                Ctrl+Enter to submit
              </div>
              <Button variant="outline" onClick={() => handleDialogClose(false)}>Cancel</Button>
              <Button onClick={handleCreateMilestone} disabled={!milestoneTitle.trim() || !targetDate || isCreating} className="transition-all duration-200">
                {isCreating ? 'Creating...' : 'Create Milestone'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Unsaved Changes Confirmation Dialog */}
        <Dialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
          <DialogContent isRTL={isRTL} className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Unsaved Changes</DialogTitle>
              <DialogDescription>
                You have unsaved changes. Are you sure you want to close without saving?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleUnsavedConfirm(false)}>
                Keep Editing
              </Button>
              <Button onClick={() => handleUnsavedConfirm(true)}>
                Discard Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Target className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Planned</p>
                <p className="text-2xl font-bold">{stats.planned}</p>
              </div>
              <Clock className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Progress</p>
                <p className="text-2xl font-bold">{stats.inProgress}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold">{stats.completed}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Cancelled</p>
                <p className="text-2xl font-bold">{stats.cancelled}</p>
              </div>
              <XCircle className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Overdue</p>
                <p className="text-2xl font-bold">{stats.overdue}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-red-700">{error}</p>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">×</Button>
        </div>
      )}

      {/* Filters and Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={t('searchMilestones')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="planned">Planned</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'date' | 'progress' | 'status')}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Target Date</SelectItem>
              <SelectItem value="progress">Progress</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'card' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('card')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading milestones...</span>
        </div>
      )}

      {!loading && viewMode === 'card' && (
        <div className="grid gap-4">
          {paginatedMilestones.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Flag className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {searchQuery || statusFilter !== 'all' ? 'No milestones found' : 'No milestones yet'}
                </h3>
                <p className="text-gray-600 text-center mb-4">
                  {searchQuery || statusFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : projectId 
                      ? 'Create your first milestone to track project progress'
                      : 'Select a project to view its milestones'
                  }
                </p>
                {!searchQuery && statusFilter === 'all' && projectId && (
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Milestone
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            paginatedMilestones.map((milestone) => (
              <Card key={milestone.id} className={isOverdue(milestone) ? 'border-red-300' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <Flag className="h-5 w-5" />
                        {milestone.title}
                        {isOverdue(milestone) && (
                          <Badge className="bg-red-100 text-red-800">Overdue</Badge>
                        )}
                      </CardTitle>
                      {milestone.description && (
                        <p className="text-gray-600 mt-1">{milestone.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusBadge(milestone.status)}>
                        {milestone.status.replace('_', ' ')}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(milestone)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteMilestone(milestone.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Progress</span>
                        <span className="text-sm text-gray-600">{milestone.progress_percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${getProgressColor(milestone.progress_percentage)}`}
                          style={{ width: `${milestone.progress_percentage}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>Target: {milestone.target_date ? formatDate(milestone.target_date) : 'Not set'}</span>
                      </div>
                      {milestone.target_date && getDaysRemaining(milestone.target_date) >= 0 && milestone.status !== 'completed' && (
                        <span className="text-blue-600">
                          {getDaysRemaining(milestone.target_date)} days remaining
                        </span>
                      )}
                      {milestone.actual_date && (
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-4 w-4" />
                          <span>Completed: {formatDate(milestone.actual_date)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {!loading && viewMode === 'table' && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Left</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedMilestones.map((milestone) => (
                    <tr key={milestone.id} className={isOverdue(milestone) ? 'bg-red-50' : ''}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Flag className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium">{milestone.title}</div>
                            {milestone.description && (
                              <div className="text-sm text-gray-500 truncate max-w-xs">{milestone.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={getStatusBadge(milestone.status)}>
                          {milestone.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${getProgressColor(milestone.progress_percentage)}`}
                              style={{ width: `${milestone.progress_percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-600">{milestone.progress_percentage}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">{milestone.target_date ? formatDate(milestone.target_date) : 'Not set'}</td>
                      <td className="px-6 py-4 text-sm">
                        {milestone.status === 'completed' ? (
                          <span className="text-green-600">Completed</span>
                        ) : !milestone.target_date ? (
                          <span className="text-gray-500">No date</span>
                        ) : getDaysRemaining(milestone.target_date) < 0 ? (
                          <span className="text-red-600 font-medium">Overdue</span>
                        ) : (
                          <span className="text-blue-600">{getDaysRemaining(milestone.target_date)} days</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(milestone)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteMilestone(milestone.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredMilestones.length)} of {filteredMilestones.length} milestones
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Milestone</DialogTitle>
            <DialogDescription>
              Update milestone details, status, and progress.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editMilestoneTitle" className="text-right">Title</Label>
              <Input
                id="editMilestoneTitle"
                value={milestoneTitle}
                onChange={(e) => setMilestoneTitle(e.target.value)}
                className="col-span-3"
                maxLength={255}
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="editMilestoneDescription" className="text-right pt-2">Description</Label>
              <Textarea
                id="editMilestoneDescription"
                value={milestoneDescription}
                onChange={(e) => setMilestoneDescription(e.target.value)}
                className="col-span-3"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editTargetDate" className="text-right">Target Date</Label>
              <Input
                id="editTargetDate"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editStatus" className="text-right">Status</Label>
              <Select value={milestoneStatus} onValueChange={(v) => setMilestoneStatus(v as any)}>
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editProgress" className="text-right">Progress %</Label>
              <div className="col-span-3 flex items-center gap-2">
                <Input
                  id="editProgress"
                  type="number"
                  min="0"
                  max="100"
                  value={progressPercentage}
                  onChange={(e) => setProgressPercentage(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="flex-1"
                />
                <span className="text-sm text-gray-600">{progressPercentage}%</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditMilestone} disabled={!milestoneTitle.trim() || !targetDate}>
              Update Milestone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
