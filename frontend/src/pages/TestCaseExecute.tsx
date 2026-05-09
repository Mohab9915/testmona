import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Play, Save, AlertTriangle, CheckCircle, XCircle,
  Clock, User, MessageSquare, ExternalLink, Plus, Trash2
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { testCasesAPI, usersAPI } from '@/lib/api';
import { TestCase } from '@/types/index';

interface ExecutionStep {
  step_number: number;
  status: 'pass' | 'fail' | 'blocked' | 'not_executed';
  actual_result: string;
  comment: string;
  defect_id?: string;
}

interface Execution {
  id: string;
  test_case_id: number;
  status: 'passed' | 'failed' | 'blocked' | 'in_progress';
  assignee: string;
  executed_by: string;
  executed_at: string;
  duration: number;
  comment: string;
  steps: ExecutionStep[];
}

export function TestCaseExecute() {
  const { t } = useTranslation();
  const { id, projectId } = useParams<{ id: string; projectId?: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testCase, setTestCase] = useState<TestCase | null>(null);
  const [execution, setExecution] = useState<Execution | null>(null);

  // Form state
  const [assignee, setAssignee] = useState('');
  const [overallComment, setOverallComment] = useState('');
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    const fetchTestCase = async () => {
      setLoading(true);
      try {
        if (!id) return;

        console.log('Fetching test case with ID:', id);

        // Fetch test case data and users in parallel
        const [testCaseData, usersData] = await Promise.all([
          testCasesAPI.getById(parseInt(id)),
          usersAPI.getAll().catch(() => [])
        ]);
        console.log('Test case data received:', testCaseData);
        console.log('Users loaded:', usersData);

        setUsers(usersData);

        let testCaseWithSteps = testCaseData;

        // If multistep, fetch the steps
        if (testCaseData.is_multistep) {
          const steps = await testCasesAPI.getSteps(parseInt(id));
          testCaseWithSteps = {
            ...testCaseData,
            test_steps: steps
          };
        }

        setTestCase(testCaseWithSteps);

        // Initialize execution steps based on whether it's multistep or not
        let executionSteps: ExecutionStep[];

        if (testCaseWithSteps.is_multistep && testCaseWithSteps.test_steps) {
          // Use multistep data
          executionSteps = testCaseWithSteps.test_steps.map(step => ({
            step_number: step.step_number,
            status: 'not_executed' as const,
            actual_result: '',
            comment: ''
          }));
        } else {
          // Parse simple steps text into individual steps
          const simpleSteps = testCaseWithSteps.steps
            .split('\n')
            .filter(line => line.trim())
            .map((line, index) => {
              const stepNumber = index + 1;
              const cleanLine = line.replace(/^\d+\.\s*/, '').trim();
              return {
                step_number: stepNumber,
                status: 'not_executed' as const,
                actual_result: '',
                comment: ''
              };
            });
          executionSteps = simpleSteps;
        }

        // Initialize execution
        const mockExecution: Execution = {
          id: `exec_${Date.now()}`,
          test_case_id: testCaseWithSteps.id,
          status: 'in_progress',
          assignee: usersData.length > 0 ? usersData[0].id.toString() : '',
          executed_by: usersData.length > 0 ? usersData[0].id.toString() : '',
          executed_at: new Date().toISOString(),
          duration: 0,
          comment: '',
          steps: executionSteps
        };
        setExecution(mockExecution);
        setAssignee(mockExecution.assignee);
      } catch (error) {
        console.error('Failed to fetch test case:', error);
        setTestCase(null);
        setExecution(null);
      } finally {
        setLoading(false);
      }
    };

    fetchTestCase();
  }, [id]);

  // Helper functions to get step data
  const getStepAction = (stepNumber: number) => {
    if (!testCase) return '';
    if (testCase.is_multistep && testCase.test_steps) {
      const step = testCase.test_steps.find(s => s.step_number === stepNumber);
      return step?.action || '';
    } else {
      const simpleSteps = testCase.steps?.split('\n').filter(line => line.trim()) || [];
      const step = simpleSteps[stepNumber - 1];
      return step?.replace(/^\d+\.\s*/, '') || '';
    }
  };

  const getStepExpectedResult = (stepNumber: number) => {
    if (!testCase) return '';
    if (testCase.is_multistep && testCase.test_steps) {
      const step = testCase.test_steps.find(s => s.step_number === stepNumber);
      return step?.expected_result || '';
    } else {
      return testCase.expected_result || '';
    }
  };

  const handleStartExecution = () => {
    setStartTime(new Date());
    setExecuting(true);
    if (execution) {
      setExecution(prev => prev ? { ...prev, status: 'in_progress' } : null);
    }
  };

  const handleStepStatusChange = (stepNumber: number, status: 'pass' | 'fail' | 'blocked' | 'not_executed') => {
    if (!execution) return;
    
    setExecution(prev => prev ? {
      ...prev,
      steps: prev.steps.map(step => 
        step.step_number === stepNumber 
          ? { ...step, status }
          : step
      )
    } : null);
  };

  const handleStepActualResultChange = (stepNumber: number, actualResult: string) => {
    if (!execution) return;
    
    setExecution(prev => prev ? {
      ...prev,
      steps: prev.steps.map(step => 
        step.step_number === stepNumber 
          ? { ...step, actual_result: actualResult }
          : step
      )
    } : null);
  };

  const handleStepCommentChange = (stepNumber: number, comment: string) => {
    if (!execution) return;
    
    setExecution(prev => prev ? {
      ...prev,
      steps: prev.steps.map(step => 
        step.step_number === stepNumber 
          ? { ...step, comment }
          : step
      )
    } : null);
  };

  const handleCreateDefect = (stepNumber: number) => {
    // In a real app, this would open a defect creation dialog or navigate to defect creation page
    const defectId = `DEF-${Date.now()}`;
    
    if (execution) {
      setExecution(prev => prev ? {
        ...prev,
        steps: prev.steps.map(step => 
          step.step_number === stepNumber 
            ? { ...step, defect_id: defectId }
            : step
        )
      } : null);
    }
    
    alert(`Defect ${defectId} created for step ${stepNumber}`);
  };

  const calculateOverallStatus = (): 'passed' | 'failed' | 'blocked' | 'in_progress' => {
    if (!execution) return 'in_progress';
    
    const statuses = execution.steps.map(step => step.status);
    
    if (statuses.includes('blocked')) return 'blocked';
    if (statuses.includes('fail')) return 'failed';
    if (statuses.includes('not_executed')) return 'in_progress';
    return 'passed';
  };

  const handleSaveExecution = async () => {
    if (!execution || !startTime) return;
    
    setSaving(true);
    try {
      const endTime = new Date();
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000 / 60); // in minutes
      
      const updatedExecution: Execution = {
        ...execution,
        status: calculateOverallStatus(),
        assignee,
        executed_by: 'tester@testmona.com',
        executed_at: startTime.toISOString(),
        duration,
        comment: overallComment
      };
      
      // Log the activity
      const activity = {
        id: Date.now(),
        type: 'testExecution',
        testCaseTitle: testCase?.title,
        status: updatedExecution.status,
        assignee: updatedExecution.assignee,
        timestamp: new Date().toISOString(),
        user: 'Current User'
      };
      
      const existingActivities = JSON.parse(localStorage.getItem('recentActivities') || '[]');
      existingActivities.unshift(activity);
      localStorage.setItem('recentActivities', JSON.stringify(existingActivities.slice(0, 10)));
      
      console.log('Saving execution:', updatedExecution);
      alert('Test execution saved successfully!');
      navigate(`/test-cases/${testCase?.id}`);
    } catch (error) {
      console.error('Failed to save execution:', error);
      alert('Failed to save execution');
    } finally {
      setSaving(false);
    }
  };

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'blocked':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      passed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      blocked: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    };
    return variants[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!testCase || !execution) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Test Case Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">The test case you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/test-cases')} className="mt-4">
            Back to Test Cases
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => {
            if (projectId) {
              navigate(`/projects/${projectId}/test-cases/${testCase.id}`);
            } else {
              navigate(`/test-cases/${testCase.id}`);
            }
          }}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Test Case
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Execute Test Case</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              TC-{testCase.id.toString().padStart(3, '0')}: {testCase.title}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge className={getStatusBadge(execution.status)}>
            {execution.status.replace('_', ' ').toUpperCase()}
          </Badge>
          {!executing ? (
            <Button onClick={handleStartExecution}>
              <Play className="h-4 w-4 mr-2" />
              Start Execution
            </Button>
          ) : (
            <Button onClick={handleSaveExecution} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Execution'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Preconditions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Preconditions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-line text-sm text-gray-600 dark:text-gray-400">
                {testCase.preconditions}
              </div>
            </CardContent>
          </Card>

          {/* Execution Steps */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Execution Steps
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {execution.steps.map((step) => (
                <div key={step.step_number} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-medium">
                        {step.step_number}
                      </div>
                      <h4 className="font-medium">Step {step.step_number}</h4>
                      {getStepStatusIcon(step.status)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={step.status}
                        onValueChange={(value: 'pass' | 'fail' | 'blocked' | 'not_executed') => 
                          handleStepStatusChange(step.step_number, value)
                        }
                        disabled={!executing}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not_executed">Not Executed</SelectItem>
                          <SelectItem value="pass">Pass</SelectItem>
                          <SelectItem value="fail">Fail</SelectItem>
                          <SelectItem value="blocked">Blocked</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <h5 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-1">Action</h5>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {getStepAction(step.step_number)}
                      </p>
                    </div>
                    
                    <div>
                      <h5 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-1">Expected Result</h5>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {getStepExpectedResult(step.step_number)}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Actual Result</Label>
                      <Textarea
                        value={step.actual_result}
                        onChange={(e) => handleStepActualResultChange(step.step_number, e.target.value)}
                        placeholder="Enter actual result"
                        rows={2}
                        disabled={!executing}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Comments</Label>
                      <Textarea
                        value={step.comment}
                        onChange={(e) => handleStepCommentChange(step.step_number, e.target.value)}
                        placeholder="Add comments for this step"
                        rows={2}
                        disabled={!executing}
                      />
                    </div>
                    
                    {step.status === 'fail' && (
                      <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          <span className="text-sm text-red-800 dark:text-red-400">
                            Step failed - Create defect?
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCreateDefect(step.step_number)}
                          className="text-red-600 border-red-600 hover:bg-red-50"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create Defect
                        </Button>
                      </div>
                    )}
                    
                    {step.defect_id && (
                      <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                        <div className="flex items-center gap-2">
                          <ExternalLink className="h-4 w-4 text-orange-600" />
                          <span className="text-sm text-orange-800 dark:text-orange-400">
                            Defect: {step.defect_id}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/defects/${step.defect_id}`)}
                          className="text-orange-600 border-orange-600 hover:bg-orange-50"
                        >
                          View Defect
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Execution Details */}
          <Card>
            <CardHeader>
              <CardTitle>Execution Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="assignee">Assignee</Label>
                <Select
                  value={assignee}
                  onValueChange={setAssignee}
                  disabled={executing}
                >
                  <SelectTrigger id="assignee">
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.full_name || user.username} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="overall-comment">Overall Comments</Label>
                <Textarea
                  id="overall-comment"
                  value={overallComment}
                  onChange={(e) => setOverallComment(e.target.value)}
                  placeholder="Add overall execution comments"
                  rows={3}
                  disabled={!executing}
                />
              </div>
              
              <Separator />

              <div className="flex justify-between">
                <span className="text-sm font-medium">Status</span>
                <Badge className={getStatusBadge(execution.status)}>
                  {execution.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm font-medium">Test Type</span>
                <Badge className={getTypeBadge(testCase.test_type)}>{testCase.test_type}</Badge>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm font-medium">Priority</span>
                <Badge className={getPriorityBadge(testCase.priority)}>{testCase.priority}</Badge>
              </div>
              
              {startTime && (
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Started</span>
                  <span className="text-sm">{startTime.toLocaleTimeString()}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full" onClick={() => {
                if (projectId) {
                  navigate(`/projects/${projectId}/test-cases/${testCase.id}`);
                } else {
                  navigate(`/test-cases/${testCase.id}`);
                }
              }}>
                View Test Case
              </Button>
              <Button variant="outline" className="w-full" onClick={() => {
                if (projectId) {
                  navigate(`/projects/${projectId}/test-cases/${testCase.id}/edit`);
                } else {
                  navigate(`/test-cases/${testCase.id}/edit`);
                }
              }}>
                Edit Test Case
              </Button>
              <Button variant="outline" className="w-full" onClick={() => {
                if (projectId) {
                  navigate(`/projects/${projectId}/test-cases/${testCase.id}/revisions`);
                } else {
                  navigate(`/test-cases/${testCase.id}/history`);
                }
              }}>
                View History
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Helper functions
function getTypeBadge(type: string) {
  const variants: Record<string, string> = {
    manual: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    automated: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    performance: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    security: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
  };
  return variants[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
}

function getPriorityBadge(priority: string) {
  const variants: Record<string, string> = {
    low: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
  };
  return variants[priority] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
}
