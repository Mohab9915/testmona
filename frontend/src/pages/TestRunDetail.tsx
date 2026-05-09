import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Clock, 
  User, 
  Calendar,
  BarChart3,
  Download,
  RefreshCw,
  PlayCircle,
  Plus,
  Trash2
} from 'lucide-react';
import { TestRunPieChart, TestRunBarChart, TestRunTrendChart } from '@/components/ui/chart';
import { useTranslation } from '@/hooks/useTranslation';
import { testRunsAPI, testResultsAPI, usersAPI } from '@/lib/api';
import { TestResult } from '@/types/index';

interface TestRun {
  id: string;
  name: string;
  description?: string;
  status: 'in-progress' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  completedAt?: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  blockedTests: number;
  skippedTests: number;
  inProgressTests: number;
  testResults: TestResult[];
  environment?: string;
  testSuite?: string;
  executedBy?: string;
}

export function TestRunDetail() {
  const { id, projectId } = useParams<{ id: string; projectId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [testRun, setTestRun] = useState<any>(null);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [chartFilter, setChartFilter] = useState<string>('all'); // New state for chart filtering
  const [isAddTestCasesOpen, setIsAddTestCasesOpen] = useState(false);
  const [selectedTestCasesForRemoval, setSelectedTestCasesForRemoval] = useState<number[]>([]);
  const [availableTestCases, setAvailableTestCases] = useState<any[]>([]);
  const [selectedTestCasesToAdd, setSelectedTestCasesToAdd] = useState<number[]>([]);
  const [searchTestCases, setSearchTestCases] = useState('');
  const [sections, setSections] = useState<any[]>([]);

  // Prepare chart data
  const prepareChartData = () => {
    if (!testResults.length) {
      return { pieData: [], sectionData: [], trendData: [] };
    }

    // Calculate status counts - normalize status values
    const statusCounts = testResults.reduce((acc: any, result) => {
      const normalizedStatus = result.status.toLowerCase();
      acc[normalizedStatus] = (acc[normalizedStatus] || 0) + 1;
      return acc;
    }, {});

    // Pie chart data
    const pieData = [
      { name: 'Passed', value: (statusCounts.pass || statusCounts.passed || 0), color: '#10b981' },
      { name: 'Failed', value: (statusCounts.fail || statusCounts.failed || 0), color: '#ef4444' },
      { name: 'Blocked', value: (statusCounts.block || statusCounts.blocked || 0), color: '#f59e0b' },
      { name: 'Skipped', value: (statusCounts.skip || statusCounts.skipped || 0), color: '#6b7280' },
      { name: 'Not Tested', value: (statusCounts.not_tested || 0), color: '#9ca3af' },
    ].filter(item => item.value > 0);

    // Bar chart data by section
    const sectionData = testResults.reduce((acc: any[], result) => {
      // Get section name from the test_case object
      let sectionName = 'No Section';
      
      // First try to get section from the nested section object (preferred)
      if (result.test_case?.section?.name) {
        sectionName = result.test_case.section.name;
      } else if (result.test_case?.section_id) {
        // Fallback: try to find section name from sections array
        const section = sections.find(s => s.id === result.test_case.section_id);
        if (section) {
          sectionName = section.name;
        } else {
          // Last resort: use section ID
          sectionName = `Section ${result.test_case.section_id}`;
        }
      }
      
      const normalizedStatus = result.status.toLowerCase();
      const existingSection = acc.find(item => item.name === sectionName);
      
      if (existingSection) {
        existingSection[normalizedStatus] = (existingSection[normalizedStatus] || 0) + 1;
        existingSection.total++;
      } else {
        acc.push({
          name: sectionName,
          pass: normalizedStatus === 'pass' || normalizedStatus === 'passed' ? 1 : 0,
          fail: normalizedStatus === 'fail' || normalizedStatus === 'failed' ? 1 : 0,
          block: normalizedStatus === 'block' || normalizedStatus === 'blocked' ? 1 : 0,
          skip: normalizedStatus === 'skip' || normalizedStatus === 'skipped' ? 1 : 0,
          not_tested: normalizedStatus === 'not_tested' ? 1 : 0,
          total: 1,
        });
      }
      return acc;
    }, []);

    // Calculate pass rate by section
    sectionData.forEach(section => {
      section.passRate = section.total > 0 ? Math.round((section.pass / section.total) * 100) : 0;
    });

    // Trend data - use actual historical data if available, otherwise show current only
    // For now, we'll show just the current pass rate as a single point
    const trendData = [
      { 
        date: testRun?.created_at ? new Date(testRun.created_at).toLocaleDateString() : 'Current', 
        passRate, 
        totalTests 
      },
    ];

    return { pieData, sectionData, trendData };
  };  
  // Function to check and update test run status
  const checkAndUpdateStatus = async () => {
    if (!id) return;
    
    try {
      const testResultsData = await testResultsAPI.getAll(parseInt(id));
      const testRunData = await testRunsAPI.getById(parseInt(id));
      
      const currentStatus = testRunData.status?.toLowerCase().replace('-', '_');
      if (currentStatus !== 'completed' && testResultsData.length > 0) {
        const allCompleted = testResultsData.every((result: any) => {
          const status = result.status.toLowerCase();
          return status !== 'not_tested' && status !== 'pending';
        });
        
        if (allCompleted) {
          await testRunsAPI.update(parseInt(id), {
            status: 'completed',
            completed_at: new Date().toISOString()
          });
          
          // Reload test run to get updated status
          const updatedTestRun = await testRunsAPI.getById(parseInt(id));
          setTestRun(updatedTestRun);
          setTestResults(testResultsData);
        } else {
          setTestResults(testResultsData);
        }
      } else {
        setTestResults(testResultsData);
      }
    } catch (error) {
      console.error('Failed to check/update status:', error);
    }
  };
  
  useEffect(() => {
    const loadData = async () => {
      if (!id || !projectId) {
        setError('Missing test run ID or project ID');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Load test run data
        const testRunData = await testRunsAPI.getById(parseInt(id));
        
        // Load test results for this test run
        const testResultsData = await testResultsAPI.getAll(parseInt(id));
        
        // Load users for dropdown
        const usersData = await usersAPI.getAll();
        
        setTestRun(testRunData);
        setTestResults(testResultsData);
        setUsers(usersData);
        
        // Auto-update test run status if all tests are completed
        console.log('🔍 Checking test run status:', testRunData.status);
        console.log('📊 Test results count:', testResultsData.length);
        
        const currentStatus = testRunData.status?.toLowerCase().replace('-', '_');
        if (currentStatus !== 'completed' && testResultsData.length > 0) {
          console.log('✅ Test run not completed, checking if all tests are done...');
          
          const allCompleted = testResultsData.every((result: any) => {
            const status = result.status.toLowerCase();
            const isCompleted = status !== 'not_tested' && status !== 'pending';
            console.log(`  Test ${result.test_case_id}: ${status} - ${isCompleted ? 'completed' : 'not completed'}`);
            return isCompleted;
          });
          
          console.log('🎯 All tests completed?', allCompleted);
          
          if (allCompleted) {
            console.log('🚀 Updating test run status to completed...');
            
            try {
              await testRunsAPI.update(parseInt(id), {
                status: 'completed',
                completed_at: new Date().toISOString()
              });
              
              console.log('✅ Test run status updated successfully');
              
              // Reload test run to get updated status
              const updatedTestRun = await testRunsAPI.getById(parseInt(id));
              setTestRun(updatedTestRun);
              console.log('📥 Reloaded test run:', updatedTestRun);
            } catch (updateError) {
              console.error('❌ Failed to auto-update test run status:', updateError);
            }
          } else {
            console.log('⏳ Not all tests are completed yet');
          }
        } else {
          console.log('ℹ️ Test run already completed or no test results');
        }
      } catch (err) {
        console.error('Failed to load test run data:', err);
        setError('Failed to load test run data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
    
    // Set up interval to check status every 5 seconds
    const interval = setInterval(checkAndUpdateStatus, 5000);
    return () => clearInterval(interval);
  }, [id, projectId]);

  // Load sections for chart data
  useEffect(() => {
    const loadSections = async () => {
      if (projectId) {
        try {
          const { sectionsAPI } = await import('@/lib/api');
          const sectionsData = await sectionsAPI.getProjectSectionHierarchy(parseInt(projectId));
          const allSections: any[] = [];
          
          // Flatten sections from hierarchy
          const flattenSections = (hierarchy: any[]) => {
            hierarchy.forEach((item: any) => {
              if (item.sections) {
                item.sections.forEach((section: any) => {
                  allSections.push({
                    id: section.id,
                    name: section.name,
                    test_suite_id: item.test_suite?.id
                  });
                  if (section.subsections) {
                    const flattenSubsections = (subsections: any[], parentName: string) => {
                      subsections.forEach((sub: any) => {
                        allSections.push({
                          id: sub.id,
                          name: `${parentName} > ${sub.name}`,
                          test_suite_id: item.test_suite?.id
                        });
                        if (sub.subsections) {
                          flattenSubsections(sub.subsections, `${parentName} > ${sub.name}`);
                        }
                      });
                    };
                    flattenSubsections(section.subsections, section.name);
                  }
                });
              }
            });
          };
          
          flattenSections(sectionsData.hierarchy || []);
          setSections(allSections);
        } catch (err) {
          console.error('Failed to load sections:', err);
        }
      }
    };

    loadSections();
  }, [projectId]);

  // Load available test cases when dialog opens
  useEffect(() => {
    const loadAvailableTestCases = async () => {
      if (isAddTestCasesOpen && projectId) {
        try {
          const { testCasesAPI } = await import('@/lib/api');
          const allTestCases = await testCasesAPI.getAll();
          
          // Filter out test cases that are already in this test run
          const existingTestCaseIds = testResults.map(r => r.test_case_id);
          const available = allTestCases.filter(tc => !existingTestCaseIds.includes(tc.id));
          
          setAvailableTestCases(available);
        } catch (err) {
          console.error('Failed to load available test cases:', err);
        }
      }
    };

    loadAvailableTestCases();
  }, [isAddTestCasesOpen, projectId, testResults]);

  const getStatusIcon = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    switch (normalizedStatus) {
      case 'pass':
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'fail':
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'block':
      case 'blocked':
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      case 'skip':
      case 'skipped':
        return <Clock className="h-4 w-4 text-gray-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-400" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    const variants: Record<string, string> = {
      pass: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      passed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      fail: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      block: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      blocked: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      skip: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
      skipped: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
      pending: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
    };
    return variants[normalizedStatus] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
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

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, string> = {
      low: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };
    return variants[priority] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  };

  const filteredResults = testResults.filter(result => {
    if (filter === 'all') return true;
    return result.status.toLowerCase() === filter.toLowerCase();
  });

  const statusCounts = testResults.reduce((acc: any, result) => {
    const normalizedStatus = result.status.toLowerCase();
    acc[normalizedStatus] = (acc[normalizedStatus] || 0) + 1;
    return acc;
  }, {});
  
  const totalTests = testResults.length;
  const passedTests = (statusCounts.pass || 0) + (statusCounts.passed || 0);
  const failedTests = (statusCounts.fail || 0) + (statusCounts.failed || 0);
  const blockedTests = (statusCounts.block || 0) + (statusCounts.blocked || 0);
  const skippedTests = (statusCounts.skip || 0) + (statusCounts.skipped || 0);
  const notTestedTests = statusCounts.not_tested || 0;
  const passRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
  const { pieData, sectionData, trendData } = prepareChartData();

  // Handle adding/removing test cases
  const handleAddTestCases = async () => {
    if (selectedTestCasesToAdd.length === 0) {
      setIsAddTestCasesOpen(false);
      return;
    }

    try {
      const testResultsPromises = selectedTestCasesToAdd.map(testCaseId =>
        testResultsAPI.create({
          test_run_id: parseInt(id!),
          test_case_id: testCaseId,
          status: 'not_tested',
          actual_result: undefined,
          comments: undefined,
          execution_time: undefined,
          executed_by: undefined,
        })
      );
      
      await Promise.all(testResultsPromises);
      
      // Reload test results
      const updatedTestResults = await testResultsAPI.getAll(parseInt(id!));
      setTestResults(updatedTestResults);
      
      setIsAddTestCasesOpen(false);
      setSelectedTestCasesToAdd([]);
    } catch (err) {
      console.error('Failed to add test cases:', err);
      setError('Failed to add test cases');
    }
  };

  const handleRemoveTestCases = async () => {
    if (selectedTestCasesForRemoval.length === 0) return;
    
    try {
      const deletePromises = selectedTestCasesForRemoval.map(resultId =>
        testResultsAPI.delete(resultId)
      );
      
      await Promise.all(deletePromises);
      
      // Reload test results
      const updatedTestResults = await testResultsAPI.getAll(parseInt(id!));
      setTestResults(updatedTestResults);
      
      setSelectedTestCasesForRemoval([]);
    } catch (err) {
      console.error('Failed to remove test cases:', err);
      setError('Failed to remove test cases');
    }
  };

  const handleSelectTestCaseForRemoval = (resultId: number) => {
    setSelectedTestCasesForRemoval(prev => 
      prev.includes(resultId) 
        ? prev.filter(id => id !== resultId)
        : [...prev, resultId]
    );
  };

  // Handle chart clicks for filtering
  const handleChartClick = (filterData: any) => {
    if (filterData.type === 'status') {
      // Map chart labels to backend status values
      const statusMap: Record<string, string> = {
        'passed': 'pass',
        'failed': 'fail',
        'blocked': 'block',
        'skipped': 'skip',
        'not tested': 'not_tested',
      };
      
      const normalizedStatus = filterData.value.toLowerCase();
      const mappedStatus = statusMap[normalizedStatus] || normalizedStatus;
      setFilter(mappedStatus);
    } else if (filterData.type === 'section') {
      // Filter by section - this would require a different filter approach
      console.log('Filter by section:', filterData.value);
    }
  };

  // Handle inline editing
  const [editingResult, setEditingResult] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ [key: string]: any }>({});

  const handleEdit = (resultId: string, field: string, value: any) => {
    setEditingResult(resultId);
    setEditValues(prev => ({ ...prev, [resultId]: { ...prev[resultId], [field]: value } }));
  };

  const handleSave = (resultId: string) => {
    const result = testRun?.testResults.find(r => r.id === resultId);
    if (result && editValues[resultId]) {
      // Update the result (in real app, this would be an API call)
      const updatedResult = { ...result, ...editValues[resultId] };
      
      // Update testRun state
      if (testRun) {
        const updatedTestResults = testRun.testResults.map(r => 
          r.id === resultId ? updatedResult : r
        );
        setTestRun({ ...testRun, testResults: updatedTestResults });
      }
      
      console.log('Updated test result:', updatedResult);
    }
    setEditingResult(null);
  };

  // Handle View Reports and Export Results
  const handleViewReports = () => {
    // Navigate to dedicated report page
    navigate(`/projects/${projectId}/test-runs/${id}/report`);
  };

  const handleExportResults = () => {
    if (!testRun) return;

    // Create CSV content
    const headers = ['Test Case ID', 'Test Case Title', 'Section', 'Priority', 'Status', 'Executed By', 'Executed At', 'Duration (s)', 'Comments'];
    const csvContent = [
      headers.join(','),
      ...testRun.testResults.map(result => [
        result.testCaseId,
        `"${result.testCaseTitle}"`,
        result.section || '',
        result.priority || 'medium',
        result.status,
        result.executedBy || '',
        result.executedAt || '',
        result.duration || '',
        `"${result.comments || ''}"`
      ].join(','))
    ].join('\n');

    // Create and download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-run-${testRun.id}-results.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert('Results exported successfully!');
  };

  const handleCancel = (resultId: string) => {
    setEditingResult(null);
    setEditValues(prev => {
      const newValues = { ...prev };
      delete newValues[resultId];
      return newValues;
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${projectId}/test-runs`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Test Runs
          </Button>
        </div>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !testRun) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${projectId}/test-runs`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Test Runs
          </Button>
        </div>
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            {error || 'Test Run Not Found'}
          </h2>
          <p className="text-gray-600">
            {error || 'The test run you\'re looking for doesn\'t exist.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 min-w-0 flex-1">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${projectId}/test-runs`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Test Runs
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold truncate" title={testRun.name}>
              {testRun.name}
            </h1>
            <p className="text-sm text-gray-600 truncate" title={testRun.description}>
              {testRun.description || 'No description'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={() => setIsAddTestCasesOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Test Cases
          </Button>
          {selectedTestCasesForRemoval.length > 0 && (
            <Button variant="destructive" size="sm" onClick={handleRemoveTestCases}>
              <Trash2 className="h-4 w-4 mr-2" />
              Remove Selected ({selectedTestCasesForRemoval.length})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExportResults}>
            <Download className="h-4 w-4 mr-2" />
            Export Results
          </Button>
          <Button variant="outline" size="sm" onClick={handleViewReports}>
            <BarChart3 className="h-4 w-4 mr-2" />
            View Report
          </Button>
          {testRun.status === 'completed' && (
            <Button size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Re-run Test
            </Button>
          )}
        </div>
      </div>

      {/* Test Run Information */}
      <div className="bg-white rounded-lg border p-4 space-y-3">
        <div className="flex flex-wrap gap-6 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>
              Created: {testRun.created_at ? new Date(testRun.created_at).toLocaleDateString() : 'N/A'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>
              {testRun.completed_at 
                ? `Completed: ${new Date(testRun.completed_at).toLocaleDateString()}`
                : 'Not completed'
              }
            </span>
          </div>
          {testRun.updated_at && testRun.updated_at !== testRun.created_at && (
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              <span>
                Last updated: {new Date(testRun.updated_at).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Status and Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            {getStatusIcon(testRun.status)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{testRun.status.replace('-', ' ')}</div>
            <p className="text-xs text-gray-500">
              {testRun.status === 'completed' 
                ? `Completed at ${testRun.completed_at ? new Date(testRun.completed_at).toLocaleString() : 'N/A'}`
                : `Started at ${testRun.created_at ? new Date(testRun.created_at).toLocaleString() : 'N/A'}`
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{passRate}%</div>
            <p className="text-xs text-gray-500">
              {passedTests} of {totalTests} passed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTests}</div>
            <div className="text-xs text-gray-500 space-y-1 mt-1">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>{passedTests} passed</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span>{failedTests} failed</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span>{blockedTests} blocked</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                <span>{skippedTests} skipped</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span>{notTestedTests} not tested</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Duration</CardTitle>
            <Clock className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {testRun?.completed_at 
                ? `${Math.round((new Date(testRun.completed_at).getTime() - new Date(testRun.created_at).getTime()) / 60000)}m`
                : testRun?.estimated_duration ? `${testRun.estimated_duration}m (estimated)` : 'In Progress'
              }
            </div>
            <p className="text-xs text-gray-500">
              {testRun?.environment || 'No environment'} • Priority: {testRun?.priority || 'medium'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TestRunPieChart 
          data={pieData} 
          title="Test Results Distribution" 
          onChartClick={handleChartClick}
        />
        <TestRunBarChart 
          data={sectionData} 
          title="Results by Section" 
          onChartClick={handleChartClick}
        />
        <TestRunTrendChart data={trendData} title="Pass Rate Trend" />
      </div>

      {/* Test Results */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Test Results</CardTitle>
            <div className="flex items-center space-x-2">
              <select 
                value={filter} 
                onChange={(e) => setFilter(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">All Tests ({totalTests})</option>
                <option value="pass">Passed ({passedTests})</option>
                <option value="fail">Failed ({failedTests})</option>
                <option value="block">Blocked ({blockedTests})</option>
                <option value="skip">Skipped ({skippedTests})</option>
                <option value="not_tested">Not Tested ({notTestedTests})</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={selectedTestCasesForRemoval.length === filteredResults.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTestCasesForRemoval(filteredResults.map(r => r.id));
                      } else {
                        setSelectedTestCasesForRemoval([]);
                      }
                    }}
                  />
                </TableHead>
                <TableHead>Test Case</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Executed By</TableHead>
                <TableHead>Actions</TableHead>
                <TableHead>Executed At</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Comments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResults.map((result) => (
                <TableRow key={result.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedTestCasesForRemoval.includes(result.id)}
                      onChange={() => handleSelectTestCaseForRemoval(result.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <Button 
                        variant="link" 
                        className="p-0 h-auto font-medium text-left text-blue-600 hover:text-blue-800"
                        onClick={() => {
                          // Navigate to test case execution page
                          if (result.test_case_id) {
                            navigate(`/projects/${projectId}/test-runs/${id}/test-cases/${result.test_case_id}`);
                          }
                        }}
                      >
                        {result.test_case?.title || 'Unknown Test Case'}
                      </Button>
                      <div className="text-sm text-gray-500">{result.test_case_id ? `TC-${result.test_case_id}` : 'N/A'}</div>
                    </div>
                  </TableCell>
                  <TableCell>{result.test_case?.section?.name || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge className={getPriorityBadge(result.test_case?.priority || 'medium')}>
                      {result.test_case?.priority || 'medium'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {editingResult === result.id ? (
                      <Select 
                        value={editValues[result.id]?.status || result.status} 
                        onValueChange={(value) => handleEdit(result.id, 'status', value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="passed">Passed</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                          <SelectItem value="blocked">Blocked</SelectItem>
                          <SelectItem value="skipped">Skipped</SelectItem>
                          <SelectItem value="in-progress">In Progress</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(result.status)}
                        <Badge className={getStatusBadge(result.status)}>
                          {formatStatusLabel(result.status)}
                        </Badge>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingResult === result.id ? (
                      <Select 
                        value={editValues[result.id]?.executed_by || result.executed_by?.toString() || ''} 
                        onValueChange={(value) => handleEdit(result.id, 'executed_by', value)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Select user" />
                        </SelectTrigger>
                        <SelectContent>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.full_name || user.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span>{result.executor?.full_name || result.executor?.username || 'Not executed'}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          // Navigate to test case execution
                          if (result.test_case_id) {
                            navigate(`/projects/${projectId}/test-runs/${id}/test-cases/${result.test_case_id}`);
                          }
                        }}
                      >
                        <PlayCircle className="h-4 w-4 mr-1" />
                        Execute
                      </Button>
                      {editingResult === result.id ? (
                        <div className="flex space-x-2">
                          <Button size="sm" onClick={() => handleSave(result.id)}>
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleCancel(result.id)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setEditingResult(result.id)}>
                          Edit
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>
                        {result.executed_at 
                          ? new Date(result.executed_at).toLocaleString()
                          : 'Not executed'
                        }
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {result.execution_time ? `${result.execution_time}s` : '-'}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="truncate" title={result.comments}>
                      {result.comments || '-'}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Test Cases Dialog */}
      {isAddTestCasesOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[80vh] flex flex-col">
            <h2 className="text-xl font-semibold mb-4">Add Test Cases to Test Run</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Select test cases to add to this test run ({selectedTestCasesToAdd.length} selected):
            </p>
            
            {/* Search */}
            <div className="mb-4">
              <Input
                placeholder="Search test cases..."
                value={searchTestCases}
                onChange={(e) => setSearchTestCases(e.target.value)}
                className="w-full"
              />
            </div>
            
            {/* Test Cases List - Grouped by Section */}
            <div className="flex-1 overflow-y-auto border rounded p-3 space-y-3">
              {availableTestCases.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No available test cases to add. All test cases may already be in this test run.
                </p>
              ) : (() => {
                // Filter test cases based on search
                const filteredTestCases = availableTestCases.filter(tc => 
                  tc.title.toLowerCase().includes(searchTestCases.toLowerCase()) ||
                  (tc.description && tc.description.toLowerCase().includes(searchTestCases.toLowerCase()))
                );

                // Group test cases by section
                const groupedTestCases: { [key: string]: any[] } = {};
                const noSectionKey = '__no_section__';
                
                filteredTestCases.forEach(tc => {
                  const section = sections.find(s => s.id === tc.section_id);
                  const key = section ? `${section.id}` : noSectionKey;
                  if (!groupedTestCases[key]) {
                    groupedTestCases[key] = [];
                  }
                  groupedTestCases[key].push(tc);
                });

                // Sort sections by name
                const sortedSectionKeys = Object.keys(groupedTestCases).sort((a, b) => {
                  if (a === noSectionKey) return 1;
                  if (b === noSectionKey) return -1;
                  const sectionA = sections.find(s => s.id === parseInt(a));
                  const sectionB = sections.find(s => s.id === parseInt(b));
                  return (sectionA?.name || '').localeCompare(sectionB?.name || '');
                });

                return sortedSectionKeys.map(sectionKey => {
                  const testCasesInSection = groupedTestCases[sectionKey];
                  const section = sectionKey === noSectionKey ? null : sections.find(s => s.id === parseInt(sectionKey));
                  const sectionName = section ? section.name : 'No Section';
                  const allSelected = testCasesInSection.every(tc => selectedTestCasesToAdd.includes(tc.id));
                  const someSelected = testCasesInSection.some(tc => selectedTestCasesToAdd.includes(tc.id));

                  return (
                    <div key={sectionKey} className="border rounded-lg overflow-hidden">
                      {/* Section Header */}
                      <div 
                        className="bg-gray-50 dark:bg-gray-700 px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                        onClick={() => {
                          // Toggle all test cases in this section
                          if (allSelected) {
                            setSelectedTestCasesToAdd(prev => 
                              prev.filter(id => !testCasesInSection.map(tc => tc.id).includes(id))
                            );
                          } else {
                            setSelectedTestCasesToAdd(prev => {
                              const newIds = testCasesInSection.map(tc => tc.id).filter(id => !prev.includes(id));
                              return [...prev, ...newIds];
                            });
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = someSelected && !allSelected;
                            }}
                            onChange={() => {}}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4"
                          />
                          <span className="font-medium text-sm">
                            📁 {sectionName}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            ({testCasesInSection.length} test case{testCasesInSection.length !== 1 ? 's' : ''})
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {someSelected ? `${testCasesInSection.filter(tc => selectedTestCasesToAdd.includes(tc.id)).length} selected` : 'Click to select all'}
                        </span>
                      </div>

                      {/* Test Cases in Section */}
                      <div className="divide-y">
                        {testCasesInSection.map((testCase) => (
                          <div
                            key={testCase.id}
                            className="flex items-center space-x-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTestCasesToAdd(prev =>
                                prev.includes(testCase.id)
                                  ? prev.filter(id => id !== testCase.id)
                                  : [...prev, testCase.id]
                              );
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedTestCasesToAdd.includes(testCase.id)}
                              onChange={() => {}}
                              className="h-4 w-4 flex-shrink-0 ml-6"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{testCase.title}</div>
                              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <span>TC{testCase.id}</span>
                              </div>
                            </div>
                            <Badge className={getPriorityBadge(testCase.priority || 'medium') + ' text-xs'}>
                              {testCase.priority || 'medium'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            
            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {selectedTestCasesToAdd.length} test case(s) selected
              </div>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsAddTestCasesOpen(false);
                    setSelectedTestCasesToAdd([]);
                    setSearchTestCases('');
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddTestCases}
                  disabled={selectedTestCasesToAdd.length === 0}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add {selectedTestCasesToAdd.length} Test Case(s)
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
