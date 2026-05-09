import { useState, useEffect, useRef } from 'react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, ExternalLink, MoreHorizontal, Trash2, Globe, Shield, Database, Layout as LayoutIcon, Cpu, FileText, Link, Users, Settings as SettingsIcon, Tag, Clock, Target, Zap, Layers, Copy, Edit, TrendingUp, FolderTree, AlertCircle, CheckCircle, XCircle, Loader2, RefreshCw, History, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';
import { Switch } from '@/components/ui/switch';
import { api, testCasesAPI, sectionsAPI, importExportAPI, userPreferencesAPI, enumsAPI, testManagementAPI, systemSettingsAPI } from '@/lib/api';
import { defectManagementAPI, IssueTrackerIntegration } from '@/lib/defectManagementAPI';
import { useAuthStore } from '@/stores/authStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/hooks/use-toast';
import { UserManagement } from '@/components/UserManagement';
import { isAdminUser } from '@/utils/roles';

// Test Management Types
interface TestType {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  is_custom?: boolean;
}

interface Priority {
  id: string;
  name: string;
  value: number;
  color: string;
  description: string;
  is_default: boolean;
  is_active: boolean;
  created_at?: string;
  is_custom?: boolean;
}

interface SharedStepTemplate {
  id: string;
  name: string;
  description: string;
  category: 'authentication' | 'database' | 'api' | 'ui' | 'setup' | 'cleanup' | 'validation' | 'reporting';
  tags: string[];
  complexity: 'simple' | 'medium' | 'complex';
  estimated_time: number;
  prerequisites: string[];
  related_steps: string[];
  usage_count: number;
  is_active: boolean;
  created_at: string;
}

interface TestExecutionSettings {
  id?: number;
  project_id?: number;
  auto_save_interval: number;
  screenshot_on_failure: boolean;
  video_recording: boolean;
  step_timeout: number;
  retry_attempts: number;
  parallel_execution: boolean;
  max_parallel_threads: number;
  cleanup_on_failure: boolean;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
}

interface NotificationSettings {
  id?: number;
  project_id?: number;
  email_notifications: boolean;
  slack_notifications: boolean;
  test_failure_alerts: boolean;
  test_completion_reports: boolean;
  weekly_summary: boolean;
  real_time_updates: boolean;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
}

interface UserNotificationPreferences {
  do_not_disturb: boolean;
  notification_sound_enabled: boolean;
  notifications_muted_until: string | null;
}

interface AutomationSettings {
  id?: number;
  project_id?: number;
  ai_suggestions: boolean;
  smart_step_recommendations: boolean;
  auto_categorization: boolean;
  duplicate_detection: boolean;
  performance_optimization: boolean;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
}

