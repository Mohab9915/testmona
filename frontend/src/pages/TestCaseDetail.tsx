import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, ArrowRight, Edit, Play, Share2, Clock, User, 
  FileText, Tag, Calendar, AlertTriangle, CheckCircle, XCircle, History, ExternalLink, Eye
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { testCasesAPI, testSuitesAPI, api, requirementsAPI, sectionsAPI } from '@/lib/api';
import { TestCase, TestSuite, Requirement } from '@/types';
import { useAuthStore } from '@/stores/authStore';

export function TestCaseDetail() {
  const { t, isRTL } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { projectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [testCase, setTestCase] = useState<TestCase | null>(null);
  const [testSuite, setTestSuite] = useState<TestSuite | null>(null);
  const [section, setSection] = useState<any>(null);
  const [testSteps, setTestSteps] = useState<Array<{
    step_number: number;
    action: string;
    expected_result: string;
    step_type: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [revisionsError, setRevisionsError] = useState<string | null>(null);
  const [testRunHistory, setTestRunHistory] = useState<any[]>([]);
  const [linkedRequirement, setLinkedRequirement] = useState<Requirement | null>(null);
  const [isValidatingProject, setIsValidatingProject] = useState(false);

  // Helper function to navigate back to the correct test cases page
  const navigateBack = () => {
    if (projectId) {
      navigate(`/projects/${projectId}/test-cases`);
    } else if (testSuite?.project_id) {
      navigate(`/projects/${testSuite.project_id}/test-cases`);
    } else {
      navigate('/test-cases');
    }
  };

  useEffect(() => {
    const fetchTestCaseAndSuite = async () => {
      setLoading(true);
      setIsValidatingProject(true);
      try {
        // Use real API call to fetch test case details
        const testCaseData = await testCasesAPI.getById(parseInt(id || '1'));
        
        // Always fetch test suite if test case has one
        let testSuiteData = null;
        if (testCaseData.test_suite_id) {
          try {
            testSuiteData = await testSuitesAPI.getById(testCaseData.test_suite_id);
            setTestSuite(testSuiteData);
          } catch (suiteError) {
            console.error('Failed to fetch test suite:', suiteError);
          }
        }
        
        setTestCase(testCaseData);
        
        // Fetch section hierarchy to get the full section path
        // Try multiple sources for project ID
        const projectForSections = projectId || testSuiteData?.project_id || testCaseData.project_id;
        
        if (testCaseData.section_id && projectForSections) {
          try {
            const hierarchyData = await sectionsAPI.getProjectSectionHierarchy(parseInt(projectForSections));
            
            const allSections: any[] = [];
            
            // Flatten sections from hierarchy to find the section
            const flattenSections = (hierarchy: any[]) => {
              hierarchy.forEach((item: any) => {
                if (item.sections) {
                  item.sections.forEach((section: any) => {
                    allSections.push({
                      id: section.id,
                      name: section.name,
                      parent_section_id: section.parent_section_id,
                      test_suite_id: section.test_suite_id
                    });
                    // Recursively flatten nested sections
                    if (section.sections && section.sections.length > 0) {
                      flattenSections([{ sections: section.sections }]);
                    }
                  });
                }
              });
            };
            
            flattenSections(hierarchyData.hierarchy || []);
            
            // Find the section and build the full path
            const findSectionPath = (sectionId: number, sections: any[]): string => {
              const section = sections.find(s => s.id === sectionId);
              if (!section) return '';
              
              let path = section.name;
              
              // If this section has a parent, recursively build the path
              if (section.parent_section_id) {
                const parentPath = findSectionPath(section.parent_section_id, sections);
                if (parentPath) {
                  path = `${parentPath} > ${path}`;
                }
              }
              
              return path;
            };
            
            let sectionPath = findSectionPath(testCaseData.section_id, allSections);
            
            // If section not found in hierarchy, fetch it directly
            if (!sectionPath) {
              try {
                // Try to fetch section details
                const sectionData = await sectionsAPI.getSectionDetails(testCaseData.section_id);
                
                // The API returns a nested structure with section data in .section
                const actualSection = sectionData.section || sectionData;
                
                if (actualSection && actualSection.name) {
                  // Build path with parent if exists
                  if (sectionData.parent_section && sectionData.parent_section.name) {
                    sectionPath = `${sectionData.parent_section.name} > ${actualSection.name}`;
                  } else if (actualSection.parent_section_id) {
                    const parentPath = findSectionPath(actualSection.parent_section_id, allSections);
                    sectionPath = parentPath ? `${parentPath} > ${actualSection.name}` : actualSection.name;
                  } else {
                    sectionPath = actualSection.name;
                  }
                }
              } catch (directFetchError) {
                // Fallback: Try to fetch all sections and find by ID
                try {
                  const allSectionsData = await sectionsAPI.getAll(projectForSections, undefined, 0, 1000);
                  
                  const foundSection = allSectionsData.find((s: any) => s.id === testCaseData.section_id);
                  if (foundSection) {
                    sectionPath = foundSection.name;
                  }
                } catch (allSectionsError) {
                  console.error('Failed to fetch all sections:', allSectionsError);
                }
              }
            }
            
            setSection({ name: sectionPath });
          } catch (sectionError) {
            console.error('Failed to fetch section hierarchy:', sectionError);
            setSection(null);
          }
        } else {
          setSection(null);
        }
        
        // If multistep, fetch the steps
        if (testCaseData.is_multistep) {
          try {
            const steps = await testCasesAPI.getSteps(parseInt(id || '1'));
            setTestSteps(steps);
          } catch (stepsError) {
            console.error('Failed to fetch test steps:', stepsError);
            setTestSteps([]);
          }
        } else {
          setTestSteps([]);
        }

        const fetchRevisions = async () => {
          if (!id) return;
          
          setRevisionsLoading(true);
          setRevisionsError(null);
          
          try {
            const response = await api.get(`/test-cases/${id}/revisions`);
            setRevisions(response.data || []);
          } catch (error: any) {
            console.error('Failed to fetch revisions:', error);
            // Don't show error message, just don't display revisions section
            setRevisions([]);
            setRevisionsError(null);
          } finally {
            setRevisionsLoading(false);
          }
        };

        fetchRevisions();

        // Fetch test run history
        try {
          const historyData = await api.get(`/test-results?test_case_id=${id}`);
          setTestRunHistory(historyData.data || []);
        } catch (error) {
          console.log('No test run history available:', error);
          setTestRunHistory([]);
        }

        // Fetch requirement details if reference exists and looks like a requirement ID
        if (testCaseData.reference) {
          const reference = testCaseData.reference;
          
          // Check if it's a requirement ID (not a JIRA link)
          if (!reference.includes('http') && !reference.includes('jira') && !/^[A-Z]+-\d+$/.test(reference)) {
            // We'll fetch this after we have the test suite data
            console.log('Will fetch requirement details for:', reference);
          } else {
            setLinkedRequirement(null);
          }
        }
      } catch (error) {
        console.error('Failed to fetch test case:', error);
        setTestCase(null);
      } finally {
        setLoading(false);
        setIsValidatingProject(false);
      }
    };

    fetchTestCaseAndSuite();
  }, [id]);

  // Fetch requirement details when test case and test suite are loaded
  useEffect(() => {
    if (testCase?.reference && testSuite) {
      const reference = testCase.reference;
      
      // Check if it's a requirement ID (not a JIRA link)
      if (!reference.includes('http') && !reference.includes('jira') && !/^[A-Z]+-\d+$/.test(reference)) {
        const fetchRequirementDetails = async () => {
          try {
            // Get the project ID for fetching requirements
            const projectForRequirements = projectId ? parseInt(projectId) : testSuite.project_id;
            
            // Try to fetch requirement by ID
            const requirements = await requirementsAPI.getAll(projectForRequirements, 0, 100);
            
            const requirement = requirements.find(req => req.requirement_id === reference);
            if (requirement) {
              setLinkedRequirement(requirement);
            } else {
              setLinkedRequirement(null);
            }
          } catch (error) {
            console.log('No requirement found for reference:', reference);
            setLinkedRequirement(null);
          }
        };

        fetchRequirementDetails();
      } else {
        setLinkedRequirement(null);
      }
    }
  }, [testCase?.reference, testSuite, projectId]);

  const handleExecute = () => {
    if (!testCase) return;
    const executeProjectId = projectId || testSuite?.project_id;
    if (executeProjectId) {
      navigate(`/projects/${executeProjectId}/test-cases/${testCase.id}/execute`);
    } else {
      navigate(`/test-cases/${testCase.id}/execute`);
    }
  };

  const handleEdit = () => {
    const editProjectId = projectId || testSuite?.project_id;
    if (editProjectId) {
      navigate(`/projects/${editProjectId}/test-cases/${id}/edit`);
    } else {
      navigate(`/test-cases/${id}/edit`);
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    alert(t('urlCopied'));
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      // Real API status values
      active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      archived: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      // Mock status values (for backward compatibility)
      draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      ready: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      deprecated: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    };
    return variants[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  };

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
  };

  if (loading || isValidatingProject) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!testCase) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('testCaseNotFound')}</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{t('testCaseNotFoundDesc')}</p>
          <Button onClick={() => navigateBack()} className="mt-4">
            {t('backToTestCases')}
          </Button>
        </div>
      </div>
    );
  }

  // Additional safety check
  if (!testCase || typeof testCase !== 'object') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('invalidTestCaseData')}</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{t('unableToLoadDetails')}</p>
          <Button onClick={() => navigateBack()} className="mt-4">
            {t('backToTestCases')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className={`flex flex-col lg:items-center gap-4 ${isRTL ? 'lg:flex-row-reverse' : 'lg:flex-row'}`} dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="flex-1 space-y-3">
            <div className="space-y-2">
              <Button 
                variant="ghost" 
                onClick={navigateBack}
                className="w-fit hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
              >
                {isRTL ? <ArrowRight className="h-3.5 w-3.5 ml-2" /> : <ArrowLeft className="h-3.5 w-3.5 mr-2" />}
                {t('backToTestCases')}
              </Button>
              <h1 className="text-lg lg:text-xl font-bold text-gray-900 dark:text-white leading-tight">
                TC-{testCase.id.toString().padStart(3, '0')}: {testCase.title}
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`${getStatusBadge(testCase.status)} px-2 py-0.5 text-xs font-medium`}>
                  {testCase.status}
                </Badge>
                {testCase.priority && (
                  <Badge className={`${getPriorityBadge(testCase.priority)} px-2 py-0.5 text-xs font-medium`}>
                    {testCase.priority}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed max-w-4xl">
                {testCase.description || t('noDescription')}
              </p>
            </div>
          </div>
          <div className={`flex flex-col gap-2 ${isRTL ? 'lg:items-start' : 'lg:items-end'}`}>
            <Button 
              variant="outline" 
              onClick={handleShare}
              className="w-full sm:w-fit lg:w-full hover:bg-gray-50 dark:hover:bg-gray-700 text-sm h-9"
            >
              <Share2 className={`h-3.5 w-3.5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('share')}
            </Button>
            {!revisionsLoading && revisions.length > 0 && (
              <Button 
                variant="outline" 
                onClick={() => {
                  const element = document.getElementById('revision-history');
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="w-full sm:w-fit lg:w-full hover:bg-gray-50 dark:hover:bg-gray-700 text-sm h-9"
              >
                <History className={`h-3.5 w-3.5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {t('viewRevisions')}
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={handleEdit}
              className="w-full sm:w-fit lg:w-full hover:bg-gray-50 dark:hover:bg-gray-700 text-sm h-9"
            >
              <Edit className={`h-3.5 w-3.5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('edit')}
            </Button>
            <Button 
              onClick={handleExecute} 
              disabled={executing}
              className="w-full sm:w-fit lg:w-full bg-blue-600 hover:bg-blue-700 text-white text-sm h-9"
            >
              <Play className={`h-3.5 w-3.5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {executing ? t('executing') : t('execute')}
            </Button>
          </div>
        </div>
      </div>

      {/* Test Case Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Linked Requirement */}
          {linkedRequirement && (
            <Card className="shadow-sm border-0 bg-white dark:bg-gray-800">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
                  <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  {t('linkedRequirement')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {linkedRequirement.requirement_id}
                      </Badge>
                      <h4 className="font-medium text-sm">{linkedRequirement.title}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        className={`text-xs ${
                          linkedRequirement.priority === 'critical' ? 'bg-red-100 text-red-800' :
                          linkedRequirement.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                          linkedRequirement.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {linkedRequirement.priority}
                      </Badge>
                      <Badge 
                        className={`text-xs ${
                          linkedRequirement.status === 'approved' ? 'bg-green-100 text-green-800' :
                          linkedRequirement.status === 'reviewed' ? 'bg-blue-100 text-blue-800' :
                          linkedRequirement.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                          'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {linkedRequirement.status}
                      </Badge>
                    </div>
                  </div>
                  {linkedRequirement.description && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                      {linkedRequirement.description}
                    </div>
                  )}
                  {linkedRequirement.acceptance_criteria && (
                    <div>
                      <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('acceptanceCriteria')}</h5>
                      <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                        {linkedRequirement.acceptance_criteria}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Preconditions */}
          <Card className="shadow-sm border-0 bg-white dark:bg-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
                <div className="p-1.5 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                </div>
                {t('preconditions')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <div className="whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                  {testCase.preconditions || t('noPreconditions')}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Test Steps */}
          <Card className="shadow-sm border-0 bg-white dark:bg-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                {t('testSteps')}
                {testCase.is_multistep && (
                  <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-0.5 text-xs">
                    {t('multistep')}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                {testCase.is_multistep ? (
                  testSteps.length > 0 ? (
                    <div className="space-y-4">
                      {testSteps.map((step) => (
                        <div key={step.step_number} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="flex items-center justify-center w-6 h-6 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-full">
                                {step.step_number}
                              </span>
                              <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 px-2 py-0.5 text-xs">
                                {step.step_type}
                              </Badge>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <h5 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-1">{t('action')}</h5>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {step.action}
                              </p>
                            </div>
                            <div>
                              <h5 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-1">{t('expectedResult')}</h5>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {step.expected_result}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <FileText className="h-10 w-10 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm">{t('noMultistepData')}</p>
                    </div>
                  )
                ) : testCase.steps ? (
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                    {testCase.steps}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <FileText className="h-10 w-10 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">{t('noStepsDefined')}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Expected Results - Only show for non-multistep test cases */}
          {!testCase.is_multistep && (
            <Card className="shadow-sm border-0 bg-white dark:bg-gray-800">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
                  <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  {t('expectedResults')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  {testCase.expected_result ? (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                      {testCase.expected_result}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <CheckCircle className="h-10 w-10 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm">{t('noExpectedResults')}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Properties */}
          <Card className="shadow-sm border-0 bg-white dark:bg-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">{t('properties')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('type')}</span>
                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 text-xs">
                  {testCase.test_type || 'manual'}
                </Badge>
              </div>
              
              {testCase.reference && (
                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('reference')}</span>
                  <div className="flex items-center gap-2">
                    {testCase.reference.includes('http') ? (
                      <a
                        href={testCase.reference}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                      >
                        {t('jiraLink')}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : /^[A-Z]+-\d+$/.test(testCase.reference) ? (
                      <span className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        {testCase.reference}
                      </span>
                    ) : linkedRequirement ? (
                      <Link
                        to={`/projects/${testSuite?.project_id || projectId}/requirements/${linkedRequirement.id}`}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1"
                      >
                        {linkedRequirement.title}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-900 dark:text-gray-100 font-medium">
                        {testCase.reference}
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('priority')}</span>
                <Badge className={`${getPriorityBadge(testCase.priority)} px-2 py-0.5 text-xs`}>
                  {testCase.priority}
                </Badge>
              </div>
              
              <div className="flex flex-col gap-1 py-3 border-b border-gray-100 dark:border-gray-700">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400 pl-1">{t('section')}</span>
                <div className="text-xs font-medium break-words leading-relaxed">
                  {section ? (
                    section.name.includes(' > ') ? (
                      section.name.split(' > ').map((part, index, array) => (
                        <span key={index}>
                          {index === 0 ? (
                            <Link
                              to={projectId ? `/projects/${projectId}/test-cases` : '/test-cases'}
                              className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                            >
                              {part}
                            </Link>
                          ) : (
                            <span className={
                              index === array.length - 1 ? 'text-gray-900 dark:text-gray-100' :
                              'text-purple-600 dark:text-purple-400'
                            }>
                              {part}
                            </span>
                          )}
                          {index < array.length - 1 && ' > '}
                        </span>
                      ))
                    ) : (
                      <Link
                        to={projectId ? `/projects/${projectId}/test-cases` : '/test-cases'}
                        className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        {section.name}
                      </Link>
                    )
                  ) : (
                    <span className="text-gray-900 dark:text-gray-100">{t('noSection')}</span>
                  )}
                </div>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('testSuite')}</span>
                {testSuite ? (
                  <Link
                    to={`/projects/${testSuite.project_id}/test-suites/${testSuite.id}`}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1"
                  >
                    {testSuite.name}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                ) : (
                  <span className="text-xs text-gray-900 dark:text-gray-100 font-medium">
                    {t('suite')} {testCase.test_suite_id || t('nA')}
                  </span>
                )}
              </div>
              
              {testRunHistory.length > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('latestTestRun')}</span>
                  <Link
                    to={`/projects/${projectId || testSuite?.project_id}/test-runs/${testRunHistory[0].test_run_id}`}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1"
                  >
                    {t('testRun')} #{testRunHistory[0].test_run_id}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card className="shadow-sm border-0 bg-white dark:bg-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">{t('metadata')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <User className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-900 dark:text-white">{t('createdBy')}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {testCase.creator ? 
                      (testCase.creator.full_name || testCase.creator.username || `User ${testCase.creator.id}`) : 
                      t('unknown')
                    }
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <Calendar className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-900 dark:text-white">{t('created')}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {new Date(testCase.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
              
              {testCase.updated_at && (
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <Clock className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-900 dark:text-white">{t('updated')}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {new Date(testCase.updated_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags - Only show if there are tags */}
          {testCase.tags && testCase.tags.trim() && (
            <Card className="shadow-sm border-0 bg-white dark:bg-gray-800">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
                  <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Tag className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  {t('tags')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {testCase.tags.split(',').map((tag, index) => (
                    <Badge 
                      key={index} 
                      variant="secondary" 
                      className="px-2 py-0.5 text-xs bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-700"
                    >
                      {tag.trim()}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Revision History - Only show if user has access and revisions exist */}
          {revisions.length > 0 && (
          <Card className="shadow-sm border-0 bg-white dark:bg-gray-800" id="revision-history">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
                  <div className="p-1.5 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                    <History className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  {t('revisionHistory')}
                </CardTitle>
                {revisions.length > 0 && (
                  <Link
                    to={`/projects/${projectId || testSuite?.project_id}/test-cases/${id}/revisions`}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {t('viewAllRevisions')}
                  </Link>
                )}
              </div>
              </CardHeader>
              <CardContent className="pt-0">
                {revisionsLoading ? (
                  <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                    <div className="animate-spin rounded-full h-6 w-6 mx-auto mb-2 border-b-2 border-gray-300"></div>
                    <p className="text-sm">{t('loadingRevisionHistory')}</p>
                  </div>
                ) : revisions.length > 0 ? (
                  <div className="space-y-3">
                    {revisions.slice(0, 5).map((revision: any) => (
                      <div key={revision.id} className="flex items-start gap-3 pb-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                        <div className="p-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg mt-0.5">
                          <User className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 dark:text-white">
                            {t('revision')} #{revision.revision_number}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {new Date(revision.created_at).toLocaleDateString()} at {new Date(revision.created_at).toLocaleTimeString()}
                          </p>
                          {revision.change_reason && (
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              {revision.change_reason}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                    {revisions.length > 5 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2">
                        +{revisions.length - 5} {t('moreRevisions')}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                    <History className="h-10 w-10 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">{t('noRevisionHistoryAvailable')}</p>
                    <p className="text-xs mt-1">{t('editToCreateRevision')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Test Run History */}
          {testRunHistory.length > 0 && (
            <Card className="shadow-sm border-0 bg-white dark:bg-gray-800">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Play className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  {t('testRunHistory')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {testRunHistory.slice(0, 5).map((result: any) => (
                    <Link
                      key={result.id}
                      to={`/projects/${projectId || testSuite?.project_id}/test-runs/${result.test_run_id}`}
                      className="flex items-start gap-3 pb-3 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-2 px-2 py-2 rounded transition-colors"
                    >
                      <div className={`p-1.5 rounded-lg mt-0.5 ${getResultStatusBg(result.status)}`}>
                        {getStepStatusIcon(result.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-gray-900 dark:text-white">
                            {t('testRun')} #{result.test_run_id}
                          </p>
                          <ExternalLink className="h-3 w-3 text-gray-400" />
                        </div>
                        <Badge className={`${getStatusBadgeClass(result.status)} px-1.5 py-0 text-xs mt-1`}>
                          {result.status}
                        </Badge>
                        {result.executed_by && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {t('by')} {result.executed_by}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {new Date(result.executed_at || result.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </Link>
                  ))}
                  {testRunHistory.length > 5 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2">
                      +{testRunHistory.length - 5} {t('moreExecutions')}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper functions
function getPriorityBadge(priority: string) {
  const variants: Record<string, string> = {
    low: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
  };
  return variants[priority] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
}

function getStatusBadgeClass(status: string) {
  const variants: Record<string, string> = {
    pass: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    fail: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    skip: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    block: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    not_tested: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  };
  return variants[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
}

function getResultStatusBg(status: string) {
  const variants: Record<string, string> = {
    pass: 'bg-green-100 dark:bg-green-900/30',
    fail: 'bg-red-100 dark:bg-red-900/30',
    skip: 'bg-gray-100 dark:bg-gray-700',
    block: 'bg-yellow-100 dark:bg-yellow-900/30',
    not_tested: 'bg-gray-100 dark:bg-gray-700'
  };
  return variants[status] || 'bg-gray-100 dark:bg-gray-700';
}
