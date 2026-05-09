import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, Download, CheckCircle, XCircle, AlertTriangle, 
  Clock, FileText
} from 'lucide-react';
import { testRunsAPI, testResultsAPI, usersAPI } from '@/lib/api';

export function TestRunReport() {
  const navigate = useNavigate();
  const { projectId, testRunId } = useParams();
  const [testRun, setTestRun] = useState<any>(null);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    
    // Set up interval to check status every 3 seconds
    const interval = setInterval(async () => {
      if (!testRunId) return;
      
      try {
        const [runData, resultsData] = await Promise.all([
          testRunsAPI.getById(parseInt(testRunId)),
          testResultsAPI.getAll(parseInt(testRunId))
        ]);
        
        const currentStatus = runData.status?.toLowerCase().replace('-', '_');
        if (currentStatus !== 'completed' && resultsData.length > 0) {
          const allCompleted = resultsData.every((result: any) => {
            const status = result.status.toLowerCase();
            return status !== 'not_tested' && status !== 'pending';
          });
          
          if (allCompleted) {
            await testRunsAPI.update(parseInt(testRunId), {
              status: 'completed',
              completed_at: new Date().toISOString()
            });
            
            const updatedTestRun = await testRunsAPI.getById(parseInt(testRunId));
            setTestRun(updatedTestRun);
            setTestResults(resultsData);
          }
        }
      } catch (error) {
        console.error('Failed to check/update status:', error);
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [testRunId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [runData, resultsData, usersData] = await Promise.all([
        testRunsAPI.getById(parseInt(testRunId!)),
        testResultsAPI.getAll(parseInt(testRunId!)),
        usersAPI.getAll()
      ]);
      setTestRun(runData);
      setTestResults(resultsData);
      setUsers(usersData);
    } catch (error) {
      console.error('Failed to load report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUserName = (userId: number | null) => {
    if (!userId) return 'N/A';
    const user = users.find(u => u.id === userId);
    return user ? user.username : `User ${userId}`;
  };

  const statusCounts = testResults.reduce((acc: any, result) => {
    const status = result.status.toLowerCase();
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const totalTests = testResults.length;
  const passedTests = (statusCounts.pass || 0) + (statusCounts.passed || 0);
  const failedTests = (statusCounts.fail || 0) + (statusCounts.failed || 0);
  const blockedTests = (statusCounts.block || 0) + (statusCounts.blocked || 0);
  const skippedTests = (statusCounts.skip || 0) + (statusCounts.skipped || 0);
  const notTestedTests = statusCounts.not_tested || 0;
  const passRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

  const handleDownloadJSON = () => {
    const report = {
      testRunName: testRun?.name,
      testRunId: testRun?.id,
      generatedAt: new Date().toISOString(),
      summary: {
        totalTests,
        passedTests,
        failedTests,
        blockedTests,
        skippedTests,
        notTestedTests,
        passRate,
        duration: testRun?.completed_at 
          ? Math.round((new Date(testRun.completed_at).getTime() - new Date(testRun.created_at).getTime()) / 60000)
          : 'In Progress'
      },
      results: testResults.map(result => ({
        testCaseId: result.test_case_id,
        testCaseTitle: result.test_case?.title,
        section: result.test_case?.section_id,
        priority: result.test_case?.priority,
        status: result.status,
        executedBy: getUserName(result.executed_by),
        executedById: result.executed_by,
        executedAt: result.executed_at,
        duration: result.execution_time,
        comments: result.comments
      }))
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-run-${testRun?.id}-report.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading report...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate(`/projects/${projectId}/test-runs/${testRunId}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Test Run
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Test Run Report</h1>
            <p className="text-sm text-gray-600">{testRun?.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadJSON}>
            <Download className="h-4 w-4 mr-2" />
            Download JSON
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
            <FileText className="h-4 w-4 mr-2" />
            Print / PDF
          </Button>
        </div>
      </div>

      {/* Report Header - Print Visible */}
      <div className="hidden print:block mb-6">
        <h1 className="text-3xl font-bold mb-2">Test Run Report</h1>
        <p className="text-lg text-gray-700">{testRun?.name}</p>
        <p className="text-sm text-gray-500">Generated: {new Date().toLocaleString()}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Tests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTests}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pass Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{passRate}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Passed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div className="text-2xl font-bold">{passedTests}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <div className="text-2xl font-bold">{failedTests}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Test Run Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test Run Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600 text-xs">Status</p>
              <Badge className="mt-1">{testRun?.status}</Badge>
            </div>
            <div>
              <p className="text-gray-600 text-xs">Created</p>
              <p className="font-medium">{testRun?.created_at ? new Date(testRun.created_at).toLocaleDateString() : 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-600 text-xs">Started</p>
              <p className="font-medium">{testRun?.started_at ? new Date(testRun.started_at).toLocaleDateString() : 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-600 text-xs">Completed</p>
              <p className="font-medium">{testRun?.completed_at ? new Date(testRun.completed_at).toLocaleDateString() : 'In Progress'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Passed</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-48 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full" 
                    style={{ width: `${totalTests > 0 ? (passedTests / totalTests) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-12 text-right">{passedTests}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm">Failed</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-48 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-red-600 h-2 rounded-full" 
                    style={{ width: `${totalTests > 0 ? (failedTests / totalTests) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-12 text-right">{failedTests}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm">Blocked</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-48 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-yellow-600 h-2 rounded-full" 
                    style={{ width: `${totalTests > 0 ? (blockedTests / totalTests) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-12 text-right">{blockedTests}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-600" />
                <span className="text-sm">Skipped</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-48 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gray-600 h-2 rounded-full" 
                    style={{ width: `${totalTests > 0 ? (skippedTests / totalTests) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-12 text-right">{skippedTests}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="text-sm">Not Tested</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-48 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gray-400 h-2 rounded-full" 
                    style={{ width: `${totalTests > 0 ? (notTestedTests / totalTests) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-12 text-right">{notTestedTests}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Results Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs">
                <tr>
                  <th className="px-4 py-2 text-left">Test Case</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Priority</th>
                  <th className="px-4 py-2 text-left">Executed By</th>
                  <th className="px-4 py-2 text-left">Executed At</th>
                  <th className="px-4 py-2 text-left">Comments</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {testResults.map((result) => (
                  <tr key={result.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div>
                        <p className="font-medium">{result.test_case?.title || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">TC-{result.test_case_id}</p>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <Badge 
                        variant={
                          result.status === 'pass' ? 'default' : 
                          result.status === 'fail' ? 'destructive' : 
                          'secondary'
                        }
                        className="text-xs"
                      >
                        {result.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className="text-xs">
                        {result.test_case?.priority || 'N/A'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-xs">{getUserName(result.executed_by)}</td>
                    <td className="px-4 py-2 text-xs">
                      {result.executed_at ? new Date(result.executed_at).toLocaleString() : 'N/A'}
                    </td>
                    <td className="px-4 py-2 text-xs">{result.comments || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
