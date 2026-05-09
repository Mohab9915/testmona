import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { 
  Plus, 
  Bug, 
  MessageSquare, 
  Paperclip, 
  History, 
  Settings, 
  ExternalLink, 
  RefreshCw,
  User,
  Calendar,
  Edit,
  Trash2,
  Copy,
  Eye,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { defectManagementAPI, IssueTrackerIntegration } from '@/lib/defectManagementAPI';
import { useRequireProjectSelection } from '@/hooks/useRequireProjectSelection';


export function DefectManagement() {
  const navigate = useNavigate();
  const selectedProject = useRequireProjectSelection();
  const { toast } = useToast();
  const { t, isRTL } = useTranslation();
  
  // State for defects
  const [defects, setDefects] = useState<any[]>([]);
  const [selectedDefect, setSelectedDefect] = useState<any>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const defectTitleInputRef = useRef<HTMLInputElement>(null);
  
  // State for integrations
  const [integrations, setIntegrations] = useState<IssueTrackerIntegration[]>([]);
  const [isLoadingIntegrations, setIsLoadingIntegrations] = useState(false);
  const [isIntegrationDialogOpen, setIsIntegrationDialogOpen] = useState(false);
  const [isIntegrationFormOpen, setIsIntegrationFormOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<IssueTrackerIntegration | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Sync dialog state
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [syncingDefectId, setSyncingDefectId] = useState<number | null>(null);
  const [selectedSyncIntegrationId, setSelectedSyncIntegrationId] = useState<number | null>(null);
  
  // Attachment state
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [isDeletingAttachment, setIsDeletingAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form state for integration
  const [integrationForm, setIntegrationForm] = useState({
    name: '',
    tracker_type: 'jira',
    api_url: '',
    api_token: '',
    username: '',
    project_key: '',
    sync_direction: 'bidirectional',
    is_active: true
  });

  // Fetch integrations when project changes
  useEffect(() => {
    if (selectedProject) {
      fetchIntegrations();
      fetchDefects();
    }
  }, [selectedProject]);

  // Auto-focus on title input when dialog opens
  useEffect(() => {
    if (isCreateDialogOpen && defectTitleInputRef.current) {
      setTimeout(() => defectTitleInputRef.current?.focus(), 100);
    }
  }, [isCreateDialogOpen]);

  // Track unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(
      false // Will be updated when form state is added
    );
  }, []);

  const handleDialogClose = (open: boolean) => {
    if (!open && hasUnsavedChanges) {
      setShowUnsavedDialog(true);
    } else {
      setIsCreateDialogOpen(open);
      if (!open) {
        setHasUnsavedChanges(false);
      }
    }
  };

  const handleUnsavedConfirm = (discard: boolean) => {
    setShowUnsavedDialog(false);
    if (discard) {
      setHasUnsavedChanges(false);
      setIsCreateDialogOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      // handleCreateDefect will be called when form is implemented
    }
  };

  const fetchDefects = async () => {
    if (!selectedProject) return;
    
    try {
      const data = await defectManagementAPI.getDefects(selectedProject.id);
      setDefects(data);
    } catch (error) {
      console.error('Failed to fetch defects:', error);
      // Don't show toast for defects on load, just set empty
      setDefects([]);
    }
  };

  const fetchIntegrations = async () => {
    if (!selectedProject) return;
    
    setIsLoadingIntegrations(true);
    try {
      const data = await defectManagementAPI.getIssueTrackerIntegrations(selectedProject.id);
      setIntegrations(data);
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
      toast({
        title: t('error'),
        description: t('failedToLoadIntegrations'),
        variant: 'destructive',
      });
    } finally {
      setIsLoadingIntegrations(false);
    }
  };

  const handleAddIntegration = () => {
    setEditingIntegration(null);
    setIntegrationForm({
      name: '',
      tracker_type: 'jira',
      api_url: '',
      api_token: '',
      username: '',
      project_key: '',
      sync_direction: 'bidirectional',
      is_active: true
    });
    setIsIntegrationFormOpen(true);
  };

  const handleEditIntegration = (integration: IssueTrackerIntegration) => {
    setEditingIntegration(integration);
    setIntegrationForm({
      name: integration.name,
      tracker_type: integration.tracker_type,
      api_url: integration.api_url,
      api_token: '', // Don't pre-fill token for security
      username: integration.username || '',
      project_key: integration.project_key || '',
      sync_direction: integration.sync_direction,
      is_active: integration.is_active
    });
    setIsIntegrationFormOpen(true);
  };

  const handleSaveIntegration = async () => {
    if (!selectedProject) return;
    
    // Validation
    if (!integrationForm.name || !integrationForm.api_url || !integrationForm.tracker_type) {
      toast({
        title: t('validationError'),
        description: t('pleaseFixErrorsBeforeSaving'),
        variant: 'destructive',
      });
      return;
    }

    // URL validation
    try {
      new URL(integrationForm.api_url);
    } catch {
      toast({
        title: t('validationError'),
        description: t('apiUrlValidUrl'),
        variant: 'destructive',
      });
      return;
    }

    // Tracker-specific validation
    if (integrationForm.tracker_type === 'jira' && !integrationForm.project_key) {
      toast({
        title: t('validationError'),
        description: t('projectKeyRequired'),
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingIntegration) {
        await defectManagementAPI.updateIssueTrackerIntegration(
          selectedProject.id,
          editingIntegration.id,
          integrationForm
        );
        toast({
          title: t('success'),
          description: t('integrationUpdatedSuccessfully'),
        });
      } else {
        await defectManagementAPI.createIssueTrackerIntegration(
          selectedProject.id,
          integrationForm
        );
        toast({
          title: t('success'),
          description: t('integrationCreatedSuccessfully'),
        });
      }
      setIsIntegrationFormOpen(false);
      fetchIntegrations();
    } catch (error) {
      console.error('Failed to save integration:', error);
      toast({
        title: t('error'),
        description: t('failedToSaveIntegration'),
        variant: 'destructive',
      });
    }
  };

  const handleDeleteIntegration = async (integrationId: number) => {
    if (!selectedProject) return;
    
    if (!confirm(t('confirmDeleteIntegration'))) {
      return;
    }

    try {
      await defectManagementAPI.deleteIssueTrackerIntegration(selectedProject.id, integrationId);
      toast({
        title: t('success'),
        description: t('integrationDeletedSuccessfully'),
      });
      fetchIntegrations();
    } catch (error) {
      console.error('Failed to delete integration:', error);
      toast({
        title: t('error'),
        description: t('failedToDeleteIntegration'),
        variant: 'destructive',
      });
    }
  };

  const handleTestConnection = async (integrationId: number) => {
    if (!selectedProject) return;
    
    setIsTestingConnection(true);
    try {
      const result = await defectManagementAPI.testIssueTrackerConnection(selectedProject.id, integrationId);
      if (result.success) {
        toast({
          title: t('success'),
          description: t('connectionTestPassed'),
        });
      } else {
        toast({
          title: t('connectionTestFailed'),
          description: result.message || t('connectionTestFailed'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      toast({
        title: t('error'),
        description: t('connectionTestFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSyncIntegration = async (integrationId: number) => {
    if (!selectedProject) return;
    
    setIsSyncing(true);
    try {
      // Trigger sync - this would need to be implemented in the backend
      toast({
        title: t('syncSuccessful'),
        description: t('syncSuccessfulDesc'),
      });
      fetchIntegrations();
    } catch (error) {
      console.error('Sync failed:', error);
      toast({
        title: t('error'),
        description: t('syncFailedDesc'),
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      open: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      fixed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      reopened: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      closed: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      rejected: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
    };
    return variants[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, string> = {
      low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    };
    return variants[severity] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  };

  const getSyncStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      not_synced: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      syncing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      synced: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    };
    return variants[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  };

  const handleOpenSyncDialog = (defectId: number) => {
    if (integrations.length === 0) {
      toast({
        title: t('noIntegrationsAvailable'),
        description: t('noIntegrationsAvailable'),
        variant: 'destructive',
      });
      return;
    }
    setSyncingDefectId(defectId);
    setSelectedSyncIntegrationId(null);
    setIsSyncDialogOpen(true);
  };

  const handleSyncWithExternal = async () => {
    if (!selectedProject || !syncingDefectId || !selectedSyncIntegrationId) return;

    setIsSyncing(true);
    try {
      const result = await defectManagementAPI.syncDefectWithExternal(
        selectedProject.id,
        syncingDefectId,
        {
          integration_id: selectedSyncIntegrationId,
          sync_type: 'bidirectional',
          action: 'create'
        }
      );

      if (result.success) {
        toast({
          title: t('syncSuccessful'),
          description: t('syncSuccessfulDesc', { issueId: result.issue_id }),
        });
        setIsSyncDialogOpen(false);
        // Refresh defects to update sync status
        fetchDefects();
      } else {
        toast({
          title: t('syncFailed'),
          description: result.message || t('syncFailedDesc'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to sync defect:', error);
      toast({
        title: t('error'),
        description: t('syncFailedDesc'),
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleViewInExternal = (externalUrl: string) => {
    window.open(externalUrl, '_blank');
  };

  const handleUploadAttachment = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedProject || !selectedDefect) return;
    
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'Maximum file size is 10MB',
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingAttachment(true);
    try {
      const attachment = await defectManagementAPI.uploadDefectAttachment(
        selectedProject.id,
        selectedDefect.id,
        file
      );
      
      // Refresh defect details to show new attachment
      const updatedDefect = await defectManagementAPI.getDefectById(selectedProject.id, selectedDefect.id);
      setSelectedDefect(updatedDefect);
      
      toast({
        title: t('success'),
        description: 'Attachment uploaded successfully',
      });
    } catch (error) {
      console.error('Failed to upload attachment:', error);
      toast({
        title: t('error'),
        description: 'Failed to upload attachment',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingAttachment(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!selectedProject || !selectedDefect) return;
    
    if (!confirm('Are you sure you want to delete this attachment?')) {
      return;
    }

    setIsDeletingAttachment(true);
    try {
      await defectManagementAPI.deleteDefectAttachment(
        selectedProject.id,
        selectedDefect.id,
        attachmentId
      );
      
      // Refresh defect details to remove deleted attachment
      const updatedDefect = await defectManagementAPI.getDefectById(selectedProject.id, selectedDefect.id);
      setSelectedDefect(updatedDefect);
      
      toast({
        title: t('success'),
        description: 'Attachment deleted successfully',
      });
    } catch (error) {
      console.error('Failed to delete attachment:', error);
      toast({
        title: t('error'),
        description: 'Failed to delete attachment',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingAttachment(false);
    }
  };

  const handleViewAttachment = (attachment: any) => {
    // For now, just alert that download/view needs to be implemented
    // In a real implementation, this would download or open the file
    toast({
      title: t('info'),
      description: 'File download/view functionality to be implemented',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('defects')}</h1>
          <p className="text-gray-600 dark:text-gray-400">{t('defectsDescription')}</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isIntegrationDialogOpen} onOpenChange={setIsIntegrationDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                {t('integrations')}
              </Button>
            </DialogTrigger>
            <DialogContent isRTL={isRTL} className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>{t('integrations')}</DialogTitle>
                <DialogDescription>
                  {t('integrationsDesc')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {isLoadingIntegrations ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : integrations.length === 0 ? (
                  <div className="text-center py-8">
                    <Settings className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                    <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{t('noIntegrationsAvailable')}</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {t('noIntegrationsAvailable')}
                    </p>
                  </div>
                ) : (
                  integrations.map((integration) => (
                    <Card key={integration.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold">{integration.name}</h4>
                              {!integration.is_active && (
                                <Badge variant="outline" className="text-xs">{t('inactive')}</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                              <Badge variant="outline" className="capitalize">
                                {integration.tracker_type}
                              </Badge>
                              {integration.project_key && (
                                <Badge variant="outline">{integration.project_key}</Badge>
                              )}
                              <Badge className={getSyncStatusBadge(integration.sync_status)}>
                                {integration.sync_status}
                              </Badge>
                            </div>
                            {integration.last_sync && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {t('lastSync')}: {new Date(integration.last_sync).toLocaleString()}
                              </p>
                            )}
                            {integration.sync_error && (
                              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                <AlertCircle className="h-3 w-3 inline mr-1" />
                                {integration.sync_error}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleTestConnection(integration.id)}
                              disabled={isTestingConnection}
                            >
                              {isTestingConnection ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleSyncIntegration(integration.id)}
                              disabled={isSyncing}
                            >
                              {isSyncing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleEditIntegration(integration)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleDeleteIntegration(integration.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={handleAddIntegration}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('addIntegration')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* Integration Form Dialog */}
          <Dialog open={isIntegrationFormOpen} onOpenChange={setIsIntegrationFormOpen}>
            <DialogContent isRTL={isRTL} className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingIntegration ? t('editIntegration') : t('addIntegrationTitle')}
                </DialogTitle>
                <DialogDescription>
                  {editingIntegration 
                    ? t('updateIntegrationConfiguration')
                    : t('configureNewIntegration')
                  }
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="integration-name">{t('integrationNameLabel')} *</Label>
                    <Input
                      id="integration-name"
                      placeholder={t('integrationNamePlaceholder')}
                      value={integrationForm.name}
                      onChange={(e) => setIntegrationForm({...integrationForm, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tracker-type">{t('trackerType')} *</Label>
                    <Select
                      value={integrationForm.tracker_type}
                      onValueChange={(value) => setIntegrationForm({...integrationForm, tracker_type: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="jira">Jira</SelectItem>
                        <SelectItem value="github">GitHub</SelectItem>
                        <SelectItem value="gitlab">GitLab</SelectItem>
                        <SelectItem value="azure-devops">Azure DevOps</SelectItem>
                        <SelectItem value="linear">Linear</SelectItem>
                        <SelectItem value="asana">Asana</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="api-url">{t('apiUrlLabel')} *</Label>
                  <Input
                    id="api-url"
                    placeholder={t('apiUrlPlaceholder')}
                    value={integrationForm.api_url}
                    onChange={(e) => setIntegrationForm({...integrationForm, api_url: e.target.value})}
                  />
                  <p className="text-xs text-gray-500">
                    {integrationForm.tracker_type === 'jira' && t('jiraExample')}
                    {integrationForm.tracker_type === 'github' && t('githubExample')}
                    {integrationForm.tracker_type === 'gitlab' && t('gitlabExample')}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">{t('usernameEmail')}</Label>
                    <Input
                      id="username"
                      placeholder={t('usernameEmailPlaceholder')}
                      value={integrationForm.username}
                      onChange={(e) => setIntegrationForm({...integrationForm, username: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="api-token">{t('apiTokenLabel')}</Label>
                    <Input
                      id="api-token"
                      type="password"
                      placeholder={editingIntegration ? t('apiTokenLeaveBlank') : t('apiTokenPlaceholder')}
                      value={integrationForm.api_token}
                      onChange={(e) => setIntegrationForm({...integrationForm, api_token: e.target.value})}
                    />
                    <p className="text-xs text-gray-500">
                      {t('tokenEncryptedSecurely')}
                    </p>
                  </div>
                </div>

                {integrationForm.tracker_type === 'jira' && (
                  <div className="space-y-2">
                    <Label htmlFor="project-key">{t('projectKeyLabel')} *</Label>
                    <Input
                      id="project-key"
                      placeholder={t('projectKeyPlaceholder')}
                      value={integrationForm.project_key}
                      onChange={(e) => setIntegrationForm({...integrationForm, project_key: e.target.value})}
                    />
                    <p className="text-xs text-gray-500">
                      {t('projectKeyDesc')}
                    </p>
                  </div>
                )}

                {(integrationForm.tracker_type === 'github' || integrationForm.tracker_type === 'gitlab') && (
                  <div className="space-y-2">
                    <Label htmlFor="project-key">{t('repositoryOwnerNamespace')} *</Label>
                    <Input
                      id="project-key"
                      placeholder={t('repositoryOwnerPlaceholder')}
                      value={integrationForm.project_key}
                      onChange={(e) => setIntegrationForm({...integrationForm, project_key: e.target.value})}
                    />
                    <p className="text-xs text-gray-500">
                      {integrationForm.tracker_type === 'github' && t('githubUsername')}
                      {integrationForm.tracker_type === 'gitlab' && t('gitlabNamespace')}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="sync-direction">{t('syncDirection')}</Label>
                  <Select
                    value={integrationForm.sync_direction}
                    onValueChange={(value) => setIntegrationForm({...integrationForm, sync_direction: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="import">{t('importOnly')}</SelectItem>
                      <SelectItem value="export">{t('exportOnly')}</SelectItem>
                      <SelectItem value="bidirectional">{t('bidirectional')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is-active"
                    checked={integrationForm.is_active}
                    onChange={(e) => setIntegrationForm({...integrationForm, is_active: e.target.checked})}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="is-active">{t('enableThisIntegration')}</Label>
                </div>

                {editingIntegration && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <AlertCircle className="h-4 w-4 inline mr-2" />
                      {t('leaveApiTokenBlank')}
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsIntegrationFormOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button onClick={handleSaveIntegration}>
                  {editingIntegration ? t('editIntegration') : t('addIntegration')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Sync Dialog */}
          <Dialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen}>
            <DialogContent isRTL={isRTL} className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{t('syncDefectWithExternal')}</DialogTitle>
                <DialogDescription>
                  {t('syncDefectWithExternalDesc')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sync-integration">{t('selectIntegration')} *</Label>
                  <Select
                    value={selectedSyncIntegrationId?.toString()}
                    onValueChange={(value) => setSelectedSyncIntegrationId(parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectAnIntegration')} />
                    </SelectTrigger>
                    <SelectContent>
                      {integrations.map((integration) => (
                        <SelectItem key={integration.id} value={integration.id.toString()}>
                          <div className="flex items-center gap-2">
                            <span className="capitalize">{integration.tracker_type}</span>
                            <span className="text-gray-500">- {integration.name}</span>
                            {!integration.is_active && <Badge variant="outline" className="text-xs ml-2">{t('inactive')}</Badge>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {integrations.length === 0 && (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                    <p>{t('noIntegrationsAvailable')}</p>
                  </div>
                )}

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <AlertCircle className="h-4 w-4 inline mr-2" />
                    {t('defectWillBeSynced')}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsSyncDialogOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button onClick={handleSyncWithExternal} disabled={!selectedSyncIntegrationId || isSyncing}>
                  {isSyncing ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('syncingDefect')}
                    </div>
                  ) : (
                    t('syncDefect')
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateDialogOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t('reportDefect')}
              </Button>
            </DialogTrigger>
            <DialogContent isRTL={isRTL} className="sm:max-w-[700px]" onKeyDown={handleKeyDown}>
              <DialogHeader>
                <DialogTitle>{t('reportNewDefect')}</DialogTitle>
                <DialogDescription>
                  {t('reportNewDefectDesc')}
                </DialogDescription>
              </DialogHeader>
              {/* Form content would go here */}
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <div className="text-xs text-gray-500 mb-2 sm:mb-0 sm:mr-auto">
                  Ctrl+Enter to submit
                </div>
                <Button variant="outline" onClick={() => handleDialogClose(false)}>
                  {t('cancel')}
                </Button>
                <Button onClick={() => setIsCreateDialogOpen(false)}>
                  {t('reportNewDefect')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Defects List */}
      <div className="space-y-4">
        {defects.length === 0 ? (
          <div className="text-center py-12">
            <Bug className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{t('noDefectsReported')}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t('noDefectsReportedDesc')}
            </p>
          </div>
        ) : (
          defects.map((defect) => (
            <Card key={defect.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-sm font-semibold">{defect.defect_id}</span>
                      <Badge className={getStatusBadge(defect.status)}>
                        {defect.status.replace('_', ' ')}
                      </Badge>
                      <Badge className={getSeverityBadge(defect.severity)}>
                        {defect.severity}
                      </Badge>
                      {defect.external_issue_id && (
                        <Badge className={getSyncStatusBadge(defect.external_sync_status)}>
                          <ExternalLink className="h-3 w-3 mr-1" />
                          {defect.external_sync_status}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg mb-1">{defect.title}</CardTitle>
                    <p className="text-gray-600 dark:text-gray-400 mb-2">{defect.description}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>Assigned to: {defect.assignee?.name || 'Unassigned'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>Created: {new Date(defect.created_at).toLocaleDateString()}</span>
                      </div>
                      {defect.external_issue_id && (
                        <div className="flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />
                          <span>{defect.external_issue_id}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setSelectedDefect(defect)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>

      {/* Defect Detail Dialog */}
      {selectedDefect && (
        <Dialog open={!!selectedDefect} onOpenChange={() => setSelectedDefect(null)}>
          <DialogContent isRTL={isRTL} className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <DialogTitle className="flex items-center gap-2">
                  <Bug className="h-5 w-5" />
                  {selectedDefect.defect_id} - {selectedDefect.title}
                </DialogTitle>
                <div className="flex items-center gap-2">
                  <Badge className={getStatusBadge(selectedDefect.status)}>
                    {selectedDefect.status.replace('_', ' ')}
                  </Badge>
                  <Badge className={getSeverityBadge(selectedDefect.severity)}>
                    {selectedDefect.severity}
                  </Badge>
                </div>
              </div>
              <DialogDescription>
                Detailed defect information and management options
              </DialogDescription>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="comments">
                  Comments ({selectedDefect.comments.length})
                </TabsTrigger>
                <TabsTrigger value="attachments">
                  Attachments ({selectedDefect.attachments.length})
                </TabsTrigger>
                <TabsTrigger value="history">
                  History ({selectedDefect.history.length})
                </TabsTrigger>
                <TabsTrigger value="external">External</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Reporter</Label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{selectedDefect.reporter.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Assignee</Label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{selectedDefect.assignee.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Environment</Label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{selectedDefect.environment}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Found in Version</Label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{selectedDefect.found_in_version}</p>
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Steps to Reproduce</Label>
                  <pre className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-2 rounded whitespace-pre-wrap">
                    {selectedDefect.steps_to_reproduce}
                  </pre>
                </div>

                <div>
                  <Label className="text-sm font-medium">Expected Result</Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400 bg-green-50 dark:bg-green-900/20 p-2 rounded">
                    {selectedDefect.expected_result}
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-medium">Actual Result</Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                    {selectedDefect.actual_result}
                  </p>
                </div>

                {selectedDefect.root_cause && (
                  <div>
                    <Label className="text-sm font-medium">Root Cause</Label>
                    <p className="text-sm text-gray-600 dark:text-gray-400 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
                      {selectedDefect.root_cause}
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="comments" className="space-y-4">
                {selectedDefect.comments.map((comment) => (
                  <div key={comment.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span className="font-medium">{comment.author.name}</span>
                        {comment.is_internal && (
                          <Badge variant="outline" className="text-xs">Internal</Badge>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(comment.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{comment.comment}</p>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Textarea placeholder="Add a comment..." className="flex-1" />
                  <Button>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="attachments" className="space-y-4">
                {selectedDefect.attachments?.map((attachment) => (
                  <div key={attachment.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4" />
                      <span className="font-medium">{attachment.filename}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        ({attachment.file_size ? (attachment.file_size / 1024).toFixed(1) : 'N/A'} KB)
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleViewAttachment(attachment)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleDeleteAttachment(attachment.id)}
                        disabled={isDeletingAttachment}
                      >
                        {isDeletingAttachment ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleUploadAttachment}
                  className="hidden"
                />
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAttachment}
                >
                  {isUploadingAttachment ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading...
                    </div>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Upload Attachment
                    </>
                  )}
                </Button>
              </TabsContent>

              <TabsContent value="history" className="space-y-4">
                {selectedDefect.history.map((item) => (
                  <div key={item.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4" />
                      <div>
                        <span className="font-medium">{item.field_name}</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          changed from "{item.old_value}" to "{item.new_value}"
                        </span>
                        {item.change_reason && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">Reason: {item.change_reason}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{item.changed_by.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="external" className="space-y-4">
                {selectedDefect.external_issue_id ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">External Issue ID</Label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{selectedDefect.external_issue_id}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Sync Status</Label>
                        <Badge className={getSyncStatusBadge(selectedDefect.external_sync_status)}>
                          {selectedDefect.external_sync_status}
                        </Badge>
                      </div>
                    </div>
                    {selectedDefect.external_issue_url && (
                      <div>
                        <Label className="text-sm font-medium">External URL</Label>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewInExternal(selectedDefect.external_issue_url)}
                          className="mt-1"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View in External System
                        </Button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => handleOpenSyncDialog(selectedDefect.id)} disabled={integrations.length === 0}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Sync Now
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <ExternalLink className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                    <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">No External Link</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      This defect is not linked to any external issue tracker.
                    </p>
                    <Button className="mt-4" variant="outline" onClick={() => handleOpenSyncDialog(selectedDefect.id)} disabled={integrations.length === 0}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync with External Tracker
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedDefect(null)}>
                Close
              </Button>
              <Button>
                <Edit className="h-4 w-4 mr-2" />
                Edit Defect
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
