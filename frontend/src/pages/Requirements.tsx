import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, FileText, Search, ChevronLeft, ChevronRight, Edit, Trash2, Link, Filter, Download, Eye, Users, Clock, CheckCircle, AlertCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { requirementsAPI } from '@/lib/api';
import { Requirement, RequirementCreate, RequirementUpdate } from '@/types';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { diffWords } from 'diff';


export function Requirements() {
  const { projectId } = useParams<{ projectId: string }>();
  const { selectedProject } = useProjectStore();
  const { toast } = useToast();
  const { t, isRTL } = useTranslation();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);
  const [requirementToDelete, setRequirementToDelete] = useState<Requirement | null>(null);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState('');
  const itemsPerPage = 10;

  // Form states
  const [reqTitle, setReqTitle] = useState('');
  const [reqDescription, setReqDescription] = useState('');
  const [reqId, setReqId] = useState('');
  const [reqPriority, setReqPriority] = useState('medium');
  const [reqStatus, setReqStatus] = useState('draft');
  const [reqAcceptanceCriteria, setReqAcceptanceCriteria] = useState('');
  const [reqTags, setReqTags] = useState('');
  const [reqEstimatedEffort, setReqEstimatedEffort] = useState('');
  const [initialFormState, setInitialFormState] = useState<any>(null);
  const draftSaveTimeoutRef = useRef<number | null>(null);
  const [contentVersions, setContentVersions] = useState<Array<{ id: string; createdAt: string; description: string; acceptance: string }>>([]);
  const [compareFromId, setCompareFromId] = useState<string>('');
  const [compareToId, setCompareToId] = useState<string>('');

  const getPlainTextLength = (html: string): number =>
    html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim().length;
  
  const toPlain = (html: string): string =>
    html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const buildDiffHtml = (from: string, to: string): string => {
    const parts = diffWords(toPlain(from), toPlain(to));
    return parts
      .map((part) => {
        const escaped = part.value
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        if (part.added) return `<span style="background:#dcfce7;color:#166534;">${escaped}</span>`;
        if (part.removed) return `<span style="background:#fee2e2;color:#991b1b;text-decoration:line-through;">${escaped}</span>`;
        return `<span>${escaped}</span>`;
      })
      .join('');
  };

  const saveVersionSnapshot = () => {
    const snapshot = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      description: reqDescription,
      acceptance: reqAcceptanceCriteria,
    };
    setContentVersions((previous) => [snapshot, ...previous].slice(0, 30));
    setCompareFromId(snapshot.id);
  };

  // Load requirements
  useEffect(() => {
    loadRequirements();
  }, [projectId]);

  const loadRequirements = async () => {
    if (!projectId) return;
    
    try {
      setLoading(true);
      const data = await requirementsAPI.getAll(parseInt(projectId));
      setRequirements(data);
    } catch (error) {
      console.error('Error loading requirements:', error);
      toast({
        title: t('error'),
        description: t('failedToLoadRequirements'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Filtering logic
  const filteredRequirements = requirements.filter(req => {
    const matchesSearch = searchQuery === '' || 
      req.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.requirement_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.tags?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || req.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const totalPages = Math.ceil(filteredRequirements.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRequirements = filteredRequirements.slice(startIndex, startIndex + itemsPerPage);

  // API functions
  const handleCreateRequirement = async () => {
    if (!projectId) return;
    
    if (!reqId.trim() || !reqTitle.trim()) {
      toast({
        title: t('error'),
        description: t('fieldRequired', {field: 'All required fields'}),
        variant: 'destructive',
      });
      return;
    }
    
    if (!/^REQ-\d{3,}$/.test(reqId.trim())) {
      toast({
        title: t('error'),
        description: t('requirementIdInvalid'),
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      let currentUser;
      try {
        currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      } catch {
        currentUser = { id: 1 };
      }
      
      const estimatedEffort = reqEstimatedEffort ? parseFloat(reqEstimatedEffort) : undefined;
      if (estimatedEffort !== undefined && (isNaN(estimatedEffort) || estimatedEffort < 0)) {
        toast({
          title: t('error'),
          description: t('estimatedEffortInvalid'),
          variant: 'destructive',
        });
        return;
      }
      
      const newRequirement: RequirementCreate = {
        title: reqTitle,
        description: reqDescription,
        requirement_id: reqId,
        priority: reqPriority as any,
        status: reqStatus as any,
        acceptance_criteria: reqAcceptanceCriteria,
        tags: reqTags,
        estimated_effort: estimatedEffort,
        project_id: parseInt(projectId),
        created_by: currentUser.id || 1,
      };

      await requirementsAPI.create(newRequirement);
      
      toast({
        title: t('success'),
        description: t('requirementCreated', {name: reqTitle}),
      });
      
      setIsCreateDialogOpen(false);
      resetForm();
      loadRequirements();
    } catch (error: any) {
      console.error('Error creating requirement:', error);
      toast({
        title: t('error'),
        description: error.response?.data?.detail || t('failedToCreateRequirement'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditRequirement = (requirement: Requirement) => {
    setSelectedRequirement(requirement);
    setReqTitle(requirement.title);
    setReqDescription(requirement.description || '');
    setReqId(requirement.requirement_id);
    setReqPriority(requirement.priority);
    setReqStatus(requirement.status);
    setReqAcceptanceCriteria(requirement.acceptance_criteria || '');
    setReqTags(requirement.tags || '');
    setReqEstimatedEffort(requirement.estimated_effort?.toString() || '');
    setInitialFormState({
      title: requirement.title,
      description: requirement.description || '',
      priority: requirement.priority,
      status: requirement.status,
      acceptanceCriteria: requirement.acceptance_criteria || '',
      tags: requirement.tags || '',
      estimatedEffort: requirement.estimated_effort?.toString() || '',
    });
    setContentVersions([]);
    setCompareFromId('');
    setCompareToId('');
    setIsEditDialogOpen(true);
    setTimeout(() => titleInputRef.current?.focus(), 100);
  };

  const handleUpdateRequirement = async () => {
    if (!selectedRequirement) return;
    
    if (!reqTitle.trim()) {
      toast({
        title: t('error'),
        description: t('fieldRequired', {field: 'Title'}),
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      const estimatedEffort = reqEstimatedEffort ? parseFloat(reqEstimatedEffort) : undefined;
      if (estimatedEffort !== undefined && (isNaN(estimatedEffort) || estimatedEffort < 0)) {
        toast({
          title: t('error'),
          description: t('estimatedEffortInvalid'),
          variant: 'destructive',
        });
        return;
      }
      
      const updateData: RequirementUpdate = {
        title: reqTitle,
        description: reqDescription,
        priority: reqPriority as any,
        status: reqStatus as any,
        acceptance_criteria: reqAcceptanceCriteria,
        tags: reqTags,
        estimated_effort: estimatedEffort,
      };

      await requirementsAPI.update(selectedRequirement.id, updateData);
      
      toast({
        title: t('success'),
        description: t('requirementUpdated'),
      });
      
      setIsEditDialogOpen(false);
      setSelectedRequirement(null);
      resetForm();
      loadRequirements();
    } catch (error: any) {
      console.error('Error updating requirement:', error);
      toast({
        title: t('error'),
        description: error.response?.data?.detail || t('failedToUpdateRequirement'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRequirement = async () => {
    if (!requirementToDelete) return;
    
    if (deleteConfirmationName.toLowerCase() !== requirementToDelete.title.toLowerCase()) {
      toast({
        title: t('error'),
        description: t('titleDoesntMatch'),
        variant: 'destructive',
      });
      return;
    }

    try {
      await requirementsAPI.delete(requirementToDelete.id);
      
      toast({
        title: t('success'),
        description: t('requirementDeleted', {name: requirementToDelete.title}),
      });
      
      setIsDeleteDialogOpen(false);
      setRequirementToDelete(null);
      setDeleteConfirmationName('');
      
      // Reload requirements
      loadRequirements();
    } catch (error) {
      console.error('Error deleting requirement:', error);
      toast({
        title: t('error'),
        description: t('failedToDeleteRequirement'),
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setReqTitle('');
    setReqDescription('');
    setReqId('');
    setReqPriority('medium');
    setReqStatus('draft');
    setReqAcceptanceCriteria('');
    setReqTags('');
    setReqEstimatedEffort('');
    setHasUnsavedChanges(false);
    setInitialFormState(null);
    if (projectId) {
      localStorage.removeItem(`requirement-draft-${projectId}`);
    }
  };
  
  const checkUnsavedChanges = () => {
    const currentState = {
      title: reqTitle,
      description: reqDescription,
      priority: reqPriority,
      status: reqStatus,
      acceptanceCriteria: reqAcceptanceCriteria,
      tags: reqTags,
      estimatedEffort: reqEstimatedEffort,
    };
    return JSON.stringify(currentState) !== JSON.stringify(initialFormState);
  };
  
  const handleDialogClose = (dialogType: 'create' | 'edit') => {
    if (hasUnsavedChanges && checkUnsavedChanges()) {
      setShowUnsavedDialog(true);
      return;
    }
    if (dialogType === 'create') {
      setIsCreateDialogOpen(false);
    } else {
      setIsEditDialogOpen(false);
      setSelectedRequirement(null);
    }
    resetForm();
  };
  
  const handleUnsavedConfirm = (dialogType: 'create' | 'edit') => {
    setShowUnsavedDialog(false);
    if (dialogType === 'create') {
      setIsCreateDialogOpen(false);
    } else {
      setIsEditDialogOpen(false);
      setSelectedRequirement(null);
    }
    resetForm();
  };
  
  const handleUnsavedCancel = () => {
    setShowUnsavedDialog(false);
  };

  const handleViewRequirement = (requirement: Requirement) => {
    setSelectedRequirement(requirement);
    setIsViewDialogOpen(true);
  };

  const openDeleteDialog = (requirement: Requirement) => {
    setRequirementToDelete(requirement);
    setDeleteConfirmationName('');
    setIsDeleteDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      reviewed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      implemented: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      verified: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
      deprecated: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    };
    return variants[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, string> = {
      low: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    };
    return variants[priority] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <FileText className="h-4 w-4" />;
      case 'reviewed':
        return <Eye className="h-4 w-4" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'implemented':
        return <Users className="h-4 w-4" />;
      case 'verified':
        return <CheckCircle className="h-4 w-4" />;
      case 'deprecated':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  // Generate next requirement ID
  const generateRequirementId = () => {
    if (requirements.length === 0) {
      return 'REQ-001';
    }
    
    const maxId = requirements.reduce((max, req) => {
      if (!req.requirement_id) return max;
      const num = parseInt(req.requirement_id.replace(/\D/g, ''));
      return !isNaN(num) && num > max ? num : max;
    }, 0);
    return `REQ-${String(maxId + 1).padStart(3, '0')}`;
  };

  // Initialize requirement ID when opening create dialog
  const handleOpenCreateDialog = () => {
    if (projectId) {
      const rawDraft = localStorage.getItem(`requirement-draft-${projectId}`);
      if (rawDraft) {
        try {
          const draft = JSON.parse(rawDraft);
          setReqTitle(draft.reqTitle || '');
          setReqDescription(draft.reqDescription || '');
          setReqId(draft.reqId || generateRequirementId());
          setReqPriority(draft.reqPriority || 'medium');
          setReqStatus(draft.reqStatus || 'draft');
          setReqAcceptanceCriteria(draft.reqAcceptanceCriteria || '');
          setReqTags(draft.reqTags || '');
          setReqEstimatedEffort(draft.reqEstimatedEffort || '');
          setInitialFormState({
            title: draft.reqTitle || '',
            description: draft.reqDescription || '',
            priority: draft.reqPriority || 'medium',
            status: draft.reqStatus || 'draft',
            acceptanceCriteria: draft.reqAcceptanceCriteria || '',
            tags: draft.reqTags || '',
            estimatedEffort: draft.reqEstimatedEffort || '',
          });
          setContentVersions([]);
          setCompareFromId('');
          setCompareToId('');
          setIsCreateDialogOpen(true);
          setTimeout(() => titleInputRef.current?.focus(), 100);
          return;
        } catch {
          localStorage.removeItem(`requirement-draft-${projectId}`);
        }
      }
    }
    resetForm();
    setReqId(generateRequirementId());
    setInitialFormState({
      title: '',
      description: '',
      priority: 'medium',
      status: 'draft',
      acceptanceCriteria: '',
      tags: '',
      estimatedEffort: '',
    });
    setContentVersions([]);
    setCompareFromId('');
    setCompareToId('');
    setIsCreateDialogOpen(true);
    setTimeout(() => titleInputRef.current?.focus(), 100);
  };

  useEffect(() => {
    if (!isCreateDialogOpen || !projectId) return;
    if (draftSaveTimeoutRef.current) {
      window.clearTimeout(draftSaveTimeoutRef.current);
    }
    draftSaveTimeoutRef.current = window.setTimeout(() => {
      localStorage.setItem(
        `requirement-draft-${projectId}`,
        JSON.stringify({
          reqTitle,
          reqDescription,
          reqId,
          reqPriority,
          reqStatus,
          reqAcceptanceCriteria,
          reqTags,
          reqEstimatedEffort,
        })
      );
    }, 350);
    return () => {
      if (draftSaveTimeoutRef.current) {
        window.clearTimeout(draftSaveTimeoutRef.current);
      }
    };
  }, [isCreateDialogOpen, projectId, reqTitle, reqDescription, reqId, reqPriority, reqStatus, reqAcceptanceCriteria, reqTags, reqEstimatedEffort]);
  
  // Track form changes
  useEffect(() => {
    if (initialFormState) {
      setHasUnsavedChanges(checkUnsavedChanges());
    }
  }, [reqTitle, reqDescription, reqPriority, reqStatus, reqAcceptanceCriteria, reqTags, reqEstimatedEffort]);
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((isCreateDialogOpen || isEditDialogOpen) && !showUnsavedDialog) {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleDialogClose(isCreateDialogOpen ? 'create' : 'edit');
        } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          if (isCreateDialogOpen) {
            handleCreateRequirement();
          } else {
            handleUpdateRequirement();
          }
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreateDialogOpen, isEditDialogOpen, showUnsavedDialog, reqTitle, reqDescription, reqPriority, reqStatus, reqAcceptanceCriteria, reqTags, reqEstimatedEffort, selectedRequirement]);

  const fromSnapshot = contentVersions.find((version) => version.id === compareFromId) || null;
  const toSnapshot = contentVersions.find((version) => version.id === compareToId) || null;

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('requirements')}</h1>
          <p className="text-gray-600 dark:text-gray-400">{t('requirementsDescription')}</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => !open && handleDialogClose('create')}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenCreateDialog}>
              <Plus className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('addRequirement')}
            </Button>
          </DialogTrigger>
          <DialogContent isRTL={isRTL} className="w-[96vw] max-w-[96vw] sm:max-w-[95vw] md:max-w-[900px] lg:max-w-[1000px] max-h-[90vh] overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out">
            <DialogHeader className="space-y-2 pb-4">
              <DialogTitle className="text-2xl font-semibold">{t('createNewRequirement')}</DialogTitle>
              <DialogDescription className="text-sm">
                {t('createRequirementDesc')}
              </DialogDescription>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded border">⌘ + Enter</kbd>
                <span>{t('toSubmit')}</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded border">Esc</kbd>
                <span>{t('toClose')}</span>
              </div>
            </DialogHeader>
            <div className="grid gap-4 py-6 md:grid-cols-[minmax(0,1fr)_minmax(240px,280px)] lg:gap-6">
              {/* Main Content Area - Writing Focused */}
              <div className="min-w-0 space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="reqTitle" className="text-base font-semibold">
                      {t('title')} <span className="text-red-500">*</span>
                    </Label>
                    {reqTitle.length > 0 && (
                      <span className="text-xs text-green-600 font-medium">✓</span>
                    )}
                  </div>
                  <Input
                    id="reqTitle"
                    ref={titleInputRef}
                    value={reqTitle}
                    onChange={(e) => setReqTitle(e.target.value)}
                    className="text-lg font-medium h-12 transition-all focus:ring-2 focus:ring-blue-500"
                    placeholder={t('enterRequirementTitle')}
                  />
                  <p className="text-xs text-gray-500">{t('titleHelper')}</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="reqDescription" className="text-base font-semibold">
                      {t('description')}
                    </Label>
                    <span className="text-xs text-gray-500">{getPlainTextLength(reqDescription)} {t('chars')}</span>
                  </div>
                  <RichTextEditor
                    value={reqDescription}
                    onChange={setReqDescription}
                    placeholder={t('enterRequirementDescription')}
                    mentions={[{ id: 'current-user', label: 'You' }]}
                    dir={isRTL ? 'rtl' : 'ltr'}
                    className="min-h-[220px]"
                  />
                  <p className="text-xs text-gray-500">{t('descriptionHelper')}</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="acceptanceCriteria" className="text-base font-semibold">
                      {t('acceptanceCriteria')}
                    </Label>
                    <span className="text-xs text-gray-500">{getPlainTextLength(reqAcceptanceCriteria)} {t('chars')}</span>
                  </div>
                  <RichTextEditor
                    value={reqAcceptanceCriteria}
                    onChange={setReqAcceptanceCriteria}
                    placeholder={t('enterAcceptanceCriteria')}
                    mentions={[{ id: 'current-user', label: 'You' }]}
                    dir={isRTL ? 'rtl' : 'ltr'}
                    className="min-h-[170px]"
                  />
                  <p className="text-xs text-gray-500">{t('acceptanceCriteriaHelper')}</p>
                </div>

                <div className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">{t('rteVersionHistory')}</Label>
                    <Button type="button" size="sm" variant="outline" onClick={saveVersionSnapshot}>
                      {t('rteSaveSnapshot')}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <select
                      className="h-9 rounded-md border bg-background px-2 text-sm"
                      value={compareFromId}
                      onChange={(e) => setCompareFromId(e.target.value)}
                    >
                      <option value="">{t('rteCompareFrom')}</option>
                      {contentVersions.map((version) => (
                        <option key={version.id} value={version.id}>
                          {new Date(version.createdAt).toLocaleString()}
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-9 rounded-md border bg-background px-2 text-sm"
                      value={compareToId}
                      onChange={(e) => setCompareToId(e.target.value)}
                    >
                      <option value="">{t('rteCompareTo')}</option>
                      {contentVersions.map((version) => (
                        <option key={version.id} value={version.id}>
                          {new Date(version.createdAt).toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </div>
                  {fromSnapshot && toSnapshot && (
                    <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-900/30">
                      <div className="font-medium">{t('rteInlineDiff')}</div>
                      <div
                        className="prose prose-sm max-w-none whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ __html: buildDiffHtml(fromSnapshot.description, toSnapshot.description) }}
                      />
                    </div>
                  )}
                </div>
              </div>
              
              {/* Sidebar - Metadata */}
              <div className="min-w-0 space-y-5 bg-gray-50 dark:bg-gray-800/50 p-4 sm:p-5 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="pb-3 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('metadata')}</h3>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reqId" className="text-sm font-medium">
                    {t('reqId')} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="reqId"
                    value={reqId}
                    onChange={(e) => setReqId(e.target.value)}
                    className="text-sm transition-all focus:ring-2 focus:ring-blue-500"
                    placeholder="REQ-001"
                  />
                  {reqId && !/^REQ-\d{3,}$/.test(reqId) && (
                    <p className="text-xs text-red-500">{t('reqIdFormatHelper')}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="reqStatus" className="text-sm font-medium">
                    {t('status')}
                  </Label>
                  <Select value={reqStatus} onValueChange={setReqStatus}>
                    <SelectTrigger className="text-sm transition-all focus:ring-2 focus:ring-blue-500">
                      <SelectValue placeholder={t('selectStatus')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{t('draft')}</SelectItem>
                      <SelectItem value="reviewed">{t('reviewed')}</SelectItem>
                      <SelectItem value="approved">{t('approved')}</SelectItem>
                      <SelectItem value="implemented">{t('implemented')}</SelectItem>
                      <SelectItem value="verified">{t('verified')}</SelectItem>
                      <SelectItem value="deprecated">{t('deprecated')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="reqPriority" className="text-sm font-medium">
                    {t('priority')}
                  </Label>
                  <Select value={reqPriority} onValueChange={setReqPriority}>
                    <SelectTrigger className="text-sm transition-all focus:ring-2 focus:ring-blue-500">
                      <SelectValue placeholder={t('selectPriority')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{t('low')}</SelectItem>
                      <SelectItem value="medium">{t('medium')}</SelectItem>
                      <SelectItem value="high">{t('high')}</SelectItem>
                      <SelectItem value="critical">{t('critical')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="reqEstimatedEffort" className="text-sm font-medium">
                    {t('estEffort')}
                  </Label>
                  <Input
                    id="reqEstimatedEffort"
                    type="number"
                    step="0.5"
                    value={reqEstimatedEffort}
                    onChange={(e) => setReqEstimatedEffort(e.target.value)}
                    className="text-sm transition-all focus:ring-2 focus:ring-blue-500"
                    placeholder="8.0"
                  />
                  <p className="text-xs text-gray-500">{t('estimatedEffortHelper')}</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="reqTags" className="text-sm font-medium">
                    {t('tags')}
                  </Label>
                  <Input
                    id="reqTags"
                    value={reqTags}
                    onChange={(e) => setReqTags(e.target.value)}
                    className="text-sm transition-all focus:ring-2 focus:ring-blue-500"
                    placeholder="security, authentication"
                  />
                  <p className="text-xs text-gray-500">{t('tagsHelper')}</p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                onClick={handleCreateRequirement}
                disabled={isSubmitting || !reqId.trim() || !reqTitle.trim() || !/^REQ-\d{3,}$/.test(reqId.trim())}
                title={!reqId.trim() ? t('reqId') + ' is required' : !reqTitle.trim() ? t('title') + ' is required' : !/^REQ-\d{3,}$/.test(reqId.trim()) ? t('requirementIdInvalid') : ''}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    {t('creating')}
                  </>
                ) : (
                  t('createRequirement')
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Enhanced Search and Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-4">
        <div className="flex gap-4 items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
            <Input
              placeholder={t('searchRequirements')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t('status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allStatus')}</SelectItem>
                <SelectItem value="draft">{t('draft')}</SelectItem>
                <SelectItem value="reviewed">{t('reviewed')}</SelectItem>
                <SelectItem value="approved">{t('approved')}</SelectItem>
                <SelectItem value="implemented">{t('implemented')}</SelectItem>
                <SelectItem value="verified">{t('verified')}</SelectItem>
                <SelectItem value="deprecated">{t('deprecated')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t('priority')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allPriority')}</SelectItem>
                <SelectItem value="low">{t('low')}</SelectItem>
                <SelectItem value="medium">{t('medium')}</SelectItem>
                <SelectItem value="high">{t('high')}</SelectItem>
                <SelectItem value="critical">{t('critical')}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              <Download className={`h-4 w-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
              {t('export')}
            </Button>
          </div>
        </div>
      </div>

      {/* Requirements List */}
      <div className="space-y-4">
        {paginatedRequirements.length > 0 ? (
          paginatedRequirements.map((requirement) => (
            <Card key={requirement.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm text-gray-500 dark:text-gray-400">{requirement.requirement_id}</span>
                      <Badge className={getStatusBadge(requirement.status)}>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(requirement.status)}
                          {requirement.status}
                        </div>
                      </Badge>
                      <Badge className={getPriorityBadge(requirement.priority)}>
                        {requirement.priority}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg mb-1">{requirement.title}</CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{requirement.description}</p>
                    {requirement.tags && requirement.tags.trim() && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {requirement.tags.split(',').map((tag, index) => {
                          const trimmedTag = tag.trim();
                          return trimmedTag ? (
                            <span key={index} className="text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                              {trimmedTag}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                    {requirement.estimated_effort && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <Clock className="h-3 w-3" />
                        {t('estimatedEffort', { effort: requirement.estimated_effort })}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(requirement.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleViewRequirement(requirement)}
                    >
                      <Eye className={`h-4 w-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                      {t('view')}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEditRequirement(requirement)}
                    >
                      <Edit className={`h-4 w-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                      {t('edit')}
                    </Button>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => openDeleteDialog(requirement)}
                  >
                    <Trash2 className={`h-4 w-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                    {t('delete')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {searchQuery ? t('noRequirementsFound') : t('noRequirements')}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {searchQuery
                    ? t('tryAdjustingSearch')
                    : t('getStartedCreating')
                  }
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* View Requirement Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[95vw] md:max-w-[700px] lg:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('requirementDetails')}</DialogTitle>
            <DialogDescription>
              {t('viewManageRequirement')}
            </DialogDescription>
          </DialogHeader>
          {selectedRequirement && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">{t('requirementId')}</Label>
                  <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{selectedRequirement.requirement_id}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">{t('status')}</Label>
                  <div className="mt-1">
                    <Badge className={getStatusBadge(selectedRequirement.status)}>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(selectedRequirement.status)}
                        {selectedRequirement.status}
                      </div>
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">{t('priority')}</Label>
                  <div className="mt-1">
                    <Badge className={getPriorityBadge(selectedRequirement.priority)}>
                      {selectedRequirement.priority}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">{t('created')}</Label>
                  <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                    {new Date(selectedRequirement.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium">{t('title')}</Label>
                <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{selectedRequirement.title}</p>
              </div>
              
              <div>
                <Label className="text-sm font-medium">{t('description')}</Label>
                <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">
                  {selectedRequirement.description || t('noDescriptionProvided')}
                </p>
              </div>
              
              {selectedRequirement.acceptance_criteria && (
                <div>
                  <Label className="text-sm font-medium">{t('acceptanceCriteria')}</Label>
                  <p className="text-sm text-gray-900 dark:text-gray-100 mt-1 whitespace-pre-wrap">
                    {selectedRequirement.acceptance_criteria}
                  </p>
                </div>
              )}
              
              {selectedRequirement.tags && selectedRequirement.tags.trim() && (
                <div>
                  <Label className="text-sm font-medium">{t('tags')}</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedRequirement.tags.split(',').map((tag, index) => {
                      const trimmedTag = tag.trim();
                      return trimmedTag ? (
                        <span key={index} className="text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                          {trimmedTag}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
              
              {selectedRequirement.estimated_effort && (
                <div>
                  <Label className="text-sm font-medium">{t('estimatedEffortHours')}</Label>
                  <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{selectedRequirement.estimated_effort} hours</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsViewDialogOpen(false)}
            >
              {t('close')}
            </Button>
            <Button
              onClick={() => {
                setIsViewDialogOpen(false);
                handleEditRequirement(selectedRequirement!);
              }}
            >
              {t('editRequirement')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Requirement Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => !open && handleDialogClose('edit')}>
        <DialogContent isRTL={isRTL} className="w-[96vw] max-w-[96vw] sm:max-w-[95vw] md:max-w-[900px] lg:max-w-[1000px] max-h-[90vh] overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out">
          <DialogHeader className="space-y-2 pb-4">
            <DialogTitle className="text-2xl font-semibold">{t('editRequirement')}</DialogTitle>
            <DialogDescription className="text-sm">
              {t('updateRequirementInfo')}
            </DialogDescription>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded border">⌘ + Enter</kbd>
              <span>{t('toSubmit')}</span>
              <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded border">Esc</kbd>
              <span>{t('toClose')}</span>
            </div>
          </DialogHeader>
          <div className="grid gap-4 py-6 md:grid-cols-[minmax(0,1fr)_minmax(240px,280px)] lg:gap-6">
            {/* Main Content Area - Writing Focused */}
            <div className="min-w-0 space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-reqTitle" className="text-base font-semibold">
                    {t('title')} <span className="text-red-500">*</span>
                  </Label>
                  {reqTitle.length > 0 && (
                    <span className="text-xs text-green-600 font-medium">✓</span>
                  )}
                </div>
                <Input
                  id="edit-reqTitle"
                  ref={titleInputRef}
                  value={reqTitle}
                  onChange={(e) => setReqTitle(e.target.value)}
                  className="text-lg font-medium h-12 transition-all focus:ring-2 focus:ring-blue-500"
                  placeholder={t('enterRequirementTitle')}
                />
                <p className="text-xs text-gray-500">{t('titleHelper')}</p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-reqDescription" className="text-base font-semibold">
                    {t('description')}
                  </Label>
                  <span className="text-xs text-gray-500">{getPlainTextLength(reqDescription)} {t('chars')}</span>
                </div>
                <RichTextEditor
                  value={reqDescription}
                  onChange={setReqDescription}
                  placeholder={t('enterRequirementDescription')}
                  mentions={[{ id: 'current-user', label: 'You' }]}
                  dir={isRTL ? 'rtl' : 'ltr'}
                  className="min-h-[220px]"
                />
                <p className="text-xs text-gray-500">{t('descriptionHelper')}</p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-acceptanceCriteria" className="text-base font-semibold">
                    {t('acceptanceCriteria')}
                  </Label>
                  <span className="text-xs text-gray-500">{getPlainTextLength(reqAcceptanceCriteria)} {t('chars')}</span>
                </div>
                <RichTextEditor
                  value={reqAcceptanceCriteria}
                  onChange={setReqAcceptanceCriteria}
                  placeholder={t('enterAcceptanceCriteria')}
                  mentions={[{ id: 'current-user', label: 'You' }]}
                  dir={isRTL ? 'rtl' : 'ltr'}
                  className="min-h-[170px]"
                />
                <p className="text-xs text-gray-500">{t('acceptanceCriteriaHelper')}</p>
              </div>

              <div className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">{t('rteVersionHistory')}</Label>
                  <Button type="button" size="sm" variant="outline" onClick={saveVersionSnapshot}>
                    {t('rteSaveSnapshot')}
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <select
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                    value={compareFromId}
                    onChange={(e) => setCompareFromId(e.target.value)}
                  >
                    <option value="">{t('rteCompareFrom')}</option>
                    {contentVersions.map((version) => (
                      <option key={version.id} value={version.id}>
                        {new Date(version.createdAt).toLocaleString()}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                    value={compareToId}
                    onChange={(e) => setCompareToId(e.target.value)}
                  >
                    <option value="">{t('rteCompareTo')}</option>
                    {contentVersions.map((version) => (
                      <option key={version.id} value={version.id}>
                        {new Date(version.createdAt).toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>
                {fromSnapshot && toSnapshot && (
                  <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-900/30">
                    <div className="font-medium">{t('rteInlineDiff')}</div>
                    <div
                      className="prose prose-sm max-w-none whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ __html: buildDiffHtml(fromSnapshot.description, toSnapshot.description) }}
                    />
                  </div>
                )}
              </div>
            </div>
            
            {/* Sidebar - Metadata */}
            <div className="min-w-0 space-y-5 bg-gray-50 dark:bg-gray-800/50 p-4 sm:p-5 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="pb-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('metadata')}</h3>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-reqId" className="text-sm font-medium">
                  {t('reqId')}
                </Label>
                <Input
                  id="edit-reqId"
                  value={reqId}
                  disabled
                  className="text-sm bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                />
                <p className="text-xs text-gray-500">{t('reqIdImmutable')}</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-reqStatus" className="text-sm font-medium">
                  {t('status')}
                </Label>
                <Select value={reqStatus} onValueChange={setReqStatus}>
                  <SelectTrigger className="text-sm transition-all focus:ring-2 focus:ring-blue-500">
                    <SelectValue placeholder={t('selectStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">{t('draft')}</SelectItem>
                    <SelectItem value="reviewed">{t('reviewed')}</SelectItem>
                    <SelectItem value="approved">{t('approved')}</SelectItem>
                    <SelectItem value="implemented">{t('implemented')}</SelectItem>
                    <SelectItem value="verified">{t('verified')}</SelectItem>
                    <SelectItem value="deprecated">{t('deprecated')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-reqPriority" className="text-sm font-medium">
                  {t('priority')}
                </Label>
                <Select value={reqPriority} onValueChange={setReqPriority}>
                  <SelectTrigger className="text-sm transition-all focus:ring-2 focus:ring-blue-500">
                    <SelectValue placeholder={t('selectPriority')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t('low')}</SelectItem>
                    <SelectItem value="medium">{t('medium')}</SelectItem>
                    <SelectItem value="high">{t('high')}</SelectItem>
                    <SelectItem value="critical">{t('critical')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-reqEstimatedEffort" className="text-sm font-medium">
                  {t('estEffort')}
                </Label>
                <Input
                  id="edit-reqEstimatedEffort"
                  type="number"
                  step="0.5"
                  value={reqEstimatedEffort}
                  onChange={(e) => setReqEstimatedEffort(e.target.value)}
                  className="text-sm transition-all focus:ring-2 focus:ring-blue-500"
                  placeholder="8.0"
                />
                <p className="text-xs text-gray-500">{t('estimatedEffortHelper')}</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-reqTags" className="text-sm font-medium">
                  {t('tags')}
                </Label>
                <Input
                  id="edit-reqTags"
                  value={reqTags}
                  onChange={(e) => setReqTags(e.target.value)}
                  className="text-sm transition-all focus:ring-2 focus:ring-blue-500"
                  placeholder="security, authentication"
                />
                <p className="text-xs text-gray-500">{t('tagsHelper')}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleDialogClose('edit')}
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              onClick={handleUpdateRequirement}
              disabled={isSubmitting || !reqTitle.trim()}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  {t('updating')}
                </>
              ) : (
                t('updateRequirement')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unsaved Changes Dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent isRTL={isRTL}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('unsavedChangesTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('unsavedChangesModalMessage')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleUnsavedCancel}>
              {t('keepEditingModal')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleUnsavedConfirm(isCreateDialogOpen ? 'create' : 'edit')}
              className="bg-red-600 hover:bg-red-700"
            >
              {t('discardChangesModal')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent isRTL={isRTL} className="sm:max-w-[95vw] md:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className={`h-5 w-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('deleteRequirementConfirm')}
            </AlertDialogTitle>
            <div className="space-y-4">
              <div className="text-sm">
                <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {t('aboutToDeleteRequirement')}
                </p>
                <p className="font-bold text-lg text-red-600 dark:text-red-400 mb-3">
                  "{requirementToDelete?.title}"
                </p>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 mb-3">
                  <p className="font-semibold text-red-800 dark:text-red-200 mb-2">
                    {t('actionWillDelete')}
                  </p>
                  <ul className={`text-xs text-red-700 dark:text-red-300 space-y-1 ${isRTL ? 'mr-4' : 'ml-4'} list-disc`}>
                    <li>{t('deleteRequirementItem1')}</li>
                    <li>{t('deleteRequirementItem2')}</li>
                    <li>{t('deleteRequirementItem3')}</li>
                    <li>{t('deleteRequirementItem4')}</li>
                  </ul>
                </div>
                <p className="text-red-600 dark:text-red-400 font-semibold mb-2">
                  This action cannot be undone!
                </p>
                <div className="mt-4">
                  <Label htmlFor="confirm-name" className="text-sm font-medium">
                    {t('toConfirmTypeTitle')} <span className="font-bold">{requirementToDelete?.title}</span>
                  </Label>
                  <Input
                    id="confirm-name"
                    value={deleteConfirmationName}
                    onChange={(e) => setDeleteConfirmationName(e.target.value)}
                    placeholder={t('typeRequirementTitle')}
                    className="mt-2"
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsDeleteDialogOpen(false);
              setRequirementToDelete(null);
              setDeleteConfirmationName('');
            }}>
              {t('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRequirement}
              disabled={deleteConfirmationName.toLowerCase() !== requirementToDelete?.title?.toLowerCase()}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {t('deleteRequirement')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pagination */}
      {totalPages > 1 && filteredRequirements.length > 0 && (
        <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-lg shadow mt-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {t('showingRequirements', { start: startIndex + 1, end: Math.min(startIndex + itemsPerPage, filteredRequirements.length), total: filteredRequirements.length })}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              {t('previous')}
            </Button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('pageOf', { current: currentPage, total: totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              {t('next')}
              {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
