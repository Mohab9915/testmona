import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Plus, History, Loader2, Search, ChevronDown, ChevronRight, Folder, FileText, Calendar, User, Target } from 'lucide-react';
import { testRunsAPI, testCasesAPI, sectionsAPI, usersAPI, testSuitesAPI, testResultsAPI, environmentsAPI } from '@/lib/api';
import { TestRun, TestCase } from '@/types';
import { useTranslation } from '@/hooks/useTranslation';

// Define User interface locally since it's not in types
interface User {
  id: number;
  username: string;
  email: string;
  full_name?: string;
  role: string;
  is_active: boolean;
}

// Define Section interface to match backend TestCaseSection model
interface Section {
  id: number;
  name: string;
  description?: string;
  test_suite_id: number;
  parent_section_id?: number;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  subsections?: Section[];
}

export function TestRuns() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId?: string }>();
  const { t, isRTL, language } = useTranslation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [runName, setRunName] = useState('');
  const [runDescription, setRunDescription] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [environment, setEnvironment] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [priority, setPriority] = useState('medium');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const runNameInputRef = useRef<HTMLInputElement>(null);
  const [selectedTestRun, setSelectedTestRun] = useState<TestRun | null>(null);
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [testSuites, setTestSuites] = useState<any[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [environments, setEnvironments] = useState<any[]>([]);
  const [selectedTestCases, setSelectedTestCases] = useState<number[]>([]);
  const [selectedTestSuites, setSelectedTestSuites] = useState<number[]>([]);
  const [selectedSections, setSelectedSections] = useState<number[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Validate projectId from URL params
  const currentProjectId = projectId ? parseInt(projectId) : null;
  useEffect(() => {
    // Auto-focus on name input when dialog opens
    if (isCreateDialogOpen && runNameInputRef.current) {
      setTimeout(() => runNameInputRef.current?.focus(), 100);
    }
  }, [isCreateDialogOpen]);

  // Track unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(
      runName.trim() !== '' || 
      runDescription.trim() !== '' || 
      scheduledDate !== '' || 
      environment !== '' || 
      assignedTo !== '' || 
      estimatedDuration !== '' ||
      selectedTestCases.length > 0 ||
      selectedTestSuites.length > 0 ||
      selectedSections.length > 0
    );
  }, [runName, runDescription, scheduledDate, environment, assignedTo, estimatedDuration, selectedTestCases, selectedTestSuites, selectedSections]);

  useEffect(() => {
    // Validate projectId is a valid positive integer
    if (!currentProjectId || isNaN(currentProjectId) || currentProjectId <= 0) {
      setError('Invalid Project ID');
      setIsLoading(false);
      return;
    }
    loadData();
  }, [projectId]);

  const loadData = async () => {
    if (!currentProjectId || isNaN(currentProjectId) || currentProjectId <= 0) return;
    
    try {
      setIsLoading(true);
      setError(null);
      const [testRunsData, testCasesData, testSuitesData, usersData, sectionsData, environmentsData] = await Promise.all([
        testRunsAPI.getAll(currentProjectId).catch(err => {
          if (err.response?.status === 404) {
            setError('Project not found');
            return [];
          }
          throw err;
        }),
        testCasesAPI.getAll().catch(() => []),
        testSuitesAPI.getAll(currentProjectId).catch(() => []),
        usersAPI.getAll().catch(() => []),
        sectionsAPI.getAll(undefined, undefined, 0, 100).catch(() => []),
        environmentsAPI.getAll(currentProjectId).catch(() => []),
      ]);
      setTestRuns(testRunsData);
      setTestCases(testCasesData);
      setTestSuites(testSuitesData);
      setUsers(usersData);
      setSections(sectionsData);
      setEnvironments(environmentsData);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load test runs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTestRun = async () => {
    if (!runName.trim() || selectedTestCases.length === 0) {
      setError(t('pleaseEnterRunNameAndSelectCases'));
      return;
    }

    try {
      setIsCreating(true);
      setError(null);
      
      const newTestRun = await testRunsAPI.create({
        name: runName,
        description: runDescription || undefined,
        project_id: currentProjectId,
        status: 'pending',
        environment_id: environment ? parseInt(environment) : undefined,
        scheduled_date: scheduledDate || undefined,
        assigned_to: assignedTo ? parseInt(assignedTo) : undefined,
        estimated_duration: estimatedDuration ? parseInt(estimatedDuration) : undefined,
        priority: priority as any,
      });
      
      // Create test results for each selected test case
      const testResultsPromises = selectedTestCases.map(testCaseId =>
        testResultsAPI.create({
          test_run_id: newTestRun.id,
          test_case_id: testCaseId,
          status: 'not_tested',
          actual_result: undefined,
          comments: undefined,
          execution_time: undefined,
          executed_by: undefined,
        })
      );
      
      await Promise.all(testResultsPromises);
      
      setTestRuns([newTestRun, ...testRuns]);
      // Reset form
      setRunName('');
      setRunDescription('');
      setScheduledDate('');
      setEnvironment('');
      setAssignedTo('');
      setEstimatedDuration('');
      setPriority('medium');
      setSelectedTestCases([]);
      setSelectedTestSuites([]);
      setSelectedSections([]);
      setHasUnsavedChanges(false);
      setIsCreateDialogOpen(false);
      
      // Navigate to the new test run detail page
      navigate(`/projects/${currentProjectId}/test-runs/${newTestRun.id}`);
    } catch (err) {
      console.error('Failed to create test run:', err);
      setError(t('failedToCreateTestRun'));
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
        // Reset form when closing
        setRunName('');
        setRunDescription('');
        setScheduledDate('');
        setEnvironment('');
        setAssignedTo('');
        setEstimatedDuration('');
        setPriority('medium');
        setSelectedTestCases([]);
        setSelectedTestSuites([]);
        setSelectedSections([]);
        setHasUnsavedChanges(false);
        setTouchedFields({});
      }
    }
  };

  const handleUnsavedConfirm = (discard: boolean) => {
    setShowUnsavedDialog(false);
    if (discard) {
      setRunName('');
      setRunDescription('');
      setScheduledDate('');
      setEnvironment('');
      setAssignedTo('');
      setEstimatedDuration('');
      setPriority('medium');
      setSelectedTestCases([]);
      setSelectedTestSuites([]);
      setSelectedSections([]);
      setHasUnsavedChanges(false);
      setTouchedFields({});
      setIsCreateDialogOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleCreateTestRun();
    }
  };

  // Helper functions for hierarchical selection
  const toggleSectionExpansion = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const toggleTestCaseSelection = (testCaseId: number) => {
    const newSelected = new Set(selectedTestCases);
    if (newSelected.has(testCaseId)) {
      newSelected.delete(testCaseId);
    } else {
      newSelected.add(testCaseId);
    }
    setSelectedTestCases(Array.from(newSelected));
  };

  const selectAllInSection = (sectionTestCases: TestCase[]) => {
    const sectionIds = sectionTestCases.map(tc => tc.id);
    const newSelected = new Set(selectedTestCases);
    sectionIds.forEach(id => newSelected.add(id));
    setSelectedTestCases(Array.from(newSelected));
  };

  const deselectAllInSection = (sectionTestCases: TestCase[]) => {
    const sectionIds = sectionTestCases.map(tc => tc.id);
    const newSelected = selectedTestCases.filter(id => !sectionIds.includes(id));
    setSelectedTestCases(newSelected);
  };

  // Build hierarchical section structure
  const buildSectionHierarchy = (sections: Section[]): Section[] => {
    const sectionMap = new Map<number, Section>();
    const rootSections: Section[] = [];

    // Create map of all sections
    sections.forEach(section => {
      sectionMap.set(section.id, { ...section, subsections: [] });
    });

    // Build hierarchy
    sections.forEach(section => {
      const sectionWithSubs = sectionMap.get(section.id)!;
      if (section.parent_section_id) {
        const parent = sectionMap.get(section.parent_section_id);
        if (parent) {
          parent.subsections!.push(sectionWithSubs);
        }
      } else {
        rootSections.push(sectionWithSubs);
      }
    });

    return rootSections;
  };

  // Get test cases for a section (including subsections)
  const getTestCasesForSection = (section: Section): TestCase[] => {
    let sectionTestCases = testCases.filter(tc => {
      // Match test cases to sections using section_id
      const testCaseSectionId = (tc as any).section_id;
      return testCaseSectionId === section.id;
    });
    
    if (section.subsections) {
      section.subsections.forEach(subsection => {
        sectionTestCases = [...sectionTestCases, ...getTestCasesForSection(subsection)];
      });
    }
    
    return sectionTestCases;
  };

  // Toggle section selection
  const toggleSectionSelection = (section: Section) => {
    const sectionTestCases = getTestCasesForSection(section);
    const isAllSelected = sectionTestCases.every(tc => selectedTestCases.includes(tc.id));
    
    if (isAllSelected) {
      deselectAllInSection(sectionTestCases);
    } else {
      selectAllInSection(sectionTestCases);
    }
  };

  // Toggle test suite selection
  const toggleTestSuiteSelection = (suiteId: number) => {
    const suiteTestCases = testCases.filter(tc => tc.test_suite_id === suiteId);
    const isAllSelected = suiteTestCases.every(tc => selectedTestCases.includes(tc.id));
    
    if (isAllSelected) {
      deselectAllInSection(suiteTestCases);
      setSelectedTestSuites(selectedTestSuites.filter(id => id !== suiteId));
    } else {
      selectAllInSection(suiteTestCases);
      setSelectedTestSuites([...selectedTestSuites, suiteId]);
    }
  };

  
  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      running: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      passed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      blocked: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
    };
    return variants[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  };

  // Render section tree recursively
  const renderSection = (section: Section, level = 0) => {
    const sectionTestCases = getTestCasesForSection(section);
    const isExpanded = expandedSections.has(section.id.toString());
    const isAllSelected = sectionTestCases.length > 0 && sectionTestCases.every(tc => selectedTestCases.includes(tc.id));
    const isPartiallySelected = sectionTestCases.some(tc => selectedTestCases.includes(tc.id));

    return (
      <div key={section.id} className="border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3" style={{ paddingLeft: `${level * 20 + 12}px` }}>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="p-0 h-6 w-6 flex-shrink-0"
              onClick={() => toggleSectionExpansion(section.id.toString())}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={() => toggleSectionSelection(section)}
              className={isPartiallySelected && !isAllSelected ? "data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500" : ""}
            />
            <Folder className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium truncate" title={section.name}>{section.name}</span>
            <Badge variant="secondary" className="text-xs flex-shrink-0">
              {sectionTestCases.length} cases
            </Badge>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => selectAllInSection(sectionTestCases)}
            >
              Select All
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => deselectAllInSection(sectionTestCases)}
            >
              Deselect All
            </Button>
          </div>
        </div>
        
        {isExpanded && (
          <div className="divide-y">
            {sectionTestCases
              .filter(tc => tc.title?.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((testCase) => (
                <div
                  key={testCase.id}
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800"
                  style={{ paddingLeft: `${(level + 1) * 20 + 12}px` }}
                >
                  <Checkbox
                    checked={selectedTestCases.includes(testCase.id)}
                    onCheckedChange={() => toggleTestCaseSelection(testCase.id)}
                    className="flex-shrink-0"
                  />
                  <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0 max-w-[200px] sm:max-w-[300px]">
                    <div className="font-medium truncate text-sm" title={testCase.title}>{testCase.title}</div>
                    {testCase.description && (
                      <div className="text-xs text-gray-500 truncate" title={testCase.description}>
                        {testCase.description.length > 80 ? `${testCase.description.substring(0, 80)}...` : testCase.description}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    {testCase.priority}
                  </Badge>
                </div>
              ))}
          </div>
        )}
        
        {section.subsections && section.subsections.map(subsection => renderSection(subsection, level + 1))}
      </div>
    );
  };

  const hierarchicalSections = buildSectionHierarchy(sections);

  return (
    <div className={`space-y-6 ${isRTL ? 'rtl' : 'ltr'}`}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('testRunsTitle')}</h1>
          <p className="text-gray-600">{t('testRunsDescription')}</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button type="button">
              <Plus className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('createTestRun')}
            </Button>
          </DialogTrigger>
          <DialogContent isRTL={isRTL} className={`max-w-[95vw] sm:max-w-[900px] max-h-[90vh] overflow-y-auto ${isRTL ? 'rtl' : 'ltr'}`} onKeyDown={handleKeyDown}>
            <DialogHeader>
              <DialogTitle>{t('createNewTestRun')}</DialogTitle>
              <DialogDescription>
                {t('createTestRunDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  {t('basicInformation')}
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                  <Label htmlFor="runName" className={`sm:text-right ${isRTL ? 'text-left' : ''}`}>
                    {t('runName')} *
                  </Label>
                  <div className="sm:col-span-3 space-y-1">
                    <Input
                      ref={runNameInputRef}
                      id="runName"
                      value={runName}
                      onChange={(e) => setRunName(e.target.value)}
                      onBlur={() => setTouchedFields({...touchedFields, runName: true})}
                      className={touchedFields.runName && runName.trim() === '' ? 'border-red-300 focus:border-red-500' : ''}
                      placeholder={t('enterRunName')}
                      maxLength={200}
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{t('enterRunName')}</span>
                      <span>{runName.length}/200</span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-4">
                  <Label htmlFor="runDescription" className={`sm:text-right pt-2 ${isRTL ? 'text-left' : ''}`}>
                    {t('runDescriptionLabel')}
                  </Label>
                  <div className="sm:col-span-3 space-y-1">
                    <Textarea
                      id="runDescription"
                      value={runDescription}
                      onChange={(e) => setRunDescription(e.target.value)}
                      placeholder={t('enterRunDescription')}
                      rows={3}
                      maxLength={1000}
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{t('enterRunDescription')}</span>
                      <span>{runDescription.length}/1000</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Scheduling and Assignment */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {t('schedulingAssignment')}
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                  <Label htmlFor="scheduledDate" className={`sm:text-right ${isRTL ? 'text-left' : ''}`}>
                    {t('scheduledDate')}
                  </Label>
                  <Input
                    id="scheduledDate"
                    type="datetime-local"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="sm:col-span-3"
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                  <Label htmlFor="assignedTo" className={`sm:text-right ${isRTL ? 'text-left' : ''}`}>
                    {t('assignedToLabel')}
                  </Label>
                  <Select value={assignedTo} onValueChange={setAssignedTo}>
                    <SelectTrigger className="sm:col-span-3">
                      <SelectValue placeholder={t('selectAssignee')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="me">{t('meCurrentUser')}</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.full_name || user.username} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                  <Label htmlFor="estimatedDuration" className={`sm:text-right ${isRTL ? 'text-left' : ''}`}>
                    {t('estimatedDuration')}
                  </Label>
                  <Input
                    id="estimatedDuration"
                    type="number"
                    value={estimatedDuration}
                    onChange={(e) => setEstimatedDuration(e.target.value)}
                    className="sm:col-span-3"
                    placeholder={t('estimatedDurationPlaceholder')}
                  />
                </div>
              </div>

              {/* Test Configuration */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  {t('testConfiguration')}
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                  <Label htmlFor="environment" className={`sm:text-right ${isRTL ? 'text-left' : ''}`}>
                    {t('environmentLabel')}
                  </Label>
                  <Select value={environment} onValueChange={setEnvironment}>
                    <SelectTrigger className="sm:col-span-3">
                      <SelectValue placeholder={t('selectTestEnvironment')} />
                    </SelectTrigger>
                    <SelectContent>
                      {environments.map((env) => (
                        <SelectItem key={env.id} value={env.id.toString()}>
                          {env.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                  <Label htmlFor="priority" className={`sm:text-right ${isRTL ? 'text-left' : ''}`}>
                    {t('priority')}
                  </Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="sm:col-span-3">
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
              </div>
              
              {/* Test Case Selection */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  {t('testCaseSelection')}
                </h3>
                
                {/* Search */}
                <div className="relative">
                  <Search className={`absolute ${isRTL ? 'right-2.5' : 'left-2.5'} top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400`} />
                  <Input
                    placeholder={t('searchTestCases')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`pl-9 h-8 text-xs ${isRTL ? 'pr-9 pl-3' : ''}`}
                  />
                </div>

                {/* Selection Summary */}
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-blue-900 dark:text-blue-100">
                      {selectedTestCases.length} test case{selectedTestCases.length !== 1 ? 's' : ''} selected
                    </span>
                    {selectedTestCases.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedTestCases([]);
                          setSelectedTestSuites([]);
                          setSelectedSections([]);
                        }}
                        className="h-6 text-[10px] px-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        {t('clearAll')}
                      </Button>
                    )}
                  </div>
                  {(selectedTestSuites.length > 0 || selectedSections.length > 0) && (
                    <div className="text-[10px] text-blue-700 dark:text-blue-300 mt-1 space-y-0.5">
                      {selectedTestSuites.length > 0 && (
                        <div>{t('testSuitesSelected', { count: selectedTestSuites.length })}</div>
                      )}
                      {selectedSections.length > 0 && (
                        <div>{t('sectionsSelected', { count: selectedSections.length })}</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Hierarchical Selection with improved height and scrolling */}
                <div className="border rounded overflow-hidden">
                  <div className="sticky top-0 bg-gray-50 dark:bg-gray-800 z-10 px-2.5 py-1.5 border-b">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-gray-600 dark:text-gray-300 flex items-center gap-1">
                        <span className="hidden sm:inline">{t('hoverToSeeDescriptions')}</span>
                        <span className="sm:hidden">{t('tapToSelect')}</span>
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 font-medium">
                        {selectedTestCases.length} {t('selected')}
                      </span>
                    </div>
                  </div>
                  
                  {/* Scrollable content area with max height */}
                  <div className="max-h-[400px] overflow-y-auto">
                    {/* Show loading state for large datasets */}
                    {testCases.length > 1000 && (
                      <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
                        <p className="text-[10px] text-yellow-800 dark:text-yellow-200">
                          ⚠️ Large dataset ({testCases.length} test cases). Use search to filter results.
                        </p>
                      </div>
                    )}
                    
                    {/* Sections */}
                    {hierarchicalSections.length > 0 && (
                      <div className="border-b">
                        <div className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 font-medium text-xs">
                          {t('sectionsSubsections')}
                        </div>
                        {hierarchicalSections.map(section => renderSection(section))}
                      </div>
                    )}

                    {/* Test Suites */}
                    {testSuites.length > 0 && (
                      <div className="border-b">
                        <div className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 font-medium text-xs">
                          {t('testSuitesLabel')}
                        </div>
                        {testSuites.map((suite) => {
                          const suiteTestCases = testCases.filter(tc => tc.test_suite_id === suite.id);
                          const filteredSuiteTestCases = suiteTestCases.filter(tc => 
                            tc.title?.toLowerCase().includes(searchQuery.toLowerCase())
                          );
                          
                          // Skip suite if no test cases match search
                          if (searchQuery && filteredSuiteTestCases.length === 0) {
                            return null;
                          }
                          
                          const isAllSelected = suiteTestCases.length > 0 && suiteTestCases.every(tc => selectedTestCases.includes(tc.id));
                          const isPartiallySelected = suiteTestCases.some(tc => selectedTestCases.includes(tc.id));

                          return (
                            <div key={suite.id} className="border-b last:border-b-0">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 px-2.5 py-1.5">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <Checkbox
                                    checked={isAllSelected}
                                    onCheckedChange={() => toggleTestSuiteSelection(suite.id)}
                                    className={`h-3.5 w-3.5 ${isPartiallySelected && !isAllSelected ? "data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500" : ""}`}
                                  />
                                  <Folder className="h-3.5 w-3.5 flex-shrink-0 text-gray-500" />
                                  <span className="font-medium text-xs truncate" title={suite.name}>{suite.name}</span>
                                  <Badge variant="secondary" className="text-[10px] flex-shrink-0 h-4 px-1.5">
                                    {suiteTestCases.length}
                                  </Badge>
                                </div>
                                <div className="flex gap-1 flex-shrink-0 ml-5 sm:ml-0">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => selectAllInSection(suiteTestCases)}
                                    className="h-6 text-[10px] px-1.5"
                                  >
                                    Select All
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deselectAllInSection(suiteTestCases)}
                                    className="h-6 text-[10px] px-1.5"
                                  >
                                    Deselect All
                                  </Button>
                                </div>
                              </div>
                            
                              {/* Only show first 50 test cases per suite if not searching, otherwise show all matches */}
                              <div className="divide-y">
                                {filteredSuiteTestCases
                                  .slice(0, searchQuery ? undefined : 50)
                                  .map((testCase) => (
                                    <div key={testCase.id} className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                      <Checkbox
                                        checked={selectedTestCases.includes(testCase.id)}
                                        onCheckedChange={() => toggleTestCaseSelection(testCase.id)}
                                        className="flex-shrink-0 ml-5 h-3.5 w-3.5"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <span className="text-xs font-medium truncate block" title={testCase.title}>{testCase.title}</span>
                                        {testCase.description && (
                                          <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate" title={testCase.description}>
                                            {testCase.description.length > 60 ? `${testCase.description.substring(0, 60)}...` : testCase.description}
                                          </p>
                                        )}
                                      </div>
                                      <Badge variant="outline" className="text-[10px] flex-shrink-0 h-4 px-1.5">
                                        {testCase.priority}
                                      </Badge>
                                    </div>
                                  ))}
                                {!searchQuery && filteredSuiteTestCases.length > 50 && (
                                  <div className="px-2.5 py-1.5 text-[10px] text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                                    Showing 50 of {filteredSuiteTestCases.length} test cases. Use search to find specific cases.
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Uncategorized Test Cases */}
                    {testCases.filter(tc => !tc.test_suite_id && !(tc as any).section_id).length > 0 && (
                      <div>
                        <div className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 font-medium text-xs">
                          {t('uncategorizedTestCases')}
                        </div>
                        <div className="divide-y">
                          {testCases
                            .filter(tc => !tc.test_suite_id && !(tc as any).section_id)
                            .filter(tc => tc.title?.toLowerCase().includes(searchQuery.toLowerCase()))
                            .slice(0, searchQuery ? undefined : 50)
                            .map((testCase) => (
                              <div key={testCase.id} className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                <Checkbox
                                  checked={selectedTestCases.includes(testCase.id)}
                                  onCheckedChange={() => toggleTestCaseSelection(testCase.id)}
                                  className="flex-shrink-0 h-3.5 w-3.5"
                                />
                                <div className="flex-1 min-w-0">
                                  <span className="text-xs font-medium truncate block" title={testCase.title}>{testCase.title}</span>
                                  {testCase.description && (
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate" title={testCase.description}>
                                      {testCase.description.length > 60 ? `${testCase.description.substring(0, 60)}...` : testCase.description}
                                    </p>
                                  )}
                                </div>
                                <Badge variant="outline" className="text-[10px] flex-shrink-0 h-4 px-1.5">
                                  {testCase.priority}
                                </Badge>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {error && (
              <div className="text-sm text-red-600 text-center">
                {error}
              </div>
            )}
            
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <div className="text-xs text-gray-500 mb-2 sm:mb-0 sm:mr-auto">
                {t('toSubmit')}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogClose(false)}
              >
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                onClick={handleCreateTestRun}
                disabled={!runName.trim() || selectedTestCases.length === 0 || isCreating}
                className="transition-all duration-200"
              >
                {isCreating && <Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />}
                {isCreating ? t('creating') : `${t('createTestRun')} (${selectedTestCases.length} ${t('cases')})`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Unsaved Changes Confirmation Dialog */}
        <Dialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
          <DialogContent isRTL={isRTL} className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>{t('unsavedChangesTitle')}</DialogTitle>
              <DialogDescription>
                {t('unsavedChangesModalMessage')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleUnsavedConfirm(false)}>
                {t('keepEditingModal')}
              </Button>
              <Button type="button" onClick={() => handleUnsavedConfirm(true)}>
                {t('discardChangesModal')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Test Runs List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className={`ml-2 ${isRTL ? 'mr-2' : ''}`}>{t('loadingTestRuns')}</span>
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-600">
          {error}
        </div>
      ) : testRuns.length === 0 ? (
        <div className="text-center py-12">
          <History className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">{t('noTestRunsFound')}</h3>
          <p className="text-gray-500 mb-4">{t('createFirstTestRun')}</p>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {t('createTestRun')}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {testRuns.map((run) => (
            <Card 
              key={run.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/projects/${currentProjectId}/test-runs/${run.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0 mr-4">
                    <CardTitle className="text-lg truncate" title={run.name}>
                      {run.name}
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      Project ID: {run.project_id} • Status: {run.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={run.status === 'completed' ? 'default' : 'secondary'}>
                      {run.status}
                    </Badge>
                    <span className="text-sm text-gray-500">
                      0 {t('cases')}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/projects/${currentProjectId}/test-runs/${run.id}`)}
                    >
                      {t('viewDetails')}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{t('started')}:</span>
                  <span className="font-medium">{run.started_at ? new Date(run.started_at).toLocaleString() : t('notStarted')}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Completed:</span>
                  <span className="font-medium">{run.completed_at ? new Date(run.completed_at).toLocaleString() : 'In progress'}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Test Details Dialog */}
      <Dialog open={!!selectedTestRun} onOpenChange={() => setSelectedTestRun(null)}>
        <DialogContent isRTL={isRTL} className={`max-w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto ${isRTL ? 'rtl' : 'ltr'}`}>
          <DialogHeader>
            <DialogTitle>{t('testRunDetails')}: {selectedTestRun?.name}</DialogTitle>
            <DialogDescription>
              {t('testRunDetailsDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedTestRun && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Status</Label>
                    <Badge variant={selectedTestRun.status === 'completed' ? 'default' : 'secondary'}>
                      {selectedTestRun.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Project ID</Label>
                    <p className="text-sm">{selectedTestRun.project_id}</p>
                  </div>
                </div>
                
                {selectedTestRun.description && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Description</Label>
                    <p className="text-sm mt-1">{selectedTestRun.description}</p>
                  </div>
                )}
                
                {selectedTestRun.environment && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Environment</Label>
                    <p className="text-sm mt-1">{selectedTestRun.environment.name}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Created</Label>
                    <p className="text-sm mt-1">{new Date(selectedTestRun.created_at).toLocaleString()}</p>
                  </div>
                  {selectedTestRun.started_at && (
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Started</Label>
                      <p className="text-sm mt-1">{new Date(selectedTestRun.started_at).toLocaleString()}</p>
                    </div>
                  )}
                </div>
                
                {selectedTestRun.completed_at && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Completed</Label>
                    <p className="text-sm mt-1">{new Date(selectedTestRun.completed_at).toLocaleString()}</p>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedTestRun(null)}
            >
              Close
            </Button>
            <Button
              onClick={() => {
                if (selectedTestRun) {
                  navigate(`/projects/${currentProjectId}/test-runs/${selectedTestRun.id}`);
                  setSelectedTestRun(null);
                }
              }}
            >
              View Full Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
