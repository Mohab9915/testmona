import { useState, useEffect, useRef, useMemo } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, TestTube, Search, ChevronDown, ChevronRight, Folder, FileText, 
  Loader2, Filter, MoreVertical, Edit, Trash2, Copy, Archive, 
  CheckSquare, Square, FolderOpen, AlertCircle
} from 'lucide-react';
import { testSuitesAPI, testCasesAPI, sectionsAPI, auditAPI } from '@/lib/api';
import { TestSuite, TestCase } from '@/types';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/hooks/useTranslation';

export function TestSuites() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId?: string }>();
  const { toast } = useToast();
  const { t, isRTL } = useTranslation();
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [suiteName, setSuiteName] = useState('');
  const [suiteDescription, setSuiteDescription] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  
  // Data states
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  
  // Selection states
  const [selectedTestCases, setSelectedTestCases] = useState<number[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['all']));
  
  // Filter and search states
  const [searchQuery, setSearchQuery] = useState('');
  const [suiteSearchQuery, setSuiteSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedTab, setSelectedTab] = useState<string>('by-section');
  
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingTestCases, setIsLoadingTestCases] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination for test cases
  const [testCasePage, setTestCasePage] = useState(1);
  const testCasesPerPage = 50;
  
  const currentProjectId = useMemo(() => {
    const parsedProjectId = Number(projectId);
    return projectId && Number.isInteger(parsedProjectId) && parsedProjectId > 0 ? parsedProjectId : null;
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [currentProjectId]);

  // Load test cases when dialog opens
  useEffect(() => {
    if (isDialogOpen && testCases.length === 0) {
      loadTestCasesForSelection();
    }
    // Auto-focus on name input when dialog opens
    if (isDialogOpen && nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [isDialogOpen]);

  // Track unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(suiteName.trim() !== '' || suiteDescription.trim() !== '' || selectedTestCases.length > 0);
  }, [suiteName, suiteDescription, selectedTestCases]);

  const loadData = async () => {
    if (!currentProjectId) {
      setTestSuites([]);
      setError(t('noProjectSelected'));
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      console.log('🔍 Loading test suites for project:', currentProjectId);
      const testSuitesData = await testSuitesAPI.getAll(currentProjectId).catch((err) => {
        console.error('❌ Failed to load test suites:', err);
        return [];
      });
      console.log('✅ Test suites loaded:', testSuitesData);
      setTestSuites(testSuitesData);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError(t('failedToLoadTestSuitesError'));
      toast({
        title: t('error'),
        description: t('failedToLoadTestSuitesError'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadTestCasesForSelection = async () => {
    if (!currentProjectId) {
      setTestCases([]);
      setSections([]);
      return;
    }

    try {
      setIsLoadingTestCases(true);
      const [testCasesData, hierarchyData] = await Promise.all([
        testCasesAPI.getAll(currentProjectId).catch(() => []),
        sectionsAPI.getProjectSectionHierarchy(currentProjectId).catch(() => null),
      ]);
      setTestCases(testCasesData);
      setSections(
        hierarchyData?.hierarchy?.flatMap((suiteData: any) =>
          (suiteData.sections || []).map((section: any) => ({
            ...section,
            test_suite_id: suiteData.test_suite.id,
          }))
        ) || []
      );
    } catch (err) {
      console.error('Failed to load test cases:', err);
      toast({
        title: t('warning'),
        description: t('failedToLoadTestCasesForSelectionError'),
        variant: "destructive",
      });
    } finally {
      setIsLoadingTestCases(false);
    }
  };

  // Log activity to audit trail
  const logActivity = async (action: string, entityType: string, entityId: number, description: string, newValues?: any) => {
    try {
      // Note: Audit logging disabled - API method not available
      // await auditAPI.createAuditTrail({
      //   action,
      //   entity_type: entityType,
      //   entity_id: entityId,
      //   project_id: currentProjectId,
      //   description,
      //   new_values: newValues,
      // });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  };

  // Helper functions for test case selection
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

  const selectAllFiltered = () => {
    const allIds = filteredAndPaginatedTestCases.map(tc => tc.id);
    setSelectedTestCases(allIds);
  };

  const deselectAll = () => {
    setSelectedTestCases([]);
  };

  // Enhanced filtering with priority and status
  const filteredTestCases = useMemo(() => {
    let filtered = testCases;
    
    // Search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(tc => 
        tc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tc.description && tc.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (tc.tags && tc.tags.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(tc => tc.priority === priorityFilter);
    }
    
    return filtered;
  }, [testCases, searchQuery, priorityFilter]);

  // Paginated test cases for better performance
  const filteredAndPaginatedTestCases = useMemo(() => {
    const startIndex = (testCasePage - 1) * testCasesPerPage;
    const endIndex = startIndex + testCasesPerPage;
    return filteredTestCases.slice(startIndex, endIndex);
  }, [filteredTestCases, testCasePage]);

  const totalPages = Math.ceil(filteredTestCases.length / testCasesPerPage);

  // Filter test suites
  const filteredTestSuites = useMemo(() => {
    let filtered = testSuites;
    
    if (suiteSearchQuery.trim()) {
      filtered = filtered.filter(suite =>
        suite.name.toLowerCase().includes(suiteSearchQuery.toLowerCase()) ||
        (suite.description && suite.description.toLowerCase().includes(suiteSearchQuery.toLowerCase()))
      );
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(suite => suite.status === statusFilter);
    }
    
    return filtered;
  }, [testSuites, suiteSearchQuery, statusFilter]);

  const handleCreateTestSuite = async () => {
    if (!currentProjectId) {
      setError(t('noProjectSelected'));
      toast({
        title: t('error'),
        description: t('noProjectSelected'),
        variant: "destructive",
      });
      return;
    }

    if (!suiteName.trim()) {
      setError(t('pleaseEnterASuiteName'));
      toast({
        title: t('validationError'),
        description: t('pleaseEnterASuiteName'),
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreating(true);
      setError(null);
      
      const newTestSuite = await testSuitesAPI.create({
        name: suiteName,
        description: suiteDescription || undefined,
        project_id: currentProjectId,
        status: 'active',
        test_case_ids: selectedTestCases,
      });
      
      // Log activity
      await logActivity(
        'create',
        'test_suite',
        newTestSuite.id,
        t('createdTestSuiteWithCases', { name: suiteName, count: selectedTestCases.length }),
        {
          name: suiteName,
          description: suiteDescription,
          test_case_count: selectedTestCases.length,
        }
      );
      
      setTestSuites([newTestSuite, ...testSuites]);
      
      // Reset form
      setSuiteName('');
      setSuiteDescription('');
      setSelectedTestCases([]);
      setSearchQuery('');
      setTestCasePage(1);
      setIsDialogOpen(false);
      
      toast({
        title: t('success'),
        description: t('testSuiteCreatedSuccessfully', { name: suiteName }),
      });
      
      // Navigate to the new test suite detail page
      navigate(`/projects/${currentProjectId}/test-suites/${newTestSuite.id}`);
    } catch (err) {
      console.error('Failed to create test suite:', err);
      setError(t('failedToCreateTestSuiteError'));
      toast({
        title: t('error'),
        description: t('failedToCreateTestSuiteRetryError'),
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSuite = async (suite: TestSuite) => {
    if (!confirm(t('confirmDeleteSuite'))) {
      return;
    }
    
    try {
      await testSuitesAPI.delete(suite.id);
      
      // Log activity
      await logActivity(
        'delete',
        'test_suite',
        suite.id,
        t('deletedTestSuite', { name: suite.name }),
        { name: suite.name }
      );
      
      setTestSuites(testSuites.filter(s => s.id !== suite.id));
      
      toast({
        title: t('success'),
        description: t('deletedTestSuite', { name: suite.name }),
      });
    } catch (err) {
      console.error('Failed to delete test suite:', err);
      toast({
        title: t('error'),
        description: t('failedToDeleteTestSuite'),
        variant: "destructive",
      });
    }
  };

  const handleDuplicateSuite = async (suite: TestSuite) => {
    try {
      const newSuite = await testSuitesAPI.create({
        name: `${suite.name} (Copy)`,
        description: suite.description,
        project_id: suite.project_id,
      });
      
      toast({
        title: t('success'),
        description: t('testSuiteDuplicatedSuccessfully'),
      });
      
      await loadData();
    } catch (err) {
      console.error('Failed to duplicate test suite:', err);
      toast({
        title: t('error'),
        description: t('failedToDuplicateTestSuite'),
        variant: "destructive",
      });
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open && hasUnsavedChanges) {
      setShowUnsavedDialog(true);
    } else {
      setIsDialogOpen(open);
      if (!open) {
        // Reset form when closing
        setSuiteName('');
        setSuiteDescription('');
        setSelectedTestCases([]);
        setHasUnsavedChanges(false);
      }
    }
  };

  const handleUnsavedConfirm = (discard: boolean) => {
    setShowUnsavedDialog(false);
    if (discard) {
      setSuiteName('');
      setSuiteDescription('');
      setSelectedTestCases([]);
      setHasUnsavedChanges(false);
      setIsDialogOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleCreateTestSuite();
    }
  };

  return (
    <div className={`space-y-6 ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('testSuitesTitle')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t('testSuitesDescription')}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('createTestSuite')}
            </Button>
          </DialogTrigger>
          <DialogContent isRTL={isRTL} className={`sm:max-w-[900px] max-h-[85vh] overflow-y-auto ${isRTL ? 'rtl' : 'ltr'}`} onKeyDown={handleKeyDown}>
            <DialogHeader>
              <DialogTitle>{t('createNewTestSuite')}</DialogTitle>
              <DialogDescription>
                {t('createTestSuiteDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('basicInformation')}</h3>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className={`text-right ${isRTL ? 'text-left' : ''}`}>
                    {t('suiteName')} *
                  </Label>
                  <div className="col-span-3 space-y-1">
                    <Input
                      ref={nameInputRef}
                      id="name"
                      value={suiteName}
                      onChange={(e) => setSuiteName(e.target.value)}
                      className={suiteName.trim() === '' ? 'border-red-300 focus:border-red-500' : ''}
                      placeholder={t('enterSuiteName')}
                      maxLength={200}
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{t('enterSuiteName')}</span>
                      <span>{suiteName.length}/200</span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="description" className={`text-right pt-2 ${isRTL ? 'text-left' : ''}`}>
                    {t('suiteDescription')}
                  </Label>
                  <div className="col-span-3 space-y-1">
                    <Textarea
                      id="description"
                      value={suiteDescription}
                      onChange={(e) => setSuiteDescription(e.target.value)}
                      placeholder={t('enterSuiteDescription')}
                      rows={3}
                      maxLength={1000}
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{t('enterSuiteDescription')}</span>
                      <span>{suiteDescription.length}/1000</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Test Case Selection */}
              <div className="col-span-4">
                <Label className="text-base font-semibold mb-3 block">{t('selectTestCases')}</Label>
                
                {/* Filters and Search */}
                <div className="space-y-3 mb-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder={t('searchTestCases')}
                        className="pl-10"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setTestCasePage(1);
                        }}
                      />
                    </div>
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                      <SelectTrigger className="w-32">
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
                  </div>
                </div>

                {/* Selection Summary with Stats */}
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">
                      {selectedTestCases.length} {t('of')} {filteredTestCases.length} {t('selected')}
                    </span>
                    {filteredTestCases.length < testCases.length && (
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        ({testCases.length} {t('total')})
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {selectedTestCases.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={deselectAll}
                        className="text-blue-600 hover:text-blue-800 h-7 text-xs"
                      >
                        {t('clearAll')}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={selectAllFiltered}
                      className="text-blue-600 hover:text-blue-800 h-7 text-xs"
                    >
                      {t('selectAllFiltered')}
                    </Button>
                  </div>
                </div>

                {/* Test Cases List */}
                <div className="border rounded-md max-h-60 overflow-y-auto">
                  {/* All Test Cases Section */}
                  <div className="border-b">
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSectionExpansion('all')}
                        >
                          {expandedSections.has('all') ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                        <Folder className="h-4 w-4" />
                        <span className="font-medium">{t('allTestCases')}</span>
                        <Badge variant="secondary" className="text-xs">
                          {filteredTestCases.length}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => selectAllInSection(filteredTestCases)}
                        >
                          {t('selectAll')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deselectAllInSection(filteredTestCases)}
                        >
                          {t('deselectAll')}
                        </Button>
                      </div>
                    </div>
                    
                    {expandedSections.has('all') && (
                      <div className="divide-y">
                        {filteredAndPaginatedTestCases.map((testCase) => (
                          <div
                            key={testCase.id}
                            className="flex items-center gap-3 p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          >
                            <Checkbox
                              checked={selectedTestCases.includes(testCase.id)}
                              onCheckedChange={() => toggleTestCaseSelection(testCase.id)}
                              className="flex-shrink-0"
                            />
                            <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <div className="font-medium text-sm truncate">{testCase.title}</div>
                              {testCase.description && (
                                <div className="text-xs text-gray-500 line-clamp-1">
                                  {testCase.description}
                                </div>
                              )}
                            </div>
                            <Badge variant="outline" className="text-xs flex-shrink-0">
                              {t(testCase.priority)}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Sections */}
                  {sections.map((section: any) => {
                    const sectionTestCases = filteredTestCases.filter(
                      tc => tc.test_suite_id === section.id || tc.section === section.name
                    );
                    
                    if (sectionTestCases.length === 0) return null;
                    
                    return (
                      <div key={section.id} className="border-b">
                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleSectionExpansion(section.id)}
                            >
                              {expandedSections.has(section.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                            <Folder className="h-4 w-4" />
                            <span className="font-medium">{section.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {sectionTestCases.length}
                            </Badge>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => selectAllInSection(sectionTestCases)}
                            >
                              {t('selectAll')}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deselectAllInSection(sectionTestCases)}
                            >
                              {t('deselectAll')}
                            </Button>
                          </div>
                        </div>
                        
                        {expandedSections.has(section.id) && (
                          <div className="divide-y">
                            {sectionTestCases.map((testCase) => (
                              <div
                                key={testCase.id}
                                className="flex items-center gap-3 p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                              >
                                <Checkbox
                                  checked={selectedTestCases.includes(testCase.id)}
                                  onCheckedChange={() => toggleTestCaseSelection(testCase.id)}
                                  className="flex-shrink-0"
                                />
                                <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0 overflow-hidden">
                                  <div className="font-medium text-sm truncate">{testCase.title}</div>
                                  {testCase.description && (
                                    <div className="text-xs text-gray-500 line-clamp-1">
                                      {testCase.description}
                                    </div>
                                  )}
                                </div>
                                <Badge variant="outline" className="text-xs flex-shrink-0">
                                  {t(testCase.priority)}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <div className="text-gray-600 dark:text-gray-400">
                      {t('showingRange', { start: ((testCasePage - 1) * testCasesPerPage) + 1, end: Math.min(testCasePage * testCasesPerPage, filteredTestCases.length), total: filteredTestCases.length })}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTestCasePage(p => Math.max(1, p - 1))}
                        disabled={testCasePage === 1}
                        className="h-7"
                      >
                        {t('previous')}
                      </Button>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-600 dark:text-gray-400">
                          {t('pageOf', { current: testCasePage, total: totalPages })}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTestCasePage(p => Math.min(totalPages, p + 1))}
                        disabled={testCasePage === totalPages}
                        className="h-7"
                      >
                        {t('next')}
                      </Button>
                    </div>
                  </div>
                )}
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
                variant="outline"
                onClick={() => handleDialogClose(false)}
              >
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                onClick={handleCreateTestSuite}
                disabled={!currentProjectId || !suiteName.trim() || isCreating}
                className="transition-all duration-200"
              >
                {isCreating && <Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />}
                {isCreating ? t('creating') : t('createTestSuiteButton', { count: selectedTestCases.length })}
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

      {/* Main Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-500" />
              <h3 className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">{t('loadingTestSuites')}</h3>
            </div>
          </div>
        ) : testSuites.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <TestTube className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">{t('noTestSuites')}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t('createFirstTestSuite')}
              </p>
              <Button onClick={() => setIsDialogOpen(true)} className="mt-4">
                <Plus className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {t('createYourFirstTestSuite')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {/* Search and Filter Bar */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={t('searchTestSuites')}
                  className="pl-10"
                  value={suiteSearchQuery}
                  onChange={(e) => setSuiteSearchQuery(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={t('statusLabel')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allStatus')}</SelectItem>
                  <SelectItem value="active">{t('active')}</SelectItem>
                  <SelectItem value="inactive">{t('inactive')}</SelectItem>
                  <SelectItem value="archived">{t('archived')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Results Count */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {filteredTestSuites.length} {filteredTestSuites.length === 1 ? t('suiteLabel') : t('suitesLabel')}
                {filteredTestSuites.length !== testSuites.length && (
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                    ({t('filteredFrom')} {testSuites.length})
                  </span>
                )}
              </h2>
            </div>

            {/* Test Suites Grid */}
            <div className="grid gap-4">
              {filteredTestSuites.map((suite) => (
                <Card key={suite.id} className="hover:shadow-md transition-all hover:border-blue-200 dark:hover:border-blue-700">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
                          {suite.name}
                        </CardTitle>
                        {suite.description && (
                          <CardDescription className="mt-1 text-sm line-clamp-2">
                            {suite.description}
                          </CardDescription>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={suite.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                          {t(suite.status)}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/projects/${currentProjectId}/test-suites/${suite.id}`)}>
                              <FileText className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                              {t('viewDetails')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicateSuite(suite)}>
                              <Copy className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                              {t('duplicateSuite')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDeleteSuite(suite)}
                              className="text-red-600 dark:text-red-400"
                            >
                              <Trash2 className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                              {t('delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-4">
                        <span>
                          {t('createdLabel')} {new Date(suite.created_at).toLocaleDateString()}
                        </span>
                        {suite.test_case_ids && suite.test_case_ids.length > 0 && (
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {suite.test_case_ids.length} {t('test')} {suite.test_case_ids.length === 1 ? t('case') : t('cases')}
                          </span>
                        )}
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/projects/${currentProjectId}/test-suites/${suite.id}`)}
                        className="h-7 text-xs"
                      >
                        {t('viewDetails')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
