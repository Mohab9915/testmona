import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { testResultsAPI, usersAPI, testCasesAPI, testRunsAPI, defectsAPI } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/authStore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Edit,
  Save,
  Plus,
  Trash2,
  FileText,
  Bug,
  User,
  ChevronLeft,
  ChevronRight,
  Link
} from 'lucide-react';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

export function TestCaseExecution() {
  const navigate = useNavigate();
  const { projectId, testRunId, testCaseId } = useParams();
  const { isRTL, t } = useTranslation();
  const { toast } = useToast();
  const { user: currentUser } = useAuthStore();
  const [executionStatus, setExecutionStatus] = useState('pending');
  const [executionNotes, setExecutionNotes] = useState('');
  const [executionLogs, setExecutionLogs] = useState('');
  const [assignee, setAssignee] = useState('');
  const [defectLink, setDefectLink] = useState('');
  const [customLink, setCustomLink] = useState('');
  const [defects, setDefects] = useState<any[]>([]);
  const [isDefectDialogOpen, setIsDefectDialogOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const defectTitleInputRef = useRef<HTMLInputElement>(null);
  const [defectTouchedFields, setDefectTouchedFields] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [allTestCases, setAllTestCases] = useState<any[]>([]);
  const [testCase, setTestCase] = useState<any>(null);
  const [testSteps, setTestSteps] = useState<Array<{
    step_number: number;
    action: string;
    expected_result: string;
    step_type: string;
  }>>([]);
  const [testRun, setTestRun] = useState<any>(null);
  const [executionHistory, setExecutionHistory] = useState<any[]>([]);
  const [newDefect, setNewDefect] = useState({
    title: '',
    description: '',
    severity: 'medium',
    priority: 'high'
  });

  // Load test case and test run data
  useEffect(() => {
    const loadTestData = async () => {
      try {
        if (testCaseId) {
          const caseData = await testCasesAPI.getById(parseInt(testCaseId));
          setTestCase(caseData);
          
          // If multistep, fetch the steps
          if (caseData.is_multistep) {
            try {
              const steps = await testCasesAPI.getSteps(parseInt(testCaseId));
              setTestSteps(steps);
            } catch (stepsError) {
              console.error('Failed to fetch test steps:', stepsError);
              setTestSteps([]);
            }
          } else {
            setTestSteps([]);
          }
          
          // Load execution history - handle auth errors gracefully
          try {
            const history = await testCasesAPI.getExecutionHistory(parseInt(testCaseId), 50);
            setExecutionHistory(history);
          } catch (historyError: any) {
            console.error('Failed to load execution history:', historyError);
            // Don't show error toast for history - it's not critical
            setExecutionHistory([]);
          }
        }
        if (testRunId) {
          const runData = await testRunsAPI.getById(parseInt(testRunId));
          setTestRun(runData);
        }
      } catch (error) {
        console.error('Failed to load test data:', error);
        toast({
          title: t('error'),
          description: t('failedToLoadTestCaseOrTestRun'),
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadTestData();
  }, [testCaseId, testRunId]);

  // Auto-focus on defect title input when dialog opens
  useEffect(() => {
    if (isDefectDialogOpen && defectTitleInputRef.current) {
      setTimeout(() => defectTitleInputRef.current?.focus(), 100);
    }
  }, [isDefectDialogOpen]);

  // Track unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(
      newDefect.title.trim() !== '' || 
      newDefect.description.trim() !== ''
    );
  }, [newDefect.title, newDefect.description]);

  // Load users and test cases from test run
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load all users for assignee options
        const allUsers = await usersAPI.getAll();
        console.log('👥 Loaded users:', allUsers);
        console.log('👤 Current user:', currentUser);
        setUsers(allUsers);
        
        // Set current user as default assignee if not already set
        if (currentUser && !assignee) {
          setAssignee(currentUser.id.toString());
        }
        
        // Load test cases from test run
        if (testRunId) {
          const results = await testResultsAPI.getAll(parseInt(testRunId));
          const testCasesInRun = results.map((r: any) => ({
            id: r.test_case_id,
            title: r.test_case?.title || `Test Case ${r.test_case_id}`
          }));
          setAllTestCases(testCasesInRun);
          console.log('Loaded test cases:', testCasesInRun);
          console.log('Current test case ID:', testCaseId);
        }
      } catch (error) {
        console.error('Failed to load initial data:', error);
        // Fallback to current user only if API fails
        if (currentUser) {
          setUsers([currentUser]);
          if (!assignee) {
            setAssignee(currentUser.id.toString());
          }
        }
      }
    };
    
    loadInitialData();
  }, [testRunId, currentUser, assignee]);

  // Load existing execution status when component mounts or test case changes
  useEffect(() => {
    const loadExistingExecution = async () => {
      if (!testRunId || !testCaseId) return;
      
      setIsLoading(true);
      try {
        console.log('🔍 Loading existing execution for test case:', testCaseId);
        const existingResults = await testResultsAPI.getAll(
          parseInt(testRunId), 
          parseInt(testCaseId)
        );
        
        if (existingResults.length > 0) {
          const result = existingResults[0];
          console.log('✅ Found existing execution:', result);
          
          // Map status values
          const statusMap: { [key: string]: string } = {
            'passed': 'passed',
            'pass': 'passed', 
            'failed': 'failed',
            'fail': 'failed',
            'blocked': 'blocked',
            'block': 'blocked',
            'skipped': 'skipped',
            'skip': 'skipped',
            'pending': 'pending'
          };
          
          const mappedStatus = statusMap[result.status] || 'pending';
          setExecutionStatus(mappedStatus);
          setExecutionNotes(result.actual_result || result.comments || '');
          setAssignee(result.executed_by?.toString() || '');
          
          console.log('✅ Loaded existing status:', mappedStatus);
        } else {
          console.log('📝 No existing execution found, starting fresh');
          setExecutionStatus('pending');
          setExecutionNotes('');
          setAssignee('');
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    loadExistingExecution();
  }, [testRunId, testCaseId]);

  // Load existing defects for this test case
  useEffect(() => {
    const loadExistingDefects = async () => {
      if (!projectId || !testCaseId) return;
      
      try {
        console.log('🔍 Loading existing defects for test case:', testCaseId);
        const allDefects = await defectsAPI.getAll(parseInt(projectId));
        
        // Filter defects for this test case
        const testCaseDefects = allDefects.filter(defect => 
          defect.test_case_id === parseInt(testCaseId || '0')
        );
        
        setDefects(testCaseDefects);
        console.log(`✅ Loaded ${testCaseDefects.length} defects for test case`);
      } catch (error) {
        console.error('❌ Failed to load existing defects:', error);
        setDefects([]);
      }
    };
    
    loadExistingDefects();
  }, [projectId, testCaseId]);

  // Mock saved executions (persisted data)
  const [savedExecutions, setSavedExecutions] = useState<any[]>(() => {
    const saved = localStorage.getItem('testExecutions');
    return saved ? JSON.parse(saved) : [];
  });

  // Get current test case index for navigation
  const currentIndex = allTestCases.findIndex(tc => tc.id.toString() === testCaseId?.toString());
  const hasNext = currentIndex >= 0 && currentIndex < allTestCases.length - 1;
  const hasPrevious = currentIndex > 0;

  const statusOptions = [
    { value: 'pending', label: 'Pending', icon: Clock, color: 'text-gray-600' },
    { value: 'passed', label: 'Passed', icon: CheckCircle, color: 'text-green-600' },
    { value: 'failed', label: 'Failed', icon: XCircle, color: 'text-red-600' },
    { value: 'blocked', label: 'Blocked', icon: AlertTriangle, color: 'text-orange-600' }
  ];

  const getStatusIcon = (status: string) => {
    const statusOption = statusOptions.find(opt => opt.value === status);
    return statusOption ? <statusOption.icon className="h-5 w-5" /> : <Clock className="h-5 w-5" />;
  };

  const getStatusColor = (status: string) => {
    const statusOption = statusOptions.find(opt => opt.value === status);
    return statusOption ? statusOption.color : 'text-gray-600';
  };

  const formatStatusLabel = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    const labels: Record<string, string> = {
      not_tested: 'Not Tested',
      pass: 'Pass',
      passed: 'Passed',
      fail: 'Fail',
      failed: 'Failed',
      block: 'Block',
      blocked: 'Blocked',
      skip: 'Skip',
      skipped: 'Skipped',
      pending: 'Pending',
    };
    return labels[normalizedStatus] || status.replace('-', ' ').replace('_', ' ');
  };

  const getPriorityBadgeVariant = (priority: string) => {
    const priorityMap: Record<string, { variant: string; className: string }> = {
      'critical': { variant: 'destructive', className: 'bg-red-600 text-white' },
      'high': { variant: 'destructive', className: 'bg-orange-500 text-white' },
      'medium': { variant: 'default', className: 'bg-yellow-500 text-white' },
      'low': { variant: 'secondary', className: 'bg-blue-500 text-white' }
    };
    return priorityMap[priority?.toLowerCase()] || priorityMap['medium'];
  };

  const handleSaveExecution = async () => {
    console.log('🔥 handleSaveExecution called!');
    
    try {
      // Log the current state before saving
      console.log('=== SAVING EXECUTION ===');
      console.log('Test Run ID:', testRunId);
      console.log('Test Case ID:', testCaseId);
      console.log('Execution Status:', executionStatus);
      console.log('Execution Notes:', executionNotes);
      console.log('Assignee:', assignee);

      // Validate required fields
      if (!testRunId || !testCaseId) {
        console.error('❌ Missing testRunId or testCaseId');
        alert('Error: Missing test run ID or test case ID');
        return;
      }

      if (executionStatus === 'pending') {
        console.error('❌ Cannot save with pending status');
        alert('Please set a status before saving (Passed, Failed, Blocked, etc.)');
        return;
      }

      // Map frontend status to backend status
      const statusMap: Record<string, string> = {
        'passed': 'pass',
        'failed': 'fail',
        'blocked': 'block',
        'pending': 'skip'
      };

      const executionData = {
        test_case_id: parseInt(testCaseId || '0'),
        test_run_id: parseInt(testRunId || '0'),
        status: statusMap[executionStatus] || 'skip',
        actual_result: executionNotes,
        comments: executionNotes,
        execution_time: 0, // Could calculate from logs or track time
        executed_by: parseInt(assignee) || null,
        logs: executionLogs
      };

      console.log('📤 Prepared execution data:', executionData);
      const authToken = localStorage.getItem('token');
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      };

      // First, let's test if the backend is reachable
      console.log('🔍 Testing backend connection...');
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const testResponse = await fetch(`${API_BASE_URL}/test-results`, {
          method: 'GET',
          headers: requestHeaders,
          mode: 'cors',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        console.log('✅ Backend test response status:', testResponse.status);
        if (!testResponse.ok) {
          throw new Error(`Backend returned ${testResponse.status}`);
        }
      } catch (connectionError) {
        console.error('❌ Backend connection failed:', connectionError);
        console.log('⚠️ Skipping connection test and trying direct API call...');
        // Don't return here, continue with the main logic
      }

      // Check if a test result already exists for this test case and test run
      console.log('🔍 Checking for existing results...');
      
      let savedResult: any = null;
      
      // Try direct fetch first to see if axios is the issue
      console.log('🔍 Testing direct fetch...');
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const directResponse = await fetch(`${API_BASE_URL}/test-results?test_run_id=${parseInt(testRunId || '0')}&test_case_id=${parseInt(testCaseId || '0')}`, {
          method: 'GET',
          headers: requestHeaders,
          mode: 'cors',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        if (!directResponse.ok) {
          const errorText = await directResponse.text();
          throw new Error(`Fetch existing result failed: ${directResponse.status} - ${errorText}`);
        }
        const directData = await directResponse.json();
        console.log('✅ Direct fetch results:', directData);
        const existingResults = directData;
        
        if (existingResults.length > 0) {
          // Update existing result using direct fetch
          console.log('🔄 Updating existing result with direct fetch...');
          const existingResult = existingResults[0];
          console.log('📤 Sending UPDATE request:', existingResult.id, executionData);
          
          const updateController = new AbortController();
          const updateTimeoutId = setTimeout(() => updateController.abort(), 10000);
          
          const updateResponse = await fetch(`${API_BASE_URL}/test-results/${existingResult.id}`, {
            method: 'PUT',
            headers: requestHeaders,
            mode: 'cors',
            signal: updateController.signal,
            body: JSON.stringify(executionData)
          });
          
          clearTimeout(updateTimeoutId);
          
          if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            console.error('❌ Error response body:', errorText);
            throw new Error(`Update failed: ${updateResponse.status} - ${errorText}`);
          }
          
          savedResult = await updateResponse.json();
          console.log('✅ Updated existing test result:', savedResult);
        } else {
          // Create new result using direct fetch
          console.log('➕ Creating new result with direct fetch...');
          console.log('📤 Sending CREATE request:', executionData);
          
          const requestBody = JSON.stringify(executionData);
          console.log('📤 Request body JSON:', requestBody);
          console.log('📤 Request body length:', requestBody.length);
          
          const createController = new AbortController();
          const createTimeoutId = setTimeout(() => createController.abort(), 10000);
          
          const createResponse = await fetch(`${API_BASE_URL}/test-results`, {
            method: 'POST',
            headers: requestHeaders,
            mode: 'cors',
            signal: createController.signal,
            body: requestBody
          });
          
          clearTimeout(createTimeoutId);
          
          console.log('📤 Response status:', createResponse.status);
          console.log('📤 Response headers:', createResponse.headers);
          
          if (!createResponse.ok) {
            const errorText = await createResponse.text();
            console.error('❌ Error response body:', errorText);
            throw new Error(`Create failed: ${createResponse.status} - ${errorText}`);
          }
          
          savedResult = await createResponse.json();
          console.log('✅ Created new test result:', savedResult);
        }
        
        // Also test with axios API for comparison
        console.log('🔍 Testing axios API...');
        const axiosResults = await testResultsAPI.getAll(
          parseInt(testRunId || '0'), 
          parseInt(testCaseId || '0')
        );
        console.log('📋 Axios results found:', axiosResults);
        
      } catch (fetchError) {
        console.error('❌ Direct fetch failed:', fetchError);
        throw fetchError;
      }

      // Get the savedResult from the fetch operations above
      // Note: savedResult is now available from the try block above

      // Also save additional data to localStorage for now (defects, logs, etc.)
      const additionalData = {
        test_case_id: testCaseId,
        test_run_id: testRunId,
        notes: executionNotes,
        logs: executionLogs,
        assignee: assignee,
        defect_link: defectLink,
        custom_link: customLink,
        defects: defects,
        saved_at: new Date().toISOString(),
        backend_result_id: savedResult.id
      };

      const saved = localStorage.getItem('testExecutions');
      const executions = saved ? JSON.parse(saved) : [];
      const updatedExecutions = executions.filter(
        (exec: any) => exec.test_case_id !== testCaseId || exec.test_run_id !== testRunId
      );
      updatedExecutions.push(additionalData);
      localStorage.setItem('testExecutions', JSON.stringify(updatedExecutions));

      console.log('🎉 === SAVE COMPLETED SUCCESSFULLY ===');
      toast({
        title: t('executionSaved'),
        description: t('executionSavedDescription'),
        variant: 'success',
      });
    } catch (error) {
      console.error('💥 === SAVE FAILED ===');
      console.error('Error details:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Network Error')) {
          alert('Network error: Cannot connect to backend server. Please ensure the backend is running on ' + API_BASE_URL);
        } else if (error.message.includes('404')) {
          alert('API endpoint not found. Please check if the backend API is properly configured.');
        } else if (error.message.includes('CORS')) {
          alert('CORS error: Please check backend CORS configuration.');
        } else {
          alert(`Error saving execution: ${error.message}`);
        }
      } else {
        alert('Unknown error occurred while saving execution. Please check the console for details.');
      }
    }
  };

  const handleCreateDefect = async () => {
    // Check for duplicate title
    const isDuplicate = defects.some(d => 
      d.title.toLowerCase().trim() === newDefect.title.toLowerCase().trim()
    );
    
    if (isDuplicate) {
      toast({
        title: t('duplicateDefect'),
        description: t('defectWithThisTitleAlreadyExists'),
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsCreating(true);
      // Create defect via API
      const defectData = {
        defect_id: `DEF-${Date.now().toString().slice(-4)}`,
        title: newDefect.title,
        description: newDefect.description,
        severity: newDefect.severity,
        priority: newDefect.priority,
        test_case_id: parseInt(testCaseId || '0'),
        test_run_id: parseInt(testRunId || '0'),
        project_id: parseInt(projectId || '0'),
        reported_by: currentUser?.id || 1,
      };
      
      const createdDefect = await defectsAPI.create(defectData);
      
      // Add to local state
      setDefects([...defects, createdDefect]);
      setNewDefect({ title: '', description: '', severity: 'medium', priority: 'high' });
      setHasUnsavedChanges(false);
      setIsDefectDialogOpen(false);
      
      toast({
        title: t('success'),
        description: t('defectReportedSuccessfully'),
      });
    } catch (error) {
      console.error('Failed to create defect:', error);
      toast({
        title: t('error'),
        description: t('failedToCreateDefect'),
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open && hasUnsavedChanges) {
      setShowUnsavedDialog(true);
    } else {
      setIsDefectDialogOpen(open);
      if (!open) {
        setNewDefect({ title: '', description: '', severity: 'medium', priority: 'high' });
        setHasUnsavedChanges(false);
        setDefectTouchedFields({});
      }
    }
  };

  const handleUnsavedConfirm = (discard: boolean) => {
    setShowUnsavedDialog(false);
    if (discard) {
      setNewDefect({ title: '', description: '', severity: 'medium', priority: 'high' });
      setHasUnsavedChanges(false);
      setDefectTouchedFields({});
      setIsDefectDialogOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleCreateDefect();
    }
  };

  const handleEditTestCase = () => {
    navigate(`/projects/${projectId}/test-cases/${testCaseId}/edit`);
  };

  const handleDeleteDefect = (defectId: number) => {
    if (!confirm('Are you sure you want to delete this defect?')) return;
    setDefects(defects.filter(d => d.id !== defectId));
  };

  // Navigation functions
  const handleNextTestCase = () => {
    console.log('Next clicked - currentIndex:', currentIndex, 'hasNext:', hasNext, 'allTestCases:', allTestCases);
    if (hasNext && currentIndex >= 0) {
      const nextCase = allTestCases[currentIndex + 1];
      console.log('Next case:', nextCase);
      if (nextCase) {
        navigate(`/projects/${projectId}/test-runs/${testRunId}/test-cases/${nextCase.id}`);
      }
    }
  };

  const handlePreviousTestCase = () => {
    console.log('Previous clicked - currentIndex:', currentIndex, 'hasPrevious:', hasPrevious);
    if (hasPrevious && currentIndex >= 0) {
      const prevCase = allTestCases[currentIndex - 1];
      console.log('Previous case:', prevCase);
      if (prevCase) {
        navigate(`/projects/${projectId}/test-runs/${testRunId}/test-cases/${prevCase.id}`);
      }
    }
  };

  const handleSaveAndNext = () => {
    handleSaveExecution();
    setTimeout(() => {
      if (hasNext) {
        handleNextTestCase();
      }
    }, 500); // Small delay to show success message
  };

  const handleSaveAndPrevious = () => {
    handleSaveExecution();
    setTimeout(() => {
      if (hasPrevious) {
        handlePreviousTestCase();
      }
    }, 500); // Small delay to show success message
  };

  const selectedStatus = statusOptions.find(opt => opt.value === executionStatus);
  const testRunName = testRun?.name || t('loading');
  const testCaseTitle = testCase?.title || t('loading');
  const progressLabel = allTestCases.length > 0 && currentIndex >= 0
    ? t('testCaseProgress', { current: currentIndex + 1, total: allTestCases.length })
    : t('loadingTestCases');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-cyan-50 to-slate-100 p-5 text-slate-950 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950 dark:text-white dark:shadow-black/30 sm:p-6">
        <div className="pointer-events-none absolute -top-24 h-56 w-56 rounded-full bg-cyan-300/40 blur-3xl dark:bg-cyan-400/20 ltr:right-10 rtl:left-10" />
        <div className="pointer-events-none absolute -bottom-24 h-56 w-56 rounded-full bg-amber-200/40 blur-3xl dark:bg-amber-300/10 ltr:left-10 rtl:right-10" />

        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1 space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/projects/${projectId}/test-runs/${testRunId}`)}
              className="w-fit bg-slate-900/5 text-slate-700 hover:bg-slate-900/10 hover:text-slate-950 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 dark:hover:text-white"
            >
              <ArrowLeft className={`h-4 w-4 ${isRTL ? 'ml-2 rotate-180' : 'mr-2'}`} />
              {t('backToTestRun')}
            </Button>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="border border-cyan-200 bg-cyan-100/80 px-3 py-1 text-cyan-800 shadow-sm backdrop-blur dark:border-cyan-200/30 dark:bg-cyan-300/15 dark:text-cyan-50">
                  {t('testCaseExecution')}
                </Badge>
                <Badge className="border border-slate-200 bg-white/80 px-3 py-1 text-slate-700 shadow-sm backdrop-blur dark:border-white/20 dark:bg-white/10 dark:text-white">
                  {selectedStatus?.label || executionStatus}
                </Badge>
                <Badge className="border border-emerald-200 bg-emerald-100/80 px-3 py-1 text-emerald-800 shadow-sm backdrop-blur dark:border-emerald-200/30 dark:bg-emerald-300/15 dark:text-emerald-50">
                  {progressLabel}
                </Badge>
              </div>

              <div className="max-w-4xl space-y-2">
                <button
                  type="button"
                  onClick={() => navigate(`/projects/${projectId}/test-cases/${testCaseId}`)}
                  className="group inline-flex max-w-full items-center gap-2 text-left text-3xl font-black leading-tight tracking-tight text-slate-950 hover:text-cyan-700 dark:text-white dark:hover:text-cyan-200 sm:text-4xl"
                  title={testCaseTitle}
                >
                  <span className="truncate">{testCaseTitle}</span>
                  <Link className="h-4 w-4 flex-shrink-0 opacity-60 transition-opacity group-hover:opacity-100" />
                </button>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm leading-6 text-slate-600 dark:text-slate-200 sm:text-base">
                  <span className="font-semibold text-slate-700 dark:text-slate-100">{t('testRunLabel')}:</span>
                  <button
                    type="button"
                    onClick={() => navigate(`/projects/${projectId}/test-runs/${testRunId}`)}
                    className="inline-flex max-w-full items-center gap-1.5 font-medium text-cyan-700 hover:text-cyan-900 hover:underline dark:text-cyan-200 dark:hover:text-cyan-100"
                    title={testRunName}
                  >
                    <span className="truncate">{testRunName}</span>
                    <Link className="h-3.5 w-3.5 flex-shrink-0" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 sm:text-sm">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1.5 shadow-sm ring-1 ring-slate-200/80 backdrop-blur dark:bg-white/10 dark:ring-white/10">
                  <FileText className="h-4 w-4 text-cyan-600 dark:text-cyan-200" />
                  {t('testCaseLabel')}: TC-{testCaseId}
                </span>
                <div className="hidden gap-1 sm:flex" aria-hidden="true">
                  {allTestCases.map((_, index) => (
                    <div
                      key={index}
                      className={`h-2 w-2 rounded-full transition-colors duration-200 ${
                        index === currentIndex
                          ? 'bg-cyan-600 ring-2 ring-cyan-200 dark:bg-cyan-300 dark:ring-cyan-800'
                          : index < currentIndex
                          ? 'bg-emerald-500 dark:bg-emerald-500'
                          : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-auto xl:min-w-[520px] xl:grid-cols-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousTestCase}
              disabled={!hasPrevious}
              className="h-11 justify-center rounded-xl border-slate-200 bg-white/80 text-slate-700 hover:bg-white hover:text-slate-950 disabled:bg-slate-100/70 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 dark:hover:text-white dark:disabled:bg-white/5"
            >
              <ChevronLeft className={`h-4 w-4 ${isRTL ? 'ml-2 rotate-180' : 'mr-2'}`} />
              {t('previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextTestCase}
              disabled={!hasNext}
              className="h-11 justify-center rounded-xl border-slate-200 bg-white/80 text-slate-700 hover:bg-white hover:text-slate-950 disabled:bg-slate-100/70 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 dark:hover:text-white dark:disabled:bg-white/5"
            >
              {t('next')}
              <ChevronRight className={`h-4 w-4 ${isRTL ? 'mr-2 rotate-180' : 'ml-2'}`} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEditTestCase}
              className="h-11 justify-center rounded-xl border-slate-200 bg-white/80 text-slate-700 hover:bg-white hover:text-slate-950 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 dark:hover:text-white"
            >
              <Edit className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('edit')}
            </Button>
            <Button
              onClick={handleSaveExecution}
              disabled={executionStatus === 'pending'}
              className="h-11 justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-300 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
              size="sm"
            >
              <Save className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('save')}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Test Case Details */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Test Case Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {testCase ? (
                <>
                  <div>
                    <h3 className="font-semibold text-sm">{testCase.title}</h3>
                    <p className="text-gray-600 text-xs mt-1">{testCase.description || 'No description provided'}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium text-gray-700">Priority</Label>
                      <div className="mt-1">
                        <Badge className={`text-xs ${getPriorityBadgeVariant(testCase.priority).className}`}>
                          {testCase.priority?.toUpperCase() || 'MEDIUM'}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-gray-700">Status</Label>
                      <div className="mt-1">
                        <Badge variant="outline" className="text-xs">
                          {testCase.status || 'Active'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {testCase.preconditions && (
                    <div>
                      <Label className="text-xs font-medium text-gray-700">Preconditions</Label>
                      <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded mt-1">
                        {testCase.preconditions}
                      </p>
                    </div>
                  )}

                  {testCase.is_multistep ? (
                    testSteps.length > 0 ? (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Label className="text-xs font-medium text-gray-700">Test Steps</Label>
                          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-0.5 text-xs">
                            Multistep
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          {testSteps.map((step) => (
                            <div key={step.step_number} className="border border-gray-200 dark:border-gray-700 rounded p-2 bg-gray-50 dark:bg-gray-900/50">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="flex items-center justify-center w-5 h-5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-full">
                                  {step.step_number}
                                </span>
                                <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 px-1 py-0.5 text-xs">
                                  {step.step_type}
                                </Badge>
                              </div>
                              <div className="space-y-1">
                                <div>
                                  <span className="text-xs font-medium text-gray-600">Action:</span>
                                  <p className="text-xs text-gray-600 mt-0.5">{step.action}</p>
                                </div>
                                <div>
                                  <span className="text-xs font-medium text-gray-600">Expected:</span>
                                  <p className="text-xs text-gray-600 mt-0.5">{step.expected_result}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Label className="text-xs font-medium text-gray-700">Test Steps</Label>
                        <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded mt-1">
                          No multistep data available
                        </p>
                      </div>
                    )
                  ) : testCase.steps && (
                    <div>
                      <Label className="text-xs font-medium text-gray-700">Test Steps</Label>
                      <pre className="text-xs text-gray-600 bg-gray-50 p-2 rounded whitespace-pre-wrap mt-1">
                        {testCase.steps}
                      </pre>
                    </div>
                  )}

                  {!testCase.is_multistep && testCase.expected_result && (
                    <div>
                      <Label className="text-xs font-medium text-gray-700">Expected Result</Label>
                      <p className="text-xs text-gray-600 bg-green-50 p-2 rounded mt-1">
                        {testCase.expected_result}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">Loading test case details...</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Execution Form */}
          <Card className="overflow-hidden border-slate-200/80 shadow-sm dark:border-slate-800">
            <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 via-cyan-50/60 to-white pb-4 dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-950 dark:text-slate-50">
                    <Save className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
                    {t('executionDetails')}
                  </CardTitle>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t('executionDetailsDescription')}
                  </p>
                </div>
                <Badge className="w-fit border border-cyan-200 bg-cyan-100/80 px-3 py-1 text-cyan-800 shadow-sm dark:border-cyan-200/30 dark:bg-cyan-300/15 dark:text-cyan-50">
                  {selectedStatus?.label || executionStatus}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-4 sm:p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white/80 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
                  <Label htmlFor="status" className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t('executionStatusLabel')}
                  </Label>
                  <Select value={executionStatus} onValueChange={setExecutionStatus}>
                    <SelectTrigger className="mt-2 h-10 text-sm">
                      <SelectValue placeholder={t('selectStatus')} />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <option.icon className={`h-3.5 w-3.5 ${option.color}`} />
                            <span className="text-sm">{option.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white/80 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
                  <Label htmlFor="assignee" className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t('assigneeLabel')}
                  </Label>
                  <Select value={assignee} onValueChange={setAssignee}>
                    <SelectTrigger className="mt-2 h-10 text-sm">
                      <SelectValue placeholder={t('selectAssignee')} />
                    </SelectTrigger>
                    <SelectContent>
                      {currentUser && (
                        <SelectItem key="me" value={currentUser.id.toString()}>
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5" />
                            <span className="text-sm font-medium">
                              Me ({currentUser.username || currentUser.email || 'Unknown User'})
                            </span>
                          </div>
                        </SelectItem>
                      )}
                      {users.filter(u => u.id !== currentUser?.id).map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5" />
                            <span className="text-sm">
                              {user.full_name || user.username || user.email || `User ${user.id}`}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Show link fields only when failed or blocked */}
              {(executionStatus === 'failed' || executionStatus === 'blocked') && (
                <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-orange-50 p-4 shadow-sm dark:border-red-900/60 dark:from-red-950/30 dark:to-orange-950/20">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-800 dark:text-red-200">
                    <AlertTriangle className="h-4 w-4" />
                    {t('failureContext')}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label htmlFor="defectLink" className="text-xs font-semibold text-red-700 dark:text-red-200">
                        {t('defectLinkLabel')}
                      </Label>
                      <Input
                        id="defectLink"
                        value={defectLink}
                        onChange={(e) => setDefectLink(e.target.value)}
                        placeholder={t('defectLinkPlaceholder')}
                        className="mt-1 h-9 border-red-200 bg-white/90 text-sm dark:border-red-900/70 dark:bg-slate-950/60"
                      />
                    </div>
                    <div>
                      <Label htmlFor="customLink" className="text-xs font-semibold text-red-700 dark:text-red-200">
                        {t('customLinkLabel')}
                      </Label>
                      <Input
                        id="customLink"
                        value={customLink}
                        onChange={(e) => setCustomLink(e.target.value)}
                        placeholder={t('customLinkPlaceholder')}
                        className="mt-1 h-9 border-red-200 bg-white/90 text-sm dark:border-red-900/70 dark:bg-slate-950/60"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t('executionNotesLabel')}
                  </Label>
                  <Textarea
                    id="notes"
                    value={executionNotes}
                    onChange={(e) => setExecutionNotes(e.target.value)}
                    placeholder={t('executionNotesPlaceholder')}
                    rows={5}
                    className="resize-none text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logs" className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t('executionLogsLabel')}
                  </Label>
                  <Textarea
                    id="logs"
                    value={executionLogs}
                    onChange={(e) => setExecutionLogs(e.target.value)}
                    placeholder={t('executionLogsPlaceholder')}
                    rows={5}
                    className="resize-none font-mono text-xs"
                  />
                </div>
              </div>

              {/* Prominent Save Button */}
              <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
                <Button
                  onClick={handleSaveExecution}
                  disabled={executionStatus === 'pending'}
                  className="h-11 w-full rounded-xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-300 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
                >
                  <Save className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {t('saveExecution')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Defects Section */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bug className="h-4 w-4" />
                  Defects Found ({defects.length})
                </CardTitle>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsDefectDialogOpen(true)}
                  className="h-8 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Report Defect
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {defects.length === 0 ? (
                <p className="text-gray-500 text-center py-3 text-xs">No defects reported</p>
              ) : (
                <div className="space-y-2">
                  {defects.map((defect) => (
                    <div key={defect.id} className="border rounded-lg p-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs">{defect.defect_id}</span>
                            <Badge variant="outline" className="text-xs">{defect.severity}</Badge>
                            <Badge variant="outline" className="text-xs">{defect.priority}</Badge>
                          </div>
                          <h4 className="font-medium text-sm">{defect.title}</h4>
                          <p className="text-xs text-gray-600 mt-1">{defect.description}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteDefect(defect.id)}
                          className="h-7 w-7 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Status Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Current Status</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${getStatusColor(executionStatus)} bg-opacity-10 mb-3`}>
                {getStatusIcon(executionStatus)}
              </div>
              <h3 className="text-sm font-semibold capitalize">{executionStatus}</h3>
              {selectedStatus && (
                <p className="text-xs text-gray-600 mt-1">{selectedStatus.label}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start h-8 text-xs"
                onClick={() => setExecutionStatus('passed')}
              >
                <CheckCircle className="h-3 w-3 mr-2 text-green-600" />
                Mark as Passed
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start h-8 text-xs"
                onClick={() => setExecutionStatus('failed')}
              >
                <XCircle className="h-3 w-3 mr-2 text-red-600" />
                Mark as Failed
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start h-8 text-xs"
                onClick={() => setIsDefectDialogOpen(true)}
              >
                <Bug className="h-3 w-3 mr-2 text-orange-600" />
                Report Defect
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start h-8 text-xs"
                onClick={() => setExecutionStatus('blocked')}
              >
                <AlertTriangle className="h-3 w-3 mr-2 text-orange-600" />
                Mark as Blocked
              </Button>
            </CardContent>
          </Card>

          {/* Execution History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Execution History</CardTitle>
            </CardHeader>
            <CardContent>
              {executionHistory.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-2">No execution history</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {executionHistory.map((item, index) => (
                    <div key={item.id} className="border-l-2 border-gray-200 pl-3 pb-2">
                      <div className="flex items-center gap-2 mb-1">
                        {item.status === 'pass' && <CheckCircle className="h-3 w-3 text-green-600" />}
                        {item.status === 'fail' && <XCircle className="h-3 w-3 text-red-600" />}
                        {item.status === 'block' && <AlertTriangle className="h-3 w-3 text-orange-600" />}
                        {item.status === 'skip' && <Clock className="h-3 w-3 text-gray-600" />}
                        <Badge variant="outline" className="text-xs">
                          {formatStatusLabel(item.status)}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">{item.executed_by || 'Unknown'}</span>
                        {item.test_run_name && (
                          <span className="text-gray-500"> in {item.test_run_name}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.executed_at ? new Date(item.executed_at).toLocaleString() : 'N/A'}
                      </p>
                      {item.comments && (
                        <p className="text-xs text-gray-600 mt-1 italic">"{item.comments}"</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Defect Dialog */}
      <Dialog open={isDefectDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent isRTL={isRTL} className="sm:max-w-[500px]" onKeyDown={handleKeyDown}>
          <DialogHeader>
            <DialogTitle>Report New Defect</DialogTitle>
            <DialogDescription>
              Document a defect found during test execution.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="defectTitle" className="text-right">
                Title
              </Label>
              <div className="col-span-3 space-y-1">
                <Input
                  ref={defectTitleInputRef}
                  id="defectTitle"
                  value={newDefect.title}
                  onChange={(e) => setNewDefect({...newDefect, title: e.target.value})}
                  onBlur={() => setDefectTouchedFields({...defectTouchedFields, title: true})}
                  className={defectTouchedFields.title && newDefect.title.trim() === '' ? 'border-red-300 focus:border-red-500' : ''}
                  placeholder="Enter defect title"
                  maxLength={200}
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Enter defect title</span>
                  <span>{newDefect.title.length}/200</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="defectDescription" className="text-right pt-2">
                Description
              </Label>
              <div className="col-span-3 space-y-1">
                <Textarea
                  id="defectDescription"
                  value={newDefect.description}
                  onChange={(e) => setNewDefect({...newDefect, description: e.target.value})}
                  placeholder="Describe the defect"
                  rows={3}
                  maxLength={1000}
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Describe the defect</span>
                  <span>{newDefect.description.length}/1000</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="severity" className="text-right">
                Severity
              </Label>
              <Select value={newDefect.severity} onValueChange={(value) => setNewDefect({...newDefect, severity: value})}>
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="priority" className="text-right">
                Priority
              </Label>
              <Select value={newDefect.priority} onValueChange={(value) => setNewDefect({...newDefect, priority: value})}>
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="text-xs text-gray-500 mb-2 sm:mb-0 sm:mr-auto">
              Ctrl+Enter to submit
            </div>
            <Button variant="outline" onClick={() => handleDialogClose(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateDefect} disabled={!newDefect.title.trim() || isCreating} className="transition-all duration-200">
              {isCreating ? 'Creating...' : 'Report Defect'}
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
  );
}