export function Settings() {
  const { language, setLanguage, compactMode, setCompactMode } = useAuthStore();
  const { t, isRTL } = useTranslation();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<IssueTrackerIntegration[]>([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);
  const [isIntegrationDialogOpen, setIsIntegrationDialogOpen] = useState(false);
  const [isIntegrationFormOpen, setIsIntegrationFormOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<IssueTrackerIntegration | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // System configuration state
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [newUserRegistration, setNewUserRegistration] = useState(true);
  const [debugLogging, setDebugLogging] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(60);
  const [passwordComplexity, setPasswordComplexity] = useState('high');
  const [saving, setSaving] = useState(false);
  
  // Audit trail configuration state
  const [auditTrailEnabled, setAuditTrailEnabled] = useState(true);
  const [auditEntitySettings, setAuditEntitySettings] = useState<Record<string, boolean>>({});
  const [loadingAuditConfig, setLoadingAuditConfig] = useState(false);
  const [savingAuditConfig, setSavingAuditConfig] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const loadSystemSettings = async () => {
    try {
      const settings = await systemSettingsAPI.getAllSettings();
      
      // Load each setting or create with default if it doesn't exist
      const maintenanceSetting = settings.find(s => s.key === 'maintenance_mode');
      if (maintenanceSetting) {
        setMaintenanceMode(maintenanceSetting.value === 'true');
      } else {
        await systemSettingsAPI.createSetting('maintenance_mode', 'false', 'Enable/disable maintenance mode');
      }

      const signupSetting = settings.find(s => s.key === 'signup_enabled');
      if (signupSetting) {
        setNewUserRegistration(signupSetting.value === 'true');
      } else {
        await systemSettingsAPI.createSetting('signup_enabled', 'true', 'Enable/disable public user registration');
      }

      const debugSetting = settings.find(s => s.key === 'debug_logging');
      if (debugSetting) {
        setDebugLogging(debugSetting.value === 'true');
      } else {
        await systemSettingsAPI.createSetting('debug_logging', 'false', 'Enable detailed logging for troubleshooting');
      }

      const sessionTimeoutSetting = settings.find(s => s.key === 'session_timeout');
      if (sessionTimeoutSetting) {
        setSessionTimeout(parseInt(sessionTimeoutSetting.value) || 60);
      } else {
        await systemSettingsAPI.createSetting('session_timeout', '60', 'Session timeout in minutes');
      }

      const passwordComplexitySetting = settings.find(s => s.key === 'password_complexity');
      if (passwordComplexitySetting) {
        setPasswordComplexity(passwordComplexitySetting.value || 'high');
      } else {
        await systemSettingsAPI.createSetting('password_complexity', 'high', 'Password complexity requirement (low, medium, high)');
      }
    } catch (error) {
      console.error('Failed to load system settings:', error);
      // Set defaults on error
      setMaintenanceMode(false);
      setNewUserRegistration(true);
      setDebugLogging(false);
      setSessionTimeout(60);
      setPasswordComplexity('high');
    }
  };

  const loadAuditTrailConfig = async () => {
    setLoadingAuditConfig(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return;
      }

      const response = await api.get('/system/settings/audit-trail-config');
      if (response.data) {
        setAuditTrailEnabled(response.data.enabled ?? true);
        setAuditEntitySettings(response.data.entity_settings || {});
      }
    } catch (error) {
      console.error('Failed to load audit trail config:', error);
      // Set defaults on error
      setAuditTrailEnabled(true);
      setAuditEntitySettings({});
    } finally {
      setLoadingAuditConfig(false);
    }
  };

  const handleSaveAuditTrailConfig = async () => {
    setSavingAuditConfig(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast({
          title: 'Error',
          description: 'Authentication required',
          variant: 'destructive',
        });
        return;
      }

      await api.put('/system/settings/audit-trail-config', {
        enabled: auditTrailEnabled,
        entity_settings: auditEntitySettings
      });

      toast({
        title: t('success'),
        description: t('auditConfigSaved'),
      });
    } catch (error) {
      console.error('Failed to save audit trail config:', error);
      toast({
        title: t('error'),
        description: t('auditConfigSaveFailed'),
        variant: 'destructive',
      });
    } finally {
      setSavingAuditConfig(false);
    }
  };

  const handleResetAuditTrailConfig = async () => {
    if (!confirm('Are you sure you want to reset audit trail configuration to defaults?')) {
      return;
    }

    setSavingAuditConfig(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast({
          title: 'Error',
          description: 'Authentication required',
          variant: 'destructive',
        });
        return;
      }

      const response = await api.post('/system/settings/audit-trail-config/reset');
      if (response.data) {
        setAuditTrailEnabled(response.data.enabled ?? true);
        setAuditEntitySettings(response.data.entity_settings || {});
      }

      toast({
        title: t('success'),
        description: t('auditConfigReset'),
      });
    } catch (error) {
      console.error('Failed to reset audit trail config:', error);
      toast({
        title: t('error'),
        description: t('auditConfigResetFailed'),
        variant: 'destructive',
      });
    } finally {
      setSavingAuditConfig(false);
    }
  };

  const handleEntityAuditToggle = (entityType: string, enabled: boolean) => {
    // If global audit is disabled, prevent toggling entity-specific settings
    if (!auditTrailEnabled) {
      return;
    }
    setAuditEntitySettings(prev => ({
      ...prev,
      [entityType]: enabled
    }));
  };

  const handleDeleteAllAuditTrails = async () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeleteAllAuditTrails = async () => {
    setShowDeleteConfirm(false);
    setSavingAuditConfig(true);
    try {
      const response = await fetch(`${(import.meta as any).env?.VITE_API_URL || 'http://localhost:8000'}/system/settings/audit-trails/all`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete audit trails');
      }

      const data = await response.json();
      toast({
        title: t('success'),
        description: data.message || t('deleteAllAuditTrailsSuccess'),
      });
    } catch (error) {
      console.error('Error deleting audit trails:', error);
      toast({
        title: t('error'),
        description: t('deleteAllAuditTrailsError'),
        variant: 'destructive',
      });
    } finally {
      setSavingAuditConfig(false);
    }
  };
  
  // Test Management Settings State - Remove mock data, will load from API
  const [testTypes, setTestTypes] = useState<TestType[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [sharedStepTemplates, setSharedStepTemplates] = useState<SharedStepTemplate[]>([]);
  const [loadingTestManagement, setLoadingTestManagement] = useState(false);
  const [testManagementError, setTestManagementError] = useState<string | null>(null);
  
  const [testExecutionSettings, setTestExecutionSettings] = useState<TestExecutionSettings>({
    auto_save_interval: 30,
    screenshot_on_failure: true,
    video_recording: false,
    step_timeout: 300,
    retry_attempts: 2,
    parallel_execution: true,
    max_parallel_threads: 4,
    cleanup_on_failure: true
  });
  
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    email_notifications: true,
    slack_notifications: false,
    test_failure_alerts: true,
    test_completion_reports: true,
    weekly_summary: true,
    real_time_updates: false
  });
  
  const [userNotificationPrefs, setUserNotificationPrefs] = useState<UserNotificationPreferences>({
    do_not_disturb: false,
    notification_sound_enabled: true,
    notifications_muted_until: null
  });
  
  const [automationSettings, setAutomationSettings] = useState<AutomationSettings>({
    ai_suggestions: false,
    smart_step_recommendations: true,
    auto_categorization: false,
    duplicate_detection: true,
    performance_optimization: true
  });
  
  // Dialog states for different forms
  const [testTypeDialogOpen, setTestTypeDialogOpen] = useState(false);
  const [priorityDialogOpen, setPriorityDialogOpen] = useState(false);
  const [sharedStepDialogOpen, setSharedStepDialogOpen] = useState(false);
  
  // Seamless UX states
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const testTypeNameInputRef = useRef<HTMLInputElement>(null);
  const priorityNameInputRef = useRef<HTMLInputElement>(null);
  const sharedStepNameInputRef = useRef<HTMLInputElement>(null);
  
  // Edit mode state
  const [editingTestType, setEditingTestType] = useState<TestType | null>(null);
  const [editingPriority, setEditingPriority] = useState<Priority | null>(null);
  const [editingSharedStep, setEditingSharedStep] = useState<SharedStepTemplate | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<'testType' | 'priority' | 'sharedStep' | null>(null);
  const [testTypeToDelete, setTestTypeToDelete] = useState<string | null>(null);
  const [priorityToDelete, setPriorityToDelete] = useState<string | null>(null);
  const [sharedStepToDelete, setSharedStepToDelete] = useState<string | null>(null);
  
  // Form states
  const [testTypeForm, setTestTypeForm] = useState({ name: '', description: '', color: '#3B82F6', icon: '🖱️' });
  const [priorityForm, setPriorityForm] = useState({ name: '', value: 2, color: '#F59E0B', description: '', is_default: false });
  const [sharedStepForm, setSharedStepForm] = useState({ 
    name: '', 
    description: '', 
    category: 'setup' as SharedStepTemplate['category'], 
    tags: '', 
    complexity: 'simple' as SharedStepTemplate['complexity'], 
    estimated_time: 1,
    prerequisites: '',
    related_steps: ''
  });
  
  // Auto-focus on input when dialogs open
  useEffect(() => {
    if (testTypeDialogOpen && testTypeNameInputRef.current) {
      setTimeout(() => testTypeNameInputRef.current?.focus(), 100);
    }
  }, [testTypeDialogOpen]);

  useEffect(() => {
    if (priorityDialogOpen && priorityNameInputRef.current) {
      setTimeout(() => priorityNameInputRef.current?.focus(), 100);
    }
  }, [priorityDialogOpen]);

  useEffect(() => {
    if (sharedStepDialogOpen && sharedStepNameInputRef.current) {
      setTimeout(() => sharedStepNameInputRef.current?.focus(), 100);
    }
  }, [sharedStepDialogOpen]);

  // Track unsaved changes for test type form
  useEffect(() => {
    setHasUnsavedChanges(
      testTypeForm.name.trim() !== '' || 
      testTypeForm.description.trim() !== ''
    );
  }, [testTypeForm.name, testTypeForm.description]);

  // Track unsaved changes for priority form
  useEffect(() => {
    setHasUnsavedChanges(
      priorityForm.name.trim() !== '' || 
      priorityForm.description.trim() !== ''
    );
  }, [priorityForm.name, priorityForm.description]);

  // Track unsaved changes for shared step form
  useEffect(() => {
    setHasUnsavedChanges(
      sharedStepForm.name.trim() !== '' || 
      sharedStepForm.description.trim() !== ''
    );
  }, [sharedStepForm.name, sharedStepForm.description]);

  // Seamless UX handlers
  const handleDialogClose = (dialogType: 'testType' | 'priority' | 'sharedStep', open: boolean) => {
    if (!open && hasUnsavedChanges) {
      setShowUnsavedDialog(true);
    } else {
      if (dialogType === 'testType') setTestTypeDialogOpen(open);
      if (dialogType === 'priority') setPriorityDialogOpen(open);
      if (dialogType === 'sharedStep') setSharedStepDialogOpen(open);
      if (!open) {
        setTestTypeForm({ name: '', description: '', color: '#3B82F6', icon: '🖱️' });
        setPriorityForm({ name: '', value: 2, color: '#F59E0B', description: '', is_default: false });
        setSharedStepForm({ 
          name: '', 
          description: '', 
          category: 'setup' as SharedStepTemplate['category'], 
          tags: '', 
          complexity: 'simple' as SharedStepTemplate['complexity'], 
          estimated_time: 1,
          prerequisites: '',
          related_steps: ''
        });
        setHasUnsavedChanges(false);
      }
    }
  };

  const handleUnsavedConfirm = (discard: boolean) => {
    setShowUnsavedDialog(false);
    if (discard) {
      setTestTypeForm({ name: '', description: '', color: '#3B82F6', icon: '🖱️' });
      setPriorityForm({ name: '', value: 2, color: '#F59E0B', description: '', is_default: false });
      setSharedStepForm({ 
        name: '', 
        description: '', 
        category: 'setup' as SharedStepTemplate['category'], 
        tags: '', 
        complexity: 'simple' as SharedStepTemplate['complexity'], 
        estimated_time: 1,
        prerequisites: '',
        related_steps: ''
      });
      setHasUnsavedChanges(false);
      setTestTypeDialogOpen(false);
      setPriorityDialogOpen(false);
      setSharedStepDialogOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, handler: () => void) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handler();
    }
  };
  
  // UI preferences state
  // compactMode is now managed by authStore

  // Integration form state
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
  
  // Dynamic placeholders based on tracker type
  const getPlaceholders = () => {
    const placeholders: Record<string, any> = {
      jira: {
        name: 'My Jira Integration',
        apiUrl: 'https://your-domain.atlassian.net',
        projectKey: 'TEST',
        projectKeyLabel: 'Project Key',
        projectKeyDesc: 'The project key from your Jira instance (e.g., TEST, PROJ)'
      },
      github: {
        name: 'My GitHub Integration',
        apiUrl: 'https://api.github.com',
        projectKey: 'owner/repo',
        projectKeyLabel: 'Repository',
        projectKeyDesc: 'GitHub repository in format: owner/repo'
      },
      gitlab: {
        name: 'My GitLab Integration',
        apiUrl: 'https://gitlab.com/api/v4',
        projectKey: 'namespace/project',
        projectKeyLabel: 'Project Path',
        projectKeyDesc: 'GitLab project path (e.g., namespace/project)'
      },
      'azure-devops': {
        name: 'My Azure DevOps Integration',
        apiUrl: 'https://dev.azure.com/your-org',
        projectKey: 'Project Name',
        projectKeyLabel: 'Project Name',
        projectKeyDesc: 'Azure DevOps project name'
      },
      linear: {
        name: 'My Linear Integration',
        apiUrl: 'https://api.linear.app',
        projectKey: 'Team Key',
        projectKeyLabel: 'Team Key',
        projectKeyDesc: 'Linear team key (e.g., ENG, PROD)'
      },
      asana: {
        name: 'My Asana Integration',
        apiUrl: 'https://app.asana.com/api/1.0',
        projectKey: 'Project GID',
        projectKeyLabel: 'Project GID',
        projectKeyDesc: 'Asana project GID (numeric ID)'
      }
    };
    return placeholders[integrationForm.tracker_type] || placeholders.jira;
  };
  
  // Validation state
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const nameInputRef = useRef<HTMLInputElement>(null);
  const apiUrlInputRef = useRef<HTMLInputElement>(null);
  const tokenInputRef = useRef<HTMLInputElement>(null);
  const projectKeyInputRef = useRef<HTMLInputElement>(null);

  // Mock projects for now
  const mockProjects = [
    { id: 1, name: 'Web Application' },
    { id: 2, name: 'Mobile App' },
    { id: 3, name: 'API Testing' }
  ];

  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        // Fall back to mock projects if no token
        setProjects(mockProjects);
        if (mockProjects.length > 0) {
          setSelectedProjectId(mockProjects[0].id);
        }
        return;
      }

      const response = await api.get('/projects');

      if (response.data) {
        setProjects(response.data);
        if (response.data.length > 0) {
          setSelectedProjectId(response.data[0].id);
        }
      } else {
        // Fall back to mock projects if API fails
        setProjects(mockProjects);
        if (mockProjects.length > 0) {
          setSelectedProjectId(mockProjects[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      // Fall back to mock projects on error
      setProjects(mockProjects);
      if (mockProjects.length > 0) {
        setSelectedProjectId(mockProjects[0].id);
      }
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    loadProjects();
    loadTestManagementSettings();
    loadSystemSettings();
    loadAuditTrailConfig();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadIntegrations();
    } else {
      setLoadingIntegrations(false);
    }
  }, [selectedProjectId]);

  const loadTestManagementSettings = async () => {
    setLoadingTestManagement(true);
    setTestManagementError(null);
    
    try {
      // Load test type definitions from database API only
      const token = localStorage.getItem('token');
      if (!token) {
        setTestManagementError('Authentication required. Please log in again.');
        setLoadingTestManagement(false);
        return;
      }

      const testTypesResponse = await api.get('/test-type-definitions/');
      const testTypesData = testTypesResponse.data;
      const mappedTestTypes = testTypesData.map((type: any) => ({
        id: type.id.toString(),
        name: type.name,
        description: type.description || `${type.name} test execution`,
        color: type.color,
        icon: type.icon,
        is_active: type.is_active,
        usage_count: type.usage_count || 0,
        created_at: type.created_at,
        is_custom: true // All loaded from database are considered custom (editable)
      }));
      setTestTypes(mappedTestTypes);

      // Load priority definitions from database API only
      const prioritiesResponse = await api.get('/priority-definitions/');
      const prioritiesData = prioritiesResponse.data;
      const mappedPriorities = prioritiesData.map((priority: any) => ({
        id: priority.id.toString(),
        name: priority.name,
        value: priority.value,
        color: priority.color,
        description: priority.description || `${priority.name} priority issues`,
        is_default: priority.is_default,
        is_active: priority.is_active,
        created_at: priority.created_at,
        is_custom: true // All loaded from database are considered custom (editable)
      }));
      setPriorities(mappedPriorities);

      // Load shared step templates from API
      try {
        const templatesData = await testManagementAPI.getSharedStepTemplates();
        setSharedStepTemplates(templatesData.map((template: any) => ({
          id: template.id.toString(),
          name: template.name,
          description: template.description || '',
          category: template.category,
          tags: template.tags || [],
          complexity: template.complexity,
          estimated_time: template.estimated_time,
          prerequisites: template.prerequisites || [],
          related_steps: template.related_steps || [],
          usage_count: template.usage_count || 0,
          is_active: template.is_active,
          created_at: template.created_at
        })));
      } catch (error) {
        console.log('Shared step templates not available, will show empty state');
      }

      // Load settings (these will be fetched when needed)
      try {
        const [executionSettings, notificationSettings, automationSettings, userNotificationPrefs] = await Promise.all([
          testManagementAPI.getTestExecutionSettings(),
          testManagementAPI.getNotificationSettings(),
          testManagementAPI.getAutomationSettings(),
          testManagementAPI.getUserNotificationPreferences()
        ]);
        
        if (executionSettings) setTestExecutionSettings(executionSettings);
        if (notificationSettings) setNotificationSettings(notificationSettings);
        if (automationSettings) setAutomationSettings(automationSettings);
        if (userNotificationPrefs) setUserNotificationPrefs(userNotificationPrefs);
      } catch (error) {
        console.log('Settings not yet created, will use defaults');
      }
      
      console.log('Test management settings loaded successfully from API');
    } catch (error) {
      console.error('Failed to load test management settings:', error);
      setTestManagementError('Failed to load test management settings. Please check your connection and authentication.');
    } finally {
      setLoadingTestManagement(false);
    }
  };

  // Helper functions for default colors and icons
  const getDefaultTestTypeColor = (value: string): string => {
    const colors: Record<string, string> = {
      manual: '#3B82F6',
      automated: '#10B981',
      smoke: '#F59E0B',
      regression: '#EF4444',
      integration: '#8B5CF6',
      security: '#6366F1',
      performance: '#EC4899',
      usability: '#14B8A6'
    };
    return colors[value] || '#6B7280';
  };

  const getDefaultTestTypeIcon = (value: string): string => {
    const icons: Record<string, string> = {
      manual: '🖱️',
      automated: '🤖',
      smoke: '💨',
      regression: '🔄',
      integration: '🔗',
      security: '🔒',
      performance: '⚡',
      usability: '👥'
    };
    return icons[value] || '📋';
  };

  const getDefaultPriorityColor = (value: string): string => {
    const colors: Record<string, string> = {
      low: '#10B981',
      medium: '#F59E0B',
      high: '#F97316',
      critical: '#DC2626'
    };
    return colors[value] || '#6B7280';
  };

  const getPriorityValue = (value: string): number => {
    const values: Record<string, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4
    };
    return values[value] || 2;
  };

  const loadIntegrations = async () => {
    if (!selectedProjectId) return;
    
    setLoadingIntegrations(true);
    try {
      const data = await defectManagementAPI.getIssueTrackerIntegrations(selectedProjectId);
      setIntegrations(data);
    } catch (error) {
      console.error('Failed to load integrations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load integrations',
        variant: 'destructive',
      });
    } finally {
      setLoadingIntegrations(false);
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
    setValidationErrors({});
    setTouchedFields({});
    setIsIntegrationFormOpen(true);
  };

  const handleEditIntegration = (integration: IssueTrackerIntegration) => {
    setEditingIntegration(integration);
    setIntegrationForm({
      name: integration.name,
      tracker_type: integration.tracker_type,
      api_url: integration.api_url,
      api_token: '',
      username: integration.username || '',
      project_key: integration.project_key || '',
      sync_direction: integration.sync_direction,
      is_active: integration.is_active
    });
    setValidationErrors({});
    setTouchedFields({});
    setIsIntegrationFormOpen(true);
  };

  const handleSaveIntegration = async () => {
    if (!selectedProjectId) return;
    
    // Mark all fields as touched
    setTouchedFields({
      name: true,
      api_url: true,
      api_token: true,
      project_key: true,
    });

    // Validate form
    const errors: Record<string, string> = {};
    
    // Name validation
    if (!integrationForm.name.trim()) {
      errors.name = 'Integration name is required';
    } else if (integrationForm.name.length < 3) {
      errors.name = 'Integration name must be at least 3 characters';
    } else if (integrationForm.name.length > 100) {
      errors.name = 'Integration name must be less than 100 characters';
    }

    // API URL validation
    if (!integrationForm.api_url.trim()) {
      errors.api_url = 'API URL is required';
    } else {
      try {
        const url = new URL(integrationForm.api_url);
        if (!['http:', 'https:'].includes(url.protocol)) {
          errors.api_url = 'API URL must use HTTP or HTTPS protocol';
        }
      } catch {
        errors.api_url = 'API URL must be a valid URL';
      }
    }

    // API Token validation (required for new integrations, optional for edits)
    if (!editingIntegration && !integrationForm.api_token.trim()) {
      errors.api_token = 'API token is required';
    } else if (integrationForm.api_token && integrationForm.api_token.length < 8) {
      errors.api_token = 'API token must be at least 8 characters';
    }

    // Project Key validation (required for Jira, GitHub, GitLab)
    if (['jira', 'github', 'gitlab'].includes(integrationForm.tracker_type)) {
      if (!integrationForm.project_key.trim()) {
        errors.project_key = 'Project key/namespace is required';
      } else if (integrationForm.project_key.length < 2) {
        errors.project_key = 'Project key must be at least 2 characters';
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      
      // Focus on the first field with an error
      if (errors.name) {
        nameInputRef.current?.focus();
      } else if (errors.api_url) {
        apiUrlInputRef.current?.focus();
      } else if (errors.api_token) {
        tokenInputRef.current?.focus();
      } else if (errors.project_key) {
        projectKeyInputRef.current?.focus();
      }

      toast({
        title: 'Validation Error',
        description: 'Please fix the errors before saving',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingIntegration) {
        await defectManagementAPI.updateIssueTrackerIntegration(
          selectedProjectId,
          editingIntegration.id,
          integrationForm
        );
        toast({
          title: 'Success',
          description: 'Integration updated successfully',
        });
      } else {
        await defectManagementAPI.createIssueTrackerIntegration(
          selectedProjectId,
          integrationForm
        );
        toast({
          title: 'Success',
          description: 'Integration created successfully',
        });
      }
      setIsIntegrationFormOpen(false);
      setValidationErrors({});
      setTouchedFields({});
      loadIntegrations();
    } catch (error) {
      console.error('Failed to save integration:', error);
      toast({
        title: 'Error',
        description: 'Failed to save integration',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteIntegration = async (integrationId: number) => {
    if (!selectedProjectId) return;
    
    if (!confirm('Are you sure you want to delete this integration?')) return;

    try {
      await defectManagementAPI.deleteIssueTrackerIntegration(selectedProjectId, integrationId);
      toast({
        title: 'Success',
        description: 'Integration deleted successfully',
      });
      loadIntegrations();
    } catch (error) {
      console.error('Failed to delete integration:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete integration',
        variant: 'destructive',
      });
    }
  };

  const handleTestConnection = async (integrationId: number) => {
    if (!selectedProjectId) return;
    
    setIsTestingConnection(true);
    try {
      const result = await defectManagementAPI.testIssueTrackerConnection(selectedProjectId, integrationId);
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Connection test passed',
        });
      } else {
        toast({
          title: 'Connection Failed',
          description: result.message || 'Connection test failed',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      toast({
        title: 'Error',
        description: 'Connection test failed',
        variant: 'destructive',
      });
    } finally {
      setIsTestingConnection(false);
    }
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

  const handleSaveSystemConfiguration = async () => {
    // Validate session_timeout
    if (sessionTimeout < 1 || sessionTimeout > 1440) {
      toast({
        title: 'Validation Error',
        description: 'Session timeout must be between 1 and 1440 minutes',
        variant: 'destructive',
      });
      return;
    }

    // Validate password_complexity
    if (!['low', 'medium', 'high'].includes(passwordComplexity)) {
      toast({
        title: 'Validation Error',
        description: 'Password complexity must be low, medium, or high',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      // Save all system settings to API
      const results = await Promise.allSettled([
        systemSettingsAPI.updateSetting('maintenance_mode', maintenanceMode.toString(), 'Enable/disable maintenance mode'),
        systemSettingsAPI.updateSetting('signup_enabled', newUserRegistration.toString(), 'Enable/disable public user registration'),
        systemSettingsAPI.updateSetting('debug_logging', debugLogging.toString(), 'Enable detailed logging for troubleshooting'),
        systemSettingsAPI.updateSetting('session_timeout', sessionTimeout.toString(), 'Session timeout in minutes'),
        systemSettingsAPI.updateSetting('password_complexity', passwordComplexity, 'Password complexity requirement (low, medium, high)'),
      ]);

      // Check for any failed updates
      const failedUpdates = results.filter(r => r.status === 'rejected');
      if (failedUpdates.length > 0) {
        console.error('Some settings failed to save:', failedUpdates);
        toast({
          title: 'Partial Success',
          description: `${failedUpdates.length} setting(s) failed to save. Please try again.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: t('success'),
          description: 'System configuration saved successfully!',
        });
      }
    } catch (error) {
      console.error('Failed to save system configuration:', error);
      toast({
        title: t('error'),
        description: 'Failed to save system configuration',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClearSystemCache = async () => {
    try {
      // Simulate API call to clear cache
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('System cache cleared');
      alert('System cache cleared successfully!');
    } catch (error) {
      console.error('Failed to clear system cache:', error);
      alert('Failed to clear system cache');
    }
  };

  const handleAddTestType = async (typeName: string, typeDescription: string, typeColor: string) => {
    try {
      // Simulate API call to add test type
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('Adding test type:', { name: typeName, description: typeDescription, color: typeColor });
      alert('Test type added successfully!');
    } catch (error) {
      console.error('Failed to add test type:', error);
      alert('Failed to add test type');
    }
  };

  // Test Management Handlers
  const handleCreateTestType = async () => {
    if (isEditMode) {
      handleUpdateTestType();
      return;
    }
    
    try {
      setIsCreating(true);
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Authentication required. Please log in again.');
        return;
      }

      const response = await api.post('/test-type-definitions/', {
        name: testTypeForm.name,
        description: testTypeForm.description,
        color: testTypeForm.color,
        icon: testTypeForm.icon,
        created_by: user?.id || 1
      });
      const newTestType = response.data;
        const mappedTestType = {
          id: newTestType.id.toString(),
          name: newTestType.name,
          description: newTestType.description,
          color: newTestType.color,
          icon: newTestType.icon,
          is_active: newTestType.is_active,
          usage_count: newTestType.usage_count,
          created_at: newTestType.created_at,
          is_custom: true
        };
        
        setTestTypes([...testTypes, mappedTestType]);
        setTestTypeForm({ name: '', description: '', color: '#3B82F6', icon: '🖱️' });
        setHasUnsavedChanges(false);
        setTestTypeDialogOpen(false);
        toast({
          title: 'Success',
          description: 'Test type created successfully!',
          variant: 'success',
        });
    } catch (error: any) {
      console.error('Failed to create test type:', error);
      alert(`Failed to create test type: ${error.response?.data?.detail || error.message || 'Unknown error'}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreatePriority = async () => {
    if (isEditMode) {
      handleUpdatePriority();
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Authentication required. Please log in again.');
        return;
      }

      const response = await api.post('/priority-definitions/', {
        name: priorityForm.name,
        value: priorityForm.value,
        color: priorityForm.color,
        description: priorityForm.description,
        is_default: priorityForm.is_default,
        created_by: user?.id || 1
      });
      const newPriority = response.data;
        const mappedPriority = {
          id: newPriority.id.toString(),
          name: newPriority.name,
          value: newPriority.value,
          color: newPriority.color,
          description: newPriority.description,
          is_default: newPriority.is_default,
          is_active: newPriority.is_active,
          created_at: newPriority.created_at,
          is_custom: true
        };
        
        // If this is set as default, remove default from others
        if (priorityForm.is_default) {
          setPriorities(priorities.map(p => ({ ...p, is_default: false })));
        }
        
        setPriorities([...priorities, mappedPriority]);
        setPriorityForm({ name: '', value: 2, color: '#F59E0B', description: '', is_default: false });
        setPriorityDialogOpen(false);
        toast({
          title: 'Success',
          description: 'Priority created successfully!',
          variant: 'success',
        });
    } catch (error: any) {
      console.error('Failed to create priority:', error);
      alert(`Failed to create priority: ${error.response?.data?.detail || error.message || 'Unknown error'}`);
    }
  };

  const handleCreateSharedStep = async () => {
    if (isEditMode) {
      handleUpdateSharedStep();
      return;
    }
    
    try {
      const currentUser = useAuthStore.getState().user;
      const newSharedStep = await testManagementAPI.createSharedStepTemplate({
        name: sharedStepForm.name,
        description: sharedStepForm.description,
        category: sharedStepForm.category,
        tags: sharedStepForm.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        complexity: sharedStepForm.complexity,
        estimated_time: sharedStepForm.estimated_time,
        prerequisites: sharedStepForm.prerequisites.split(',').map(prereq => prereq.trim()).filter(prereq => prereq),
        related_steps: sharedStepForm.related_steps.split(',').map(step => step.trim()).filter(step => step),
        created_by: currentUser?.id || 1
      });
      
      setSharedStepTemplates([...sharedStepTemplates, {
        id: newSharedStep.id.toString(),
        name: newSharedStep.name,
        description: newSharedStep.description,
        category: newSharedStep.category,
        tags: newSharedStep.tags,
        complexity: newSharedStep.complexity,
        estimated_time: newSharedStep.estimated_time,
        prerequisites: newSharedStep.prerequisites,
        related_steps: newSharedStep.related_steps,
        usage_count: newSharedStep.usage_count || 0,
        is_active: newSharedStep.is_active,
        created_at: newSharedStep.created_at
      }]);
      
      setSharedStepForm({ 
        name: '', 
        description: '', 
        category: 'setup', 
        tags: '', 
        complexity: 'simple', 
        estimated_time: 1,
        prerequisites: '',
        related_steps: ''
      });
      setSharedStepDialogOpen(false);
      toast({
        title: 'Success',
        description: 'Shared step template created successfully!',
        variant: 'success',
      });
    } catch (error) {
      console.error('Failed to create shared step template:', error);
      alert('Failed to create shared step template. Please check console for details.');
    }
  };

  const handleEditTestType = (type: TestType) => {
    setEditingTestType(type);
    setTestTypeForm({
      name: type.name,
      description: type.description,
      color: type.color,
      icon: type.icon
    });
    setIsEditMode(true);
    setTestTypeDialogOpen(true);
  };

  const handleDuplicateTestType = (type: TestType) => {
    setEditingTestType(null);
    setTestTypeForm({
      name: `${type.name} (Copy)`,
      description: type.description,
      color: type.color,
      icon: type.icon
    });
    setIsEditMode(false);
    setTestTypeDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deleteType === 'testType' && testTypeToDelete) {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          alert('Authentication required. Please log in again.');
          return;
        }

        await api.delete(`/test-type-definitions/${testTypeToDelete}`);
          setTestTypes(testTypes.map(type => 
            type.id === testTypeToDelete ? { ...type, is_active: false } : type
          ));
      } catch (error: any) {
        console.error('Failed to delete test type:', error);
        alert(`Failed to delete test type: ${error.response?.data?.detail || error.message || 'Unknown error'}`);
      }
    } else if (deleteType === 'priority' && priorityToDelete) {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          alert('Authentication required. Please log in again.');
          return;
        }

        await api.delete(`/priority-definitions/${priorityToDelete}`);
          setPriorities(priorities.map(priority => 
            priority.id === priorityToDelete ? { ...priority, is_active: false } : priority
          ));
      } catch (error: any) {
        console.error('Failed to delete priority:', error);
        alert(`Failed to delete priority: ${error.response?.data?.detail || error.message || 'Unknown error'}`);
      }
    } else if (deleteType === 'sharedStep' && sharedStepToDelete) {
      try {
        await testManagementAPI.deleteSharedStepTemplate(parseInt(sharedStepToDelete));
        setSharedStepTemplates(sharedStepTemplates.map(step => 
          step.id === sharedStepToDelete ? { ...step, is_active: false } : step
        ));
      } catch (error) {
        console.error('Failed to delete shared step template:', error);
        alert('Failed to delete shared step template. Please check console for details.');
      }
    }
    
    setDeleteConfirmOpen(false);
    setDeleteType(null);
    setTestTypeToDelete(null);
    setPriorityToDelete(null);
    setSharedStepToDelete(null);
  };

  const handleDeleteTestType = (id: string) => {
    setTestTypeToDelete(id);
    setDeleteType('testType');
    setDeleteConfirmOpen(true);
  };

  const handleUpdateTestType = async () => {
    if (!editingTestType) return;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Authentication required. Please log in again.');
        return;
      }

      const response = await api.put(`/test-type-definitions/${editingTestType.id}`, {
        name: testTypeForm.name,
        description: testTypeForm.description,
        color: testTypeForm.color,
        icon: testTypeForm.icon
      });
      const updatedTestType = response.data;
        setTestTypes(testTypes.map(type => 
          type.id === editingTestType.id ? {
            ...type,
            name: updatedTestType.name,
            description: updatedTestType.description,
            color: updatedTestType.color,
            icon: updatedTestType.icon
          } : type
        ));
        setTestTypeForm({ name: '', description: '', color: '#3B82F6', icon: '🖱️' });
        setEditingTestType(null);
        setIsEditMode(false);
        setTestTypeDialogOpen(false);
        toast({
          title: 'Success',
          description: 'Test type updated successfully!',
          variant: 'success',
        });
    } catch (error: any) {
      console.error('Failed to update test type:', error);
      alert(`Failed to update test type: ${error.response?.data?.detail || error.message || 'Unknown error'}`);
    }
  };

  const handleEditPriority = (priority: Priority) => {
    setEditingPriority(priority);
    setPriorityForm({
      name: priority.name,
      value: priority.value,
      color: priority.color,
      description: priority.description,
      is_default: priority.is_default
    });
    setIsEditMode(true);
    setPriorityDialogOpen(true);
  };

  const handleDuplicatePriority = (priority: Priority) => {
    const existingValues = priorities.map(p => p.value);
    let newValue = priority.value;
    
    // Find a lower available value
    while (existingValues.includes(newValue) && newValue > 1) {
      newValue--;
    }
    
    // If no lower value available, try higher values
    if (existingValues.includes(newValue)) {
      newValue = priority.value + 1;
      while (existingValues.includes(newValue) && newValue < 10) {
        newValue++;
      }
    }
    
    // If all values 1-10 are taken, show error
    if (existingValues.includes(newValue)) {
      toast({
        title: 'Error',
        description: 'Cannot duplicate priority: all priority values (1-10) are already in use.',
        variant: 'destructive',
      });
      return;
    }
    
    setEditingPriority(null);
    setPriorityForm({
      name: `${priority.name} (Copy)`,
      value: newValue,
      color: priority.color,
      description: priority.description,
      is_default: false
    });
    setIsEditMode(false);
    setPriorityDialogOpen(true);
  };

  const handleDeletePriority = (id: string) => {
    setPriorityToDelete(id);
    setDeleteType('priority');
    setDeleteConfirmOpen(true);
  };

  const handleUpdatePriority = async () => {
    if (!editingPriority) return;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Authentication required. Please log in again.');
        return;
      }

      const response = await api.put(`/priority-definitions/${editingPriority.id}`, {
        name: priorityForm.name,
        value: priorityForm.value,
        color: priorityForm.color,
        description: priorityForm.description,
        is_default: priorityForm.is_default
      });
      const updatedPriority = response.data;
        setPriorities(priorities.map(priority => 
          priority.id === editingPriority.id ? {
            ...priority,
            name: updatedPriority.name,
            value: updatedPriority.value,
            color: updatedPriority.color,
            description: updatedPriority.description,
            is_default: updatedPriority.is_default
          } : priority
        ));
        setPriorityForm({ name: '', value: 2, color: '#F59E0B', description: '', is_default: false });
        setEditingPriority(null);
        setIsEditMode(false);
        setPriorityDialogOpen(false);
        toast({
          title: 'Success',
          description: 'Priority updated successfully!',
          variant: 'success',
        });
    } catch (error: any) {
      console.error('Failed to update priority:', error);
      alert(`Failed to update priority: ${error.response?.data?.detail || error.message || 'Unknown error'}`);
    }
  };

  const handleEditSharedStep = (step: SharedStepTemplate) => {
    setEditingSharedStep(step);
    setSharedStepForm({
      name: step.name,
      description: step.description,
      category: step.category,
      tags: step.tags.join(', '),
      complexity: step.complexity,
      estimated_time: step.estimated_time,
      prerequisites: step.prerequisites.join(', '),
      related_steps: step.related_steps.join(', ')
    });
    setIsEditMode(true);
    setSharedStepDialogOpen(true);
  };

  const handleDuplicateSharedStep = (step: SharedStepTemplate) => {
    setEditingSharedStep(null);
    setSharedStepForm({
      name: `${step.name} (Copy)`,
      description: step.description,
      category: step.category,
      tags: step.tags.join(', '),
      complexity: step.complexity,
      estimated_time: step.estimated_time,
      prerequisites: step.prerequisites.join(', '),
      related_steps: step.related_steps.join(', ')
    });
    setIsEditMode(false);
    setSharedStepDialogOpen(true);
  };

  const handleDeleteSharedStep = (id: string) => {
    setSharedStepToDelete(id);
    setDeleteType('sharedStep');
    setDeleteConfirmOpen(true);
  };

  const handleUpdateSharedStep = async () => {
    if (!editingSharedStep) return;
    
    try {
      const currentUser = useAuthStore.getState().user;
      const updatedStep = await testManagementAPI.updateSharedStepTemplate(parseInt(editingSharedStep.id), {
        name: sharedStepForm.name,
        description: sharedStepForm.description,
        category: sharedStepForm.category,
        tags: sharedStepForm.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        complexity: sharedStepForm.complexity,
        estimated_time: sharedStepForm.estimated_time,
        prerequisites: sharedStepForm.prerequisites.split(',').map(prereq => prereq.trim()).filter(prereq => prereq),
        related_steps: sharedStepForm.related_steps.split(',').map(step => step.trim()).filter(step => step)
      });
      
      setSharedStepTemplates(sharedStepTemplates.map(step => 
        step.id === editingSharedStep.id ? {
          ...step,
          name: updatedStep.name,
          description: updatedStep.description,
          category: updatedStep.category,
          tags: updatedStep.tags,
          complexity: updatedStep.complexity,
          estimated_time: updatedStep.estimated_time,
          prerequisites: updatedStep.prerequisites,
          related_steps: updatedStep.related_steps
        } : step
      ));
      
      setSharedStepForm({ 
        name: '', 
        description: '', 
        category: 'setup', 
        tags: '', 
        complexity: 'simple', 
        estimated_time: 1,
        prerequisites: '',
        related_steps: ''
      });
      setEditingSharedStep(null);
      setIsEditMode(false);
      setSharedStepDialogOpen(false);
      toast({
        title: 'Success',
        description: 'Shared step template updated successfully!',
        variant: 'success',
      });
    } catch (error) {
      console.error('Failed to update shared step template:', error);
      alert('Failed to update shared step template. Please check console for details.');
    }
  };

  const handleSaveTestManagementSettings = async () => {
    setSaving(true);
    try {
      // Save all settings in parallel
      const promises = [];
      
      // Only save settings that have been loaded from API (have IDs)
      if (testExecutionSettings && 'id' in testExecutionSettings) {
        promises.push(testManagementAPI.updateTestExecutionSettings(testExecutionSettings.id, testExecutionSettings));
      }
      
      if (notificationSettings && 'id' in notificationSettings) {
        promises.push(testManagementAPI.updateNotificationSettings(notificationSettings.id, notificationSettings));
      }
      
      // Save user notification preferences
      promises.push(testManagementAPI.updateUserNotificationPreferences(userNotificationPrefs));
      
      if (automationSettings && 'id' in automationSettings) {
        promises.push(testManagementAPI.updateAutomationSettings(automationSettings.id, automationSettings));
      }
      
      await Promise.all(promises);
      
      console.log('Test management settings saved successfully!');
      alert('Test management settings saved successfully!');
    } catch (error) {
      console.error('Failed to save test management settings:', error);
      alert('Failed to save test management settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('manageSettings')}</h1>
          <p className="text-gray-600 dark:text-gray-400">{t('manageSettings')}</p>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="inline-flex h-12 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground w-full">
          <TabsTrigger value="general" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <Globe className="h-4 w-4 mr-2" />
            {t('general')}
          </TabsTrigger>
          <TabsTrigger value="test-management" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <FileText className="h-4 w-4 mr-2" />
            {t('testManagement')}
          </TabsTrigger>
          <TabsTrigger value="integrations" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <Link className="h-4 w-4 mr-2" />
            {t('integrations')}
          </TabsTrigger>
          <TabsTrigger value="users" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <Users className="h-4 w-4 mr-2" />
            {t('users')}
          </TabsTrigger>
          {isAdminUser(user) && (
            <TabsTrigger value="system" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <SettingsIcon className="h-4 w-4 mr-2" />
              {t('system')}
            </TabsTrigger>
          )}
          {isAdminUser(user) && (
            <TabsTrigger value="audit" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <History className="h-4 w-4 mr-2" />
              {t('auditTrails')}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader className="border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">{t('compactMode')}</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('compactModeDesc')}</p>
                </div>
                <Switch checked={compactMode} onCheckedChange={setCompactMode} />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">{t('language')}</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Select your preferred language</p>
                </div>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fa">فارسی</SelectItem>
                    <SelectItem value="ar">العربية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <p>General settings have been updated successfully.</p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button className="px-8" onClick={handleSaveSystemConfiguration} disabled={saving}>
              {saving ? 'Saving...' : t('saveChanges')}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="test-management" className="space-y-6">
          {/* Test Types Management */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                    <Tag className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100">Test Types Management</CardTitle>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Define and manage test case categories</p>
                  </div>
                </div>
                <Dialog open={testTypeDialogOpen} onOpenChange={(open) => handleDialogClose('testType', open)}>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Test Type
                    </Button>
                  </DialogTrigger>
                  <DialogContent isRTL={isRTL} className="sm:max-w-[580px]" onKeyDown={(e) => handleKeyDown(e, handleCreateTestType)}>
                    <DialogHeader className="pb-4">
                      <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100">{isEditMode ? 'Edit Test Type' : 'Create New Test Type'}</DialogTitle>
                      <DialogDescription className="text-gray-600">
                        {isEditMode ? 'Update the test type details' : 'Add a new test type to categorize your test cases'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-6">
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <Label htmlFor="test-type-name" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Name</Label>
                          <Input
                            ref={testTypeNameInputRef}
                            id="test-type-name"
                            value={testTypeForm.name}
                            onChange={(e) => setTestTypeForm({...testTypeForm, name: e.target.value})}
                            placeholder="e.g., Performance"
                            className={testTypeForm.name.trim() === '' ? 'h-11 rounded-lg border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20' : 'h-11 rounded-lg border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'}
                            maxLength={100}
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>Name of the test type</span>
                            <span>{testTypeForm.name.length}/100</span>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="test-type-description" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Description</Label>
                          <Textarea
                            id="test-type-description"
                            value={testTypeForm.description}
                            onChange={(e) => setTestTypeForm({...testTypeForm, description: e.target.value})}
                            placeholder="Describe the test type purpose and when to use it"
                            rows={3}
                            className="rounded-lg border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none"
                            maxLength={500}
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>Description of the test type</span>
                            <span>{testTypeForm.description.length}/500</span>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="test-type-color" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Color</Label>
                          <div className="flex items-center space-x-3">
                            <Input
                              id="test-type-color"
                              type="color"
                              value={testTypeForm.color}
                              onChange={(e) => setTestTypeForm({...testTypeForm, color: e.target.value})}
                              className="h-11 w-20 rounded-lg border-gray-200 cursor-pointer"
                            />
                            <div className="flex-1">
                              <div className="h-11 rounded-lg border border-gray-200 flex items-center px-3 bg-gray-50">
                                <span className="text-sm font-mono text-gray-600 dark:text-gray-400">{testTypeForm.color}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="test-type-icon" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Icon</Label>
                          <Input
                            id="test-type-icon"
                            value={testTypeForm.icon}
                            onChange={(e) => setTestTypeForm({...testTypeForm, icon: e.target.value})}
                            placeholder="🚀"
                            className="h-11 rounded-lg border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter className="pt-4 border-t flex-col sm:flex-row gap-2">
                      <div className="text-xs text-gray-500 mb-2 sm:mb-0 sm:mr-auto">
                        {t('toSubmit')}
                      </div>
                      <Button variant="outline" onClick={() => handleDialogClose('testType', false)} className="px-6 py-2 rounded-lg">
                        Cancel
                      </Button>
                      <Button onClick={handleCreateTestType} disabled={!testTypeForm.name.trim() || isCreating} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-all duration-200">
                        {isCreating ? 'Creating...' : (isEditMode ? 'Update Test Type' : 'Create Test Type')}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Delete Confirmation Dialog */}
                <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                  <AlertDialogContent isRTL={isRTL}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {deleteType === 'testType' && 'Are you sure you want to delete this test type?'}
                        {deleteType === 'priority' && 'Are you sure you want to delete this priority?'}
                        {deleteType === 'sharedStep' && 'Are you sure you want to delete this shared step template?'}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {deleteType === 'testType' && 'This action cannot be undone. The test type will be permanently removed from the system.'}
                        {deleteType === 'priority' && 'This action cannot be undone. The priority level will be permanently removed from the system.'}
                        {deleteType === 'sharedStep' && 'This action cannot be undone. The shared step template will be permanently removed from the system.'}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {loadingTestManagement ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600 dark:text-gray-400">Loading test types...</span>
                </div>
              ) : testManagementError ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="h-12 w-12 text-red-500 mb-3" />
                  <p className="text-red-600 text-center mb-4">{testManagementError}</p>
                  <Button onClick={loadTestManagementSettings} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                    Retry
                  </Button>
                </div>
              ) : testTypes.filter(type => type.is_active).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Layers className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-3" />
                  <p className="text-gray-600 dark:text-gray-400 text-center mb-4">No test types found. Create your first test type to get started.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {testTypes.filter(type => type.is_active).map((type) => (
                    <div key={type.id} className="group relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:shadow-lg transition-all duration-200 hover:border-blue-300 dark:hover:border-blue-500">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl shadow-sm" style={{ backgroundColor: type.color }}>
                        {type.icon}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-lg border-gray-200 shadow-lg">
                          <DropdownMenuItem onClick={() => handleEditTestType(type)} className="rounded-lg">
                            <Edit className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                            <span>Edit</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicateTestType(type)} className="rounded-lg">
                            <Copy className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                            <span>Duplicate</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDeleteTestType(type.id)} className="rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="h-4 w-4 mr-2" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">{type.name}</h4>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">{type.description || 'No description provided'}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                            <div className="w-2 h-2 rounded-full bg-green-400 mr-1.5"></div>
                            <span>Active</span>
                          </div>
                          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                            <span className="font-medium">{type.usage_count}</span>
                            <span className="ml-1">uses</span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          {new Date(type.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Priorities Management */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100">Priorities Management</CardTitle>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Define priority levels for test cases and defects</p>
                  </div>
                </div>
                <Dialog open={priorityDialogOpen} onOpenChange={setPriorityDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Priority
                    </Button>
                  </DialogTrigger>
                  <DialogContent isRTL={isRTL} className="sm:max-w-[500px]">
                    <DialogHeader className="pb-4">
                      <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100">{isEditMode ? 'Edit Priority Level' : 'Create New Priority Level'}</DialogTitle>
                      <DialogDescription className="text-gray-600">
                        {isEditMode ? 'Update the priority level details' : 'Add a new priority level to classify test case importance'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="priority-name" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Name</Label>
                          <Input
                            id="priority-name"
                            value={priorityForm.name}
                            onChange={(e) => setPriorityForm({...priorityForm, name: e.target.value})}
                            placeholder="e.g., Urgent"
                            className="h-10 rounded-lg border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                          />
                        </div>
                        <div>
                          <Label htmlFor="priority-value" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Value (1-10)</Label>
                          <Input
                            id="priority-value"
                            type="number"
                            min="1"
                            max="10"
                            value={priorityForm.value}
                            onChange={(e) => setPriorityForm({...priorityForm, value: parseInt(e.target.value)})}
                            className="h-10 rounded-lg border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="priority-description" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Description</Label>
                        <Textarea
                          id="priority-description"
                          value={priorityForm.description}
                          onChange={(e) => setPriorityForm({...priorityForm, description: e.target.value})}
                          placeholder="Describe when this priority should be used"
                          rows={2}
                          className="rounded-lg border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="priority-color" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Color</Label>
                          <div className="flex items-center space-x-2">
                            <Input
                              id="priority-color"
                              type="color"
                              value={priorityForm.color}
                              onChange={(e) => setPriorityForm({...priorityForm, color: e.target.value})}
                              className="h-10 w-16 rounded-lg border-gray-200 cursor-pointer"
                            />
                            <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">{priorityForm.color}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="priority-default"
                            checked={priorityForm.is_default}
                            onCheckedChange={(checked) => setPriorityForm({...priorityForm, is_default: checked})}
                            className="data-[state=checked]:bg-orange-600"
                          />
                          <Label htmlFor="priority-default" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">Default</Label>
                        </div>
                      </div>
                    </div>
                    <DialogFooter className="pt-4 border-t">
                      <Button variant="outline" onClick={() => {
                        setPriorityDialogOpen(false);
                        setEditingPriority(null);
                        setIsEditMode(false);
                        setPriorityForm({ name: '', value: 2, color: '#F59E0B', description: '', is_default: false });
                      }} className="px-6 py-2 rounded-lg">
                        Cancel
                      </Button>
                      <Button onClick={handleCreatePriority} disabled={!priorityForm.name.trim()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg">
                        {isEditMode ? 'Update Priority' : 'Create Priority'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {loadingTestManagement ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600 dark:text-gray-400">Loading priorities...</span>
                </div>
              ) : testManagementError ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="h-12 w-12 text-red-500 mb-3" />
                  <p className="text-red-600 text-center mb-4">{testManagementError}</p>
                  <Button onClick={loadTestManagementSettings} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                    Retry
                  </Button>
                </div>
              ) : priorities.filter(priority => priority.is_active).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-3" />
                  <p className="text-gray-600 dark:text-gray-400 text-center mb-4">No priorities found. Create your first priority level to get started.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {priorities.filter(priority => priority.is_active).sort((a, b) => b.value - a.value).map((priority) => (
                  <div key={priority.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: priority.color }}>
                        <span className="text-white font-bold text-xs">{priority.value}</span>
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100">{priority.name}</h4>
                          {priority.is_default && (
                            <Badge className="bg-orange-100 text-orange-800 border-orange-200 px-2 py-0.5 rounded-full text-xs font-medium">
                              Default
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{priority.description || 'No description provided'}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Value: {priority.value}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-gray-100">
                            <MoreHorizontal className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 rounded-lg border-gray-200 shadow-lg">
                          <DropdownMenuItem onClick={() => handleEditPriority(priority)} className="rounded-lg text-sm">
                            <Edit className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                            <span>Edit</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicatePriority(priority)} className="rounded-lg text-sm">
                            <Copy className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                            <span>Duplicate</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDeletePriority(priority.id)} className="rounded-lg text-sm text-red-600 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="h-4 w-4 mr-2" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shared Steps Templates */}
          <Card>
            <CardHeader className="border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <Layers className="h-5 w-5 text-purple-600" />
                  <CardTitle>Shared Steps Templates</CardTitle>
                </div>
                <Dialog open={sharedStepDialogOpen} onOpenChange={setSharedStepDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Template
                    </Button>
                  </DialogTrigger>
                  <DialogContent isRTL={isRTL} className="sm:max-w-[600px]">
                    <DialogHeader>
                      <DialogTitle>{isEditMode ? 'Edit Shared Step Template' : 'Add Shared Step Template'}</DialogTitle>
                      <DialogDescription>
                        {isEditMode ? 'Update the reusable step template for test cases.' : 'Create a reusable step template for test cases.'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="step-name" className="text-right">Name</Label>
                        <Input
                          id="step-name"
                          value={sharedStepForm.name}
                          onChange={(e) => setSharedStepForm({...sharedStepForm, name: e.target.value})}
                          className="col-span-3"
                          placeholder="e.g., User Login"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-start gap-4">
                        <Label htmlFor="step-description" className="text-right pt-2">Description</Label>
                        <Textarea
                          id="step-description"
                          value={sharedStepForm.description}
                          onChange={(e) => setSharedStepForm({...sharedStepForm, description: e.target.value})}
                          className="col-span-3"
                          placeholder="Describe the step template"
                          rows={2}
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="step-category" className="text-right">Category</Label>
                        <Select value={sharedStepForm.category} onValueChange={(value: any) => setSharedStepForm({...sharedStepForm, category: value})}>
                          <SelectTrigger className="col-span-3">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="authentication">Authentication</SelectItem>
                            <SelectItem value="database">Database</SelectItem>
                            <SelectItem value="api">API</SelectItem>
                            <SelectItem value="ui">UI</SelectItem>
                            <SelectItem value="setup">Setup</SelectItem>
                            <SelectItem value="cleanup">Cleanup</SelectItem>
                            <SelectItem value="validation">Validation</SelectItem>
                            <SelectItem value="reporting">Reporting</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="step-complexity" className="text-right">Complexity</Label>
                        <Select value={sharedStepForm.complexity} onValueChange={(value: any) => setSharedStepForm({...sharedStepForm, complexity: value})}>
                          <SelectTrigger className="col-span-3">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="simple">Simple</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="complex">Complex</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="step-time" className="text-right">Est. Time (min)</Label>
                        <Input
                          id="step-time"
                          type="number"
                          min="1"
                          value={sharedStepForm.estimated_time}
                          onChange={(e) => setSharedStepForm({...sharedStepForm, estimated_time: parseInt(e.target.value)})}
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="step-tags" className="text-right">Tags</Label>
                        <Input
                          id="step-tags"
                          value={sharedStepForm.tags}
                          onChange={(e) => setSharedStepForm({...sharedStepForm, tags: e.target.value})}
                          className="col-span-3"
                          placeholder="login, auth, user (comma separated)"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-start gap-4">
                        <Label htmlFor="step-prerequisites" className="text-right pt-2">Prerequisites</Label>
                        <Textarea
                          id="step-prerequisites"
                          value={sharedStepForm.prerequisites}
                          onChange={(e) => setSharedStepForm({...sharedStepForm, prerequisites: e.target.value})}
                          className="col-span-3"
                          placeholder="Valid user credentials, Database connection (comma separated)"
                          rows={2}
                        />
                      </div>
                      <div className="grid grid-cols-4 items-start gap-4">
                        <Label htmlFor="step-related" className="text-right pt-2">Related Steps</Label>
                        <Textarea
                          id="step-related"
                          value={sharedStepForm.related_steps}
                          onChange={(e) => setSharedStepForm({...sharedStepForm, related_steps: e.target.value})}
                          className="col-span-3"
                          placeholder="User Logout, Password Reset (comma separated)"
                          rows={2}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => {
                        setSharedStepDialogOpen(false);
                        setEditingSharedStep(null);
                        setIsEditMode(false);
                        setSharedStepForm({ 
                          name: '', 
                          description: '', 
                          category: 'setup' as SharedStepTemplate['category'], 
                          tags: '', 
                          complexity: 'simple' as SharedStepTemplate['complexity'], 
                          estimated_time: 1,
                          prerequisites: '',
                          related_steps: ''
                        });
                      }}>Cancel</Button>
                      <Button onClick={handleCreateSharedStep} disabled={!sharedStepForm.name.trim()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg">
                        {isEditMode ? 'Update Template' : 'Create Template'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {sharedStepTemplates.filter(step => step.is_active).map((step) => (
                  <div key={step.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-semibold">{step.name}</h4>
                        <Badge variant="outline">{step.category}</Badge>
                        <Badge variant={step.complexity === 'simple' ? 'default' : step.complexity === 'medium' ? 'secondary' : 'destructive'}>
                          {step.complexity}
                        </Badge>
                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                          <Clock className="h-3 w-3 mr-1" />
                          {step.estimated_time}min
                        </div>
                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Used {step.usage_count} times
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{step.description}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex flex-wrap gap-1">
                          {step.tags.map((tag, index) => (
                            <span key={index} className="bg-gray-100 px-2 py-1 rounded">{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="ml-4">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleEditSharedStep(step)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicateSharedStep(step)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDeleteSharedStep(step.id)} className="text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Test Execution Settings */}
          <Card>
            <CardHeader className="border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <Target className="h-5 w-5 text-green-600" />
                <CardTitle>Test Execution Settings</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Auto-save Interval</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Automatically save test progress (seconds)</p>
                    </div>
                    <Input
                      type="number"
                      min="10"
                      max="300"
                      value={testExecutionSettings.auto_save_interval}
                      onChange={(e) => setTestExecutionSettings({...testExecutionSettings, auto_save_interval: parseInt(e.target.value)})}
                      className="w-20"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Screenshot on Failure</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Capture screenshots when tests fail</p>
                    </div>
                    <Switch
                      checked={testExecutionSettings.screenshot_on_failure}
                      onCheckedChange={(checked) => setTestExecutionSettings({...testExecutionSettings, screenshot_on_failure: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Video Recording</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Record video during test execution</p>
                    </div>
                    <Switch
                      checked={testExecutionSettings.video_recording}
                      onCheckedChange={(checked) => setTestExecutionSettings({...testExecutionSettings, video_recording: checked})}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Step Timeout</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Maximum time per step (seconds)</p>
                    </div>
                    <Input
                      type="number"
                      min="30"
                      max="3600"
                      value={testExecutionSettings.step_timeout}
                      onChange={(e) => setTestExecutionSettings({...testExecutionSettings, step_timeout: parseInt(e.target.value)})}
                      className="w-20"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Retry Attempts</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Number of retry attempts on failure</p>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      max="5"
                      value={testExecutionSettings.retry_attempts}
                      onChange={(e) => setTestExecutionSettings({...testExecutionSettings, retry_attempts: parseInt(e.target.value)})}
                      className="w-20"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Parallel Execution</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Run multiple tests in parallel</p>
                    </div>
                    <Switch
                      checked={testExecutionSettings.parallel_execution}
                      onCheckedChange={(checked) => setTestExecutionSettings({...testExecutionSettings, parallel_execution: checked})}
                    />
                  </div>
                </div>
              </div>
              {testExecutionSettings.parallel_execution && (
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Max Parallel Threads</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Maximum number of parallel test threads</p>
                  </div>
                  <Input
                    type="number"
                    min="1"
                    max="16"
                    value={testExecutionSettings.max_parallel_threads}
                    onChange={(e) => setTestExecutionSettings({...testExecutionSettings, max_parallel_threads: parseInt(e.target.value)})}
                    className="w-20"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader className="border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <Zap className="h-5 w-5 text-yellow-600" />
                <CardTitle>Notification Settings</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Email Notifications</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Send notifications via email</p>
                    </div>
                    <Switch
                      checked={notificationSettings.email_notifications}
                      onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, email_notifications: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Slack Notifications</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Send notifications to Slack</p>
                    </div>
                    <Switch
                      checked={notificationSettings.slack_notifications}
                      onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, slack_notifications: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Test Failure Alerts</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Alert on test failures</p>
                    </div>
                    <Switch
                      checked={notificationSettings.test_failure_alerts}
                      onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, test_failure_alerts: checked})}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Test Completion Reports</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Send test completion summaries</p>
                    </div>
                    <Switch
                      checked={notificationSettings.test_completion_reports}
                      onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, test_completion_reports: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Weekly Summary</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Send weekly activity summaries</p>
                    </div>
                    <Switch
                      checked={notificationSettings.weekly_summary}
                      onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, weekly_summary: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Real-time Updates</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Real-time notification updates</p>
                    </div>
                    <Switch
                      checked={notificationSettings.real_time_updates}
                      onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, real_time_updates: checked})}
                    />
                  </div>
                </div>
              </div>
              
              {/* User Notification Preferences */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Personal Notification Preferences</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Do Not Disturb</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Pause all notifications</p>
                    </div>
                    <Switch
                      checked={userNotificationPrefs.do_not_disturb}
                      onCheckedChange={(checked) => setUserNotificationPrefs({...userNotificationPrefs, do_not_disturb: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Notification Sound</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Play sound for notifications</p>
                    </div>
                    <Switch
                      checked={userNotificationPrefs.notification_sound_enabled}
                      onCheckedChange={(checked) => setUserNotificationPrefs({...userNotificationPrefs, notification_sound_enabled: checked})}
                    />
                  </div>
                </div>
                {userNotificationPrefs.notifications_muted_until && (
                  <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      Notifications muted until: {new Date(userNotificationPrefs.notifications_muted_until).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Automation Settings */}
          <Card>
            <CardHeader className="border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <Cpu className="h-5 w-5 text-indigo-600" />
                <CardTitle>Automation & AI Settings</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">AI Suggestions</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Enable AI-powered suggestions</p>
                    </div>
                    <Switch
                      checked={automationSettings.ai_suggestions}
                      onCheckedChange={(checked) => setAutomationSettings({...automationSettings, ai_suggestions: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Smart Step Recommendations</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Suggest relevant steps during test creation</p>
                    </div>
                    <Switch
                      checked={automationSettings.smart_step_recommendations}
                      onCheckedChange={(checked) => setAutomationSettings({...automationSettings, smart_step_recommendations: checked})}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Auto Categorization</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Automatically categorize test cases</p>
                    </div>
                    <Switch
                      checked={automationSettings.auto_categorization}
                      onCheckedChange={(checked) => setAutomationSettings({...automationSettings, auto_categorization: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Duplicate Detection</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Detect duplicate test cases</p>
                    </div>
                    <Switch
                      checked={automationSettings.duplicate_detection}
                      onCheckedChange={(checked) => setAutomationSettings({...automationSettings, duplicate_detection: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Performance Optimization</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Optimize test execution performance</p>
                    </div>
                    <Switch
                      checked={automationSettings.performance_optimization}
                      onCheckedChange={(checked) => setAutomationSettings({...automationSettings, performance_optimization: checked})}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2 rounded-lg" onClick={handleSaveTestManagementSettings} disabled={saving}>
              {saving ? 'Saving...' : 'Save Test Management Settings'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader className="border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <Link className="h-5 w-5 text-blue-600" />
                  <CardTitle>Issue Tracker Integrations</CardTitle>
                </div>
                <Button onClick={handleAddIntegration} disabled={!selectedProjectId}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Integration
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <Label htmlFor="project-select">Select Project</Label>
                <Select
                  value={selectedProjectId?.toString()}
                  onValueChange={(value) => setSelectedProjectId(parseInt(value))}
                  disabled={loadingProjects}
                >
                  <SelectTrigger>
                    {loadingProjects ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading projects...</span>
                      </div>
                    ) : projects.length === 0 ? (
                      <span>No projects available</span>
                    ) : (
                      <SelectValue placeholder="Select a project" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!selectedProjectId ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <FolderTree className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-gray-500" />
                  <p>Select a project to view integrations</p>
                </div>
              ) : loadingIntegrations ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : integrations.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Link className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-gray-500" />
                  <p>No Integrations</p>
                  <p className="text-sm">Connect GitHub, GitLab, Jira, or other issue trackers to sync defects</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {integrations.map((integration) => (
                    <Card key={integration.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold">{integration.name}</h4>
                              {!integration.is_active && (
                                <Badge variant="outline" className="text-xs">Inactive</Badge>
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
                                Last sync: {new Date(integration.last_sync).toLocaleString()}
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
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Integration Form Dialog */}
          <Dialog open={isIntegrationFormOpen} onOpenChange={setIsIntegrationFormOpen}>
            <DialogContent isRTL={isRTL} className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingIntegration ? 'Edit Integration' : 'Add Integration'}
                </DialogTitle>
                <DialogDescription>
                  {editingIntegration 
                    ? 'Update the issue tracker integration configuration'
                    : 'Configure a new issue tracker integration (Jira, GitHub, GitLab, etc.)'
                  }
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="integration-name">Integration Name *</Label>
                    <Input
                      id="integration-name"
                      ref={nameInputRef}
                      placeholder={getPlaceholders().name}
                      value={integrationForm.name}
                      onChange={(e) => setIntegrationForm({...integrationForm, name: e.target.value})}
                      onBlur={() => setTouchedFields({...touchedFields, name: true})}
                      className={touchedFields.name && validationErrors.name ? 'border-red-500' : ''}
                    />
                    {touchedFields.name && validationErrors.name && (
                      <p className="text-xs text-red-600 dark:text-red-400">{validationErrors.name}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tracker-type">Tracker Type *</Label>
                    <Select
                      value={integrationForm.tracker_type}
                      onValueChange={(value) => {
                        setIntegrationForm({...integrationForm, tracker_type: value});
                        // Clear project key error when changing tracker type
                        if (value !== integrationForm.tracker_type) {
                          setValidationErrors({...validationErrors, project_key: ''});
                        }
                      }}
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
                  <Label htmlFor="api-url">API URL *</Label>
                  <Input
                    id="api-url"
                    ref={apiUrlInputRef}
                    placeholder={getPlaceholders().apiUrl}
                    value={integrationForm.api_url}
                    onChange={(e) => setIntegrationForm({...integrationForm, api_url: e.target.value})}
                    onBlur={() => setTouchedFields({...touchedFields, api_url: true})}
                    className={touchedFields.api_url && validationErrors.api_url ? 'border-red-500' : ''}
                  />
                  {touchedFields.api_url && validationErrors.api_url && (
                    <p className="text-xs text-red-600 dark:text-red-400">{validationErrors.api_url}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username / Email</Label>
                    <Input
                      id="username"
                      placeholder="your-email@example.com"
                      value={integrationForm.username}
                      onChange={(e) => setIntegrationForm({...integrationForm, username: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="api-token">API Token {(!editingIntegration) ? '*' : ''}</Label>
                    <Input
                      id="api-token"
                      ref={tokenInputRef}
                      type="password"
                      placeholder={editingIntegration ? 'Leave blank to keep existing' : 'Enter your API token'}
                      value={integrationForm.api_token}
                      onChange={(e) => setIntegrationForm({...integrationForm, api_token: e.target.value})}
                      onBlur={() => setTouchedFields({...touchedFields, api_token: true})}
                      className={touchedFields.api_token && validationErrors.api_token ? 'border-red-500' : ''}
                    />
                    {touchedFields.api_token && validationErrors.api_token && (
                      <p className="text-xs text-red-600 dark:text-red-400">{validationErrors.api_token}</p>
                    )}
                    <p className="text-xs text-gray-500">
                      Token will be encrypted and stored securely
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project-key">{getPlaceholders().projectKeyLabel} *</Label>
                  <Input
                    id="project-key"
                    ref={projectKeyInputRef}
                    placeholder={getPlaceholders().projectKey}
                    value={integrationForm.project_key}
                    onChange={(e) => setIntegrationForm({...integrationForm, project_key: e.target.value})}
                    onBlur={() => setTouchedFields({...touchedFields, project_key: true})}
                    className={touchedFields.project_key && validationErrors.project_key ? 'border-red-500' : ''}
                  />
                  {touchedFields.project_key && validationErrors.project_key && (
                    <p className="text-xs text-red-600 dark:text-red-400">{validationErrors.project_key}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    {getPlaceholders().projectKeyDesc}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sync-direction">Sync Direction</Label>
                  <Select
                    value={integrationForm.sync_direction}
                    onValueChange={(value) => setIntegrationForm({...integrationForm, sync_direction: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="import">Import Only (External → TestMona)</SelectItem>
                      <SelectItem value="export">Export Only (TestMona → External)</SelectItem>
                      <SelectItem value="bidirectional">Bidirectional (Both Ways)</SelectItem>
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
                  <Label htmlFor="is-active">Enable this integration</Label>
                </div>

                {editingIntegration && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <AlertCircle className="h-4 w-4 inline mr-2" />
                      Leave the API token blank to keep the existing token. Only enter a new token if you want to change it.
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsIntegrationFormOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveIntegration}>
                  {editingIntegration ? 'Update Integration' : 'Create Integration'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader className="border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <Users className="h-5 w-5 text-purple-600" />
                <CardTitle>User Management</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <UserManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader className="border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <SettingsIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <CardTitle>System Configuration</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Maintenance Mode</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Temporarily disable access to the application</p>
                  </div>
                  <Switch 
                    checked={maintenanceMode} 
                    onCheckedChange={async (checked) => {
                      setMaintenanceMode(checked);
                      try {
                        await systemSettingsAPI.updateSetting('maintenance_mode', checked.toString(), 'Enable/disable maintenance mode');
                        toast({
                          title: 'Success',
                          description: 'Maintenance mode updated',
                        });
                      } catch (error) {
                        toast({
                          title: 'Error',
                          description: 'Failed to update maintenance mode',
                          variant: 'destructive',
                        });
                        setMaintenanceMode(!checked); // Revert on error
                      }
                    }} 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">New User Registration</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Allow new users to register</p>
                  </div>
                  <Switch 
                    checked={newUserRegistration} 
                    onCheckedChange={async (checked) => {
                      setNewUserRegistration(checked);
                      try {
                        await systemSettingsAPI.updateSetting('signup_enabled', checked.toString(), 'Enable/disable public user registration');
                        toast({
                          title: 'Success',
                          description: 'User registration setting updated',
                        });
                      } catch (error) {
                        toast({
                          title: 'Error',
                          description: 'Failed to update user registration setting',
                          variant: 'destructive',
                        });
                        setNewUserRegistration(!checked); // Revert on error
                      }
                    }} 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Debug Logging</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Enable detailed logging for troubleshooting</p>
                  </div>
                  <Switch 
                    checked={debugLogging} 
                    onCheckedChange={async (checked) => {
                      setDebugLogging(checked);
                      try {
                        await systemSettingsAPI.updateSetting('debug_logging', checked.toString(), 'Enable detailed logging for troubleshooting');
                        toast({
                          title: 'Success',
                          description: 'Debug logging updated',
                        });
                      } catch (error) {
                        toast({
                          title: 'Error',
                          description: 'Failed to update debug logging',
                          variant: 'destructive',
                        });
                        setDebugLogging(!checked); // Revert on error
                      }
                    }} 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-6">
          <Card>
            <CardHeader className="border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <History className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <CardTitle>{t('auditTrailConfig')}</CardTitle>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetAuditTrailConfig}
                    disabled={savingAuditConfig || loadingAuditConfig}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {t('resetToDefaults')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveAuditTrailConfig}
                    disabled={savingAuditConfig || loadingAuditConfig}
                  >
                    {savingAuditConfig ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    {t('saveConfiguration')}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {loadingAuditConfig ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="space-y-0.5">
                      <Label className="text-base font-semibold">{t('enableAuditTrailsGlobally')}</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t('enableAuditTrailsGloballyDesc')}
                      </p>
                    </div>
                    <Switch
                      checked={auditTrailEnabled}
                      onCheckedChange={setAuditTrailEnabled}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">{t('entitySpecificSettings')}</Label>
                      <Badge variant={auditTrailEnabled ? "default" : "secondary"}>
                        {auditTrailEnabled ? t('auditStatusActive') : t('auditStatusDisabled')}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('entitySpecificSettingsDesc')}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {[
                        { key: 'user', label: t('auditEntityUser') },
                        { key: 'project', label: t('auditEntityProject') },
                        { key: 'test_case', label: t('auditEntityTestCase') },
                        { key: 'test_suite', label: t('auditEntityTestSuite') },
                        { key: 'test_run', label: t('auditEntityTestRun') },
                        { key: 'test_result', label: t('auditEntityTestResult') },
                        { key: 'test_plan', label: t('auditEntityTestPlan') },
                        { key: 'requirement', label: t('auditEntityRequirement') },
                        { key: 'defect', label: t('auditEntityDefect') },
                        { key: 'milestone', label: t('auditEntityMilestone') },
                        { key: 'custom_field', label: t('auditEntityCustomField') },
                        { key: 'system_setting', label: t('auditEntitySystemSetting') },
                      ].map((entity) => (
                        <div
                          key={entity.key}
                          className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                        >
                          <Label className="text-sm font-medium cursor-pointer">
                            {entity.label}
                          </Label>
                          <Switch
                            checked={auditEntitySettings[entity.key] !== false}
                            onCheckedChange={(checked) => handleEntityAuditToggle(entity.key, checked)}
                            disabled={!auditTrailEnabled}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {!auditTrailEnabled && (
                    <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                          {t('auditTrailsDisabled')}
                        </p>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">
                          {t('auditTrailsDisabledDesc')}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-2">
                      <div>
                        <p className="text-sm font-medium text-red-800 dark:text-red-200">
                          {t('deleteAllAuditTrails')}
                        </p>
                        <p className="text-sm text-red-700 dark:text-red-300">
                          {t('deleteAllAuditTrailsDesc')}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteAllAuditTrails}
                        disabled={savingAuditConfig}
                      >
                        {savingAuditConfig ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        {t('deleteAllAuditTrails')}
                      </Button>
                    </div>
                  </div>

                  <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('confirmDeleteAllAuditTrails')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteAllAuditTrails} className="bg-red-600 hover:bg-red-700">
                          {t('delete')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
