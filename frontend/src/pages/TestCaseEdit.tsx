import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MarkdownEditor } from '@/components/ui/markdown-editor';
import { ReferenceField } from '@/components/ui/reference-field';
import { ArrowLeft, Save, Trash2, Plus, AlertTriangle, RefreshCw } from 'lucide-react';
import { testCasesAPI, testSuitesAPI, projectsAPI, sectionsAPI } from '@/lib/api';
import { useProjectStore } from '@/stores/projectStore';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';

type TestCasePriority = 'low' | 'medium' | 'high' | 'critical';
type TestCaseStatus = 'active' | 'inactive' | 'archived';
type TestCaseType = 'manual' | 'automated' | 'performance' | 'security' | 'smoke';

export function TestCaseEdit() {
  const { id, projectId } = useParams<{ id: string; projectId?: string }>();
  const navigate = useNavigate();
  const { setSelectedProject, projects } = useProjectStore();
  const { t, isRTL } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    preconditions: '',
    steps: '',
    expected_result: '',
    test_type: 'manual' as TestCaseType,
    priority: 'medium' as TestCasePriority,
    status: 'active' as TestCaseStatus,
    tags: '',
    reference: '',
    test_suite_id: null as number | null,
    section_id: null as number | null,
    is_multistep: false,
  });
  
  // Multistep test case steps state
  const [testSteps, setTestSteps] = useState<any[]>([]);
  const [isValidatingProject, setIsValidatingProject] = useState(false);
  const [sectionOptions, setSectionOptions] = useState<{ id: number; name: string; indent: number }[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [testSuiteOptions, setTestSuiteOptions] = useState<{ id: number; name: string }[]>([]);
  const [testSuitesLoading, setTestSuitesLoading] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);

  const navigateBack = () => {
    if (currentProjectId) {
      navigate(`/projects/${currentProjectId}/test-cases/${id}`);
    } else {
      navigate(`/test-cases/${id}`);
    }
  };

  useEffect(() => {
    const fetchTestCase = async () => {
      setLoading(true);
      setIsValidatingProject(true);
      try {
        if (id) {
          const testCaseData = await testCasesAPI.getById(parseInt(id || '1'));
        
          // Validate that the test case belongs to the specified project
          if (projectId && testCaseData.test_suite_id) {
            try {
              const testSuiteData = await testSuitesAPI.getById(testCaseData.test_suite_id);
              if (testSuiteData.project_id !== parseInt(projectId)) {
                console.error('Test case does not belong to this project');
                // Navigate to the correct project
                navigate(`/projects/${testSuiteData.project_id}/test-cases/${id}/edit`);
                return;
              }
            } catch (suiteError) {
              console.error('Failed to validate test case project:', suiteError);
              // If we can't validate, show error but continue
            }
          }

          const suiteId = (testCaseData as any).test_suite_id ?? null;
          const sectionId = (testCaseData as any).section_id ?? null;
          
          setFormData({
            title: testCaseData.title,
            description: testCaseData.description || '',
            preconditions: testCaseData.preconditions || '',
            steps: testCaseData.steps || '',
            expected_result: testCaseData.expected_result || '',
            test_type: (testCaseData.test_type as TestCaseType) || 'manual',
            priority: (testCaseData.priority as TestCasePriority) || 'medium',
            status: (testCaseData.status as TestCaseStatus) || 'active',
            tags: testCaseData.tags || '',
            reference: testCaseData.reference || '',
            test_suite_id: suiteId,
            section_id: sectionId,
            is_multistep: (testCaseData as any).is_multistep || false,
          });
          
          // If multistep, fetch the steps
          if ((testCaseData as any).is_multistep) {
            const steps = await testCasesAPI.getSteps(parseInt(id));
            setTestSteps(steps);
          }

          // Determine the project ID
          let determinedProjectId: number | null = null;
          
          if (projectId) {
            determinedProjectId = parseInt(projectId);
          } else if (suiteId) {
            try {
              const suite = await testSuitesAPI.getById(suiteId);
              determinedProjectId = suite?.project_id || null;
            } catch (error) {
              console.error('Failed to fetch test suite:', error);
            }
          }

          if (determinedProjectId) {
            setCurrentProjectId(determinedProjectId);
            const proj = projects.find(p => p.id === determinedProjectId) || 
                        await projectsAPI.getById(determinedProjectId).catch(() => null);
            if (proj) setSelectedProject(proj);
          }
        }
      } catch (error) {
        console.error('Failed to fetch test case:', error);
      } finally {
        setLoading(false);
        setIsValidatingProject(false);
      }
    };

    fetchTestCase();
  }, [id, projectId]);

  useEffect(() => {
    const loadTestSuites = async () => {
      if (!currentProjectId) {
        setTestSuiteOptions([]);
        return;
      }
      setTestSuitesLoading(true);
      try {
        const testSuites = await testSuitesAPI.getAll(currentProjectId);
        setTestSuiteOptions(testSuites.map(suite => ({ id: suite.id, name: suite.name })));
      } catch (error) {
        console.error('Failed to load test suites:', error);
        setTestSuiteOptions([]);
      } finally {
        setTestSuitesLoading(false);
      }
    };
    loadTestSuites();
  }, [currentProjectId]);

  useEffect(() => {
    const loadSections = async () => {
      if (!currentProjectId || !formData.test_suite_id) {
        setSectionOptions([]);
        return;
      }
      setSectionsLoading(true);
      try {
        const data = await sectionsAPI.getProjectSectionHierarchy(currentProjectId);
        const hierarchy = data?.hierarchy ?? [];
        const suiteBlock = hierarchy.find(
          (h: { test_suite: { id: number } }) => h.test_suite?.id === formData.test_suite_id
        );
        
        if (!suiteBlock) {
          setSectionOptions([]);
          return;
        }

        // Use a Set to track unique section IDs and prevent duplicates
        const seenSections = new Set<number>();
        const flat: { id: number; name: string; indent: number }[] = [];
        
        const pushSection = (s: { id: number; name: string; subsections?: { id: number; name: string; subsections?: any[] }[] }, indent: number) => {
          // Skip if we've already seen this section (prevents duplicates)
          if (seenSections.has(s.id)) {
            return;
          }
          seenSections.add(s.id);
          flat.push({ id: s.id, name: s.name, indent });
          (s.subsections ?? []).forEach((sub: { id: number; name: string; subsections?: any[] }) =>
            pushSection(sub, indent + 1)
          );
        };
        
        (suiteBlock.sections ?? []).forEach((s: { id: number; name: string; subsections?: { id: number; name: string; subsections?: any[] }[] }) =>
          pushSection(s, 0)
        );
        
        setSectionOptions(flat);
      } catch (error) {
        console.error('Failed to load sections:', error);
        setSectionOptions([]);
      } finally {
        setSectionsLoading(false);
      }
    };
    loadSections();
  }, [currentProjectId, formData.test_suite_id]);

  const handleInputChange = (field: string, value: string | number | null) => {
    setFormData(prev => {
      const updated = {
        ...prev,
        [field]: value
      };
      
      // If test suite changes, reset section
      if (field === 'test_suite_id' && value !== prev.test_suite_id) {
        updated.section_id = null;
      }
      
      return updated;
    });
  };

  // Multistep handlers
  const handleMultistepToggle = (isMultistep: boolean) => {
    setFormData(prev => ({ ...prev, is_multistep: isMultistep }));
    if (isMultistep && testSteps.length === 0) {
      // Initialize with one empty step
      setTestSteps([{
        step_number: 1,
        action: '',
        expected_result: '',
        step_type: 'manual'
      }]);
    }
  };

  const handleAddStep = () => {
    const newStepNumber = testSteps.length + 1;
    setTestSteps(prev => [...prev, {
      step_number: newStepNumber,
      action: '',
      expected_result: '',
      step_type: 'manual'
    }]);
  };

  const handleRemoveStep = (stepNumber: number) => {
    setTestSteps(prev => {
      const filtered = prev.filter(step => step.step_number !== stepNumber);
      // Renumber remaining steps
      return filtered.map((step, index) => ({
        ...step,
        step_number: index + 1
      }));
    });
  };

  const handleStepChange = (stepNumber: number, field: 'action' | 'expected_result' | 'step_type', value: string) => {
    setTestSteps(prev => prev.map(step => 
      step.step_number === stepNumber 
        ? { ...step, [field]: value }
        : step
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (id) {
        const testCaseId = parseInt(id);
        const payload = {
          ...formData,
          test_suite_id: formData.test_suite_id ?? undefined,
          section_id: formData.section_id ?? undefined,
        };
        
        // Update test case first
        await testCasesAPI.update(testCaseId, payload);
        
        // Handle steps: if multistep, always sync steps (including empty array to clear)
        // If not multistep, send empty array to clear any existing steps
        if (formData.is_multistep) {
          // Backend handles test_case_id assignment, no need to add it here
          await testCasesAPI.createWithSteps(testCaseId, testSteps);
        } else {
          // Clear steps when switching to simple mode
          await testCasesAPI.createWithSteps(testCaseId, []);
        }
      }
      navigateBack();
    } catch (error) {
      console.error('Failed to save test case:', error);
      // Show error to user
      toast({
        variant: 'destructive',
        title: t('saveFailed'),
        description: t('failedToSaveTestCase'),
      });
    } finally {
      setSaving(false);
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

  return (
    <div className="container mx-auto p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={navigateBack}>
          <ArrowLeft className={`h-4 w-4 ${isRTL ? 'mr-0 ml-2' : 'mr-2'}`} />
          {t('back')}
        </Button>
        <h1 className="text-2xl font-bold">{t('editTestCase')}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('testCaseDetails')}</CardTitle>
          {!currentProjectId && (
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
              ⚠️ {t('testCaseNotAssociatedWarning')}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="title">{t('title')}</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder={t('enterTestCaseTitle')}
              className="w-full"
            />
          </div>

          <ReferenceField
            value={formData.reference}
            onChange={(value) => handleInputChange('reference', value)}
            projectId={currentProjectId}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="test_suite">{t('testSuite')} {currentProjectId && <span className="text-xs text-muted-foreground">({t('projectId')}: {currentProjectId})</span>}</Label>
              <Select
                value={formData.test_suite_id === null ? 'none' : String(formData.test_suite_id)}
                onValueChange={(value) => handleInputChange('test_suite_id', value === 'none' ? null : parseInt(value, 10))}
                disabled={testSuitesLoading || !currentProjectId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={
                    testSuitesLoading 
                      ? t('loadingTestSuites') 
                      : !currentProjectId 
                        ? t('noProjectSelected') 
                        : testSuiteOptions.length === 0 
                          ? t('noTestSuitesAvailable') 
                          : t('selectTestSuite')
                  } />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {t('noTestSuite')}
                  </SelectItem>
                  {testSuiteOptions.map((suite) => (
                    <SelectItem key={suite.id} value={String(suite.id)}>
                      {suite.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!testSuitesLoading && !currentProjectId && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  {t('ensureTestCaseBelongsToProject')}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="test_type">{t('testType')}</Label>
              <Select value={formData.test_type} onValueChange={(value) => handleInputChange('test_type', value as TestCaseType)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('selectTestType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">{t('manual')}</SelectItem>
                  <SelectItem value="automated">{t('automated')}</SelectItem>
                  <SelectItem value="performance">{t('performance')}</SelectItem>
                  <SelectItem value="security">{t('security')}</SelectItem>
                  <SelectItem value="smoke">{t('smoke')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="priority">{t('priority')}</Label>
              <Select value={formData.priority} onValueChange={(value) => handleInputChange('priority', value as TestCasePriority)}>
                <SelectTrigger className="w-full">
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
            <div>
              <Label htmlFor="status">{t('status')}</Label>
              <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value as TestCaseStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('selectStatus')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t('active')}</SelectItem>
                  <SelectItem value="inactive">{t('inactive')}</SelectItem>
                  <SelectItem value="archived">{t('archived')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {currentProjectId && formData.test_suite_id && (
            <div>
              <Label htmlFor="section">{t('section')}</Label>
              <Select
                value={formData.section_id === null ? 'no-section' : String(formData.section_id)}
                onValueChange={(value) =>
                  handleInputChange('section_id', value === 'no-section' ? null : parseInt(value, 10))
                }
                disabled={sectionsLoading || sectionOptions.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={
                    sectionsLoading 
                      ? t('loadingSections') 
                      : sectionOptions.length === 0 
                        ? t('noSectionsAvailable') 
                        : t('selectSection')
                  } />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-section">
                    {t('noSection')}
                  </SelectItem>
                  {sectionOptions.map((opt) => (
                    <SelectItem key={opt.id} value={String(opt.id)}>
                      {'\u00A0'.repeat(opt.indent * 2)}{opt.indent > 0 ? '↳ ' : ''}{opt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!sectionsLoading && sectionOptions.length === 0 && formData.test_suite_id && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t('noSectionsFoundForSuite')}
                </p>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="tags">{t('tags')}</Label>
            <Input
              id="tags"
              value={formData.tags}
              onChange={(e) => handleInputChange('tags', e.target.value)}
              placeholder={t('enterTagsSeparatedByCommas')}
              className="w-full"
            />
          </div>

          <div>
            <Label htmlFor="description">{t('description')}</Label>
            <MarkdownEditor
              value={formData.description}
              onChange={(value) => handleInputChange('description', value)}
              placeholder={t('enterTestCaseDescription')}
              rows={3}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="preconditions">{t('preconditions')}</Label>
            <MarkdownEditor
              value={formData.preconditions}
              onChange={(value) => handleInputChange('preconditions', value)}
              placeholder={t('describePreconditions')}
              rows={3}
              className="mt-1"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="steps">{t('testSteps')}</Label>
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <span className="text-sm text-gray-600">{t('simple')}</span>
                <button
                  type="button"
                  onClick={() => handleMultistepToggle(!formData.is_multistep)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.is_multistep ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isRTL
                        ? formData.is_multistep
                          ? '-translate-x-6'
                          : '-translate-x-1'
                        : formData.is_multistep
                          ? 'translate-x-6'
                          : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-sm text-gray-600">{t('multistep')}</span>
              </div>
            </div>
            {!formData.is_multistep ? (
              <MarkdownEditor
                value={formData.steps}
                onChange={(value) => handleInputChange('steps', value)}
                placeholder={t('stepOneTwoThree')}
                rows={5}
                className="mt-1"
              />
            ) : (
              <div className="space-y-4 mt-2">
                {testSteps.map((step) => (
                  <div key={step.step_number} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{t('stepNumber', { number: step.step_number })}</h4>
                      {testSteps.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveStep(step.step_number)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t('action')}</Label>
                        <Textarea
                          value={step.action}
                          onChange={(e) => handleStepChange(step.step_number, 'action', e.target.value)}
                          placeholder={t('describeAction')}
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('expectedResult')}</Label>
                        <Textarea
                          value={step.expected_result}
                          onChange={(e) => handleStepChange(step.step_number, 'expected_result', e.target.value)}
                          placeholder={t('describeExpectedResult')}
                          rows={3}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('stepType')}</Label>
                      <Select
                        value={step.step_type}
                        onValueChange={(value) => handleStepChange(step.step_number, 'step_type', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">{t('manual')}</SelectItem>
                          <SelectItem value="automated">{t('automated')}</SelectItem>
                          <SelectItem value="verification">{t('verification')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddStep}
                  className="w-full"
                >
                  <Plus className={`h-4 w-4 ${isRTL ? 'ml-2 mr-0' : 'mr-2'}`} />
                  {t('addStep')}
                </Button>
              </div>
            )}
          </div>

          {!formData.is_multistep && (
            <div>
              <Label htmlFor="expected_result">{t('expectedResult')}</Label>
              <MarkdownEditor
                value={formData.expected_result}
                onChange={(value) => handleInputChange('expected_result', value)}
                placeholder={t('describeExpectedOutcome')}
                rows={4}
                className="mt-1"
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={navigateBack}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {t('saving')}
                </>
              ) : (
                <>
                  <Save className={`h-4 w-4 ${isRTL ? 'ml-2 mr-0' : 'mr-2'}`} />
                  {t('saveChanges')}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}