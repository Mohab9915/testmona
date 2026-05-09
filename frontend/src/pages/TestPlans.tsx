import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, FileText, Search, ChevronLeft, ChevronRight, Edit, Trash2, Calendar, Target, Loader2, Play, FileCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { testPlansAPI, authAPI } from '@/lib/api';

export function TestPlans() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { t, isRTL } = useTranslation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const planNameInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [planName, setPlanName] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [planObjectives, setPlanObjectives] = useState('');
  const [planScopeIn, setPlanScopeIn] = useState('');
  const [planScopeOut, setPlanScopeOut] = useState('');
  const [targetStartDate, setTargetStartDate] = useState('');
  const [targetEndDate, setTargetEndDate] = useState('');
  const [testPlans, setTestPlans] = useState<any[]>([]);
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const itemsPerPage = 10;

  // Load current user and test plans from API
  useEffect(() => {
    const loadData = async () => {
      if (!projectId) {
        setError(t('invalidProjectId'));
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      setError(null);
      try {
        // Load current user
        const user = await authAPI.getCurrentUser();
        setCurrentUser(user);
        
        // Load test plans
        const plans = await testPlansAPI.getAll(parseInt(projectId));
        setTestPlans(plans || []);
        console.log('✅ Test plans loaded:', plans);
      } catch (error: any) {
        console.error('❌ Failed to load data:', error);
        if (error.response?.status === 403) {
          setError(t('permissionDeniedViewTestPlans'));
        } else if (error.response?.status === 404) {
          setError(t('projectNotFound'));
        } else if (error.response?.status === 401) {
          setError(t('authenticationRequired'));
        } else {
          setError(t('failedToLoadTestPlans'));
        }
        setTestPlans([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [projectId]);

  // Auto-focus on name input when dialog opens
  useEffect(() => {
    if (isCreateDialogOpen && planNameInputRef.current) {
      setTimeout(() => planNameInputRef.current?.focus(), 100);
    }
  }, [isCreateDialogOpen]);

  // Track unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(
      planName.trim() !== '' || 
      planDescription.trim() !== '' ||
      planObjectives.trim() !== '' ||
      planScopeIn.trim() !== '' ||
      planScopeOut.trim() !== ''
    );
  }, [planName, planDescription, planObjectives, planScopeIn, planScopeOut]);

  const filteredPlans = testPlans.filter(plan => {
    if (!plan) return false;
    const name = plan.name || '';
    const description = plan.description || '';
    const objectives = plan.test_objectives || '';
    const query = searchQuery.toLowerCase();
    return name.toLowerCase().includes(query) ||
           description.toLowerCase().includes(query) ||
           objectives.toLowerCase().includes(query);
  });

  const totalPages = Math.ceil(filteredPlans.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPlans = filteredPlans.slice(startIndex, startIndex + itemsPerPage);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!planName.trim()) {
      errors.planName = t('testPlanNameRequired');
    }
    
    if (targetStartDate && targetEndDate) {
      const start = new Date(targetStartDate);
      const end = new Date(targetEndDate);
      if (end < start) {
        errors.targetEndDate = t('endDateAfterStartDate');
      }
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreatePlan = async () => {
    if (!projectId || !currentUser) {
      setError(t('missingRequiredInfo'));
      return;
    }
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      const newPlan = await testPlansAPI.create({
        project_id: parseInt(projectId),
        name: planName,
        description: planDescription,
        test_objectives: planObjectives,
        scope_inclusions: planScopeIn,
        scope_exclusions: planScopeOut,
        target_start_date: targetStartDate || null,
        target_end_date: targetEndDate || null,
        status: 'pending',
        created_by: currentUser.id
      });
      
      console.log('✅ Test plan created:', newPlan);
      setSuccessMessage(t('testPlanCreatedSuccessfully'));
      
      // Reload test plans
      const plans = await testPlansAPI.getAll(parseInt(projectId));
      setTestPlans(plans || []);
      
      // Reset form
      setPlanName('');
      setPlanDescription('');
      setPlanObjectives('');
      setPlanScopeIn('');
      setPlanScopeOut('');
      setTargetStartDate('');
      setTargetEndDate('');
      setHasUnsavedChanges(false);
      setValidationErrors({});
      setIsCreateDialogOpen(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('❌ Failed to create test plan:', error);
      if (error.response?.status === 403) {
        setError(t('permissionDeniedCreateTestPlans'));
      } else if (error.response?.status === 400) {
        setError(error.response?.data?.detail || t('invalidDataProvided'));
      } else {
        setError(t('failedToCreateTestPlan'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open && hasUnsavedChanges) {
      setShowUnsavedDialog(true);
    } else {
      setIsCreateDialogOpen(open);
      if (!open) {
        setPlanName('');
        setPlanDescription('');
        setPlanObjectives('');
        setPlanScopeIn('');
        setPlanScopeOut('');
        setTargetStartDate('');
        setTargetEndDate('');
        setHasUnsavedChanges(false);
        setTouchedFields({});
      }
    }
  };

  const handleUnsavedConfirm = (discard: boolean) => {
    setShowUnsavedDialog(false);
    if (discard) {
      setPlanName('');
      setPlanDescription('');
      setPlanObjectives('');
      setPlanScopeIn('');
      setPlanScopeOut('');
      setTargetStartDate('');
      setTargetEndDate('');
      setHasUnsavedChanges(false);
      setTouchedFields({});
      setIsCreateDialogOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleCreatePlan();
    }
  };

  const handleEditPlan = (plan: any) => {
    setSelectedPlan(plan);
    setPlanName(plan.name);
    setPlanDescription(plan.description);
    setPlanObjectives(plan.test_objectives);
    setPlanScopeIn(plan.scope_inclusions);
    setPlanScopeOut(plan.scope_exclusions);
    setTargetStartDate(plan.target_start_date);
    setTargetEndDate(plan.target_end_date);
    setIsEditDialogOpen(true);
  };

  const handleUpdatePlan = async () => {
    if (!selectedPlan || !projectId) {
      setError(t('missingRequiredInfo'));
      return;
    }
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      const updatedPlan = await testPlansAPI.update(selectedPlan.id, {
        name: planName,
        description: planDescription,
        test_objectives: planObjectives,
        scope_inclusions: planScopeIn,
        scope_exclusions: planScopeOut,
        target_start_date: targetStartDate || null,
        target_end_date: targetEndDate || null
      });
      
      console.log('✅ Test plan updated:', updatedPlan);
      setSuccessMessage(t('testPlanUpdatedSuccessfully'));
      
      // Reload test plans
      const plans = await testPlansAPI.getAll(parseInt(projectId));
      setTestPlans(plans || []);
      
      // Reset form and close dialog
      setPlanName('');
      setPlanDescription('');
      setPlanObjectives('');
      setPlanScopeIn('');
      setPlanScopeOut('');
      setTargetStartDate('');
      setTargetEndDate('');
      setSelectedPlan(null);
      setValidationErrors({});
      setIsEditDialogOpen(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('❌ Failed to update test plan:', error);
      if (error.response?.status === 403) {
        setError(t('permissionDeniedUpdateTestPlans'));
      } else if (error.response?.status === 404) {
        setError(t('testPlanNotFound'));
      } else if (error.response?.status === 400) {
        setError(error.response?.data?.detail || t('invalidDataProvided'));
      } else {
        setError(t('failedToUpdateTestPlan'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewTestRuns = (planId: number) => {
    // Navigate to test runs filtered by this test plan
    navigate(`/projects/${projectId}/test-runs?test_plan_id=${planId}`);
  };

  const handleGenerateReport = (planId: number) => {
    // Navigate to reports filtered by this test plan
    navigate(`/projects/${projectId}/reports?test_plan_id=${planId}`);
  };

  const handleDeletePlan = async (planId: number) => {
    if (!confirm(t('confirmDeleteTestPlan'))) return;
    
    try {
      setIsDeleting(planId);
      setError(null);
      
      await testPlansAPI.delete(planId);
      console.log('✅ Test plan deleted:', planId);
      setSuccessMessage(t('testPlanDeletedSuccessfully'));
      
      // Reload test plans
      if (projectId) {
        const plans = await testPlansAPI.getAll(parseInt(projectId));
        setTestPlans(plans || []);
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('❌ Failed to delete test plan:', error);
      if (error.response?.status === 403) {
        setError(t('permissionDeniedDeleteTestPlans'));
      } else if (error.response?.status === 404) {
        setError(t('testPlanAlreadyDeleted'));
      } else {
        setError(t('failedToDeleteTestPlan'));
      }
    } finally {
      setIsDeleting(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    };
    return variants[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return t('notSet');
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return t('invalidDate');
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Success Alert */}
      {successMessage && (
        <Alert className="bg-green-50 border-green-200 text-green-800">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('testPlansTitle')}</h1>
          <p className="text-gray-600">{t('testPlansDescription')}</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t('createTestPlan')}
            </Button>
          </DialogTrigger>
          <DialogContent isRTL={isRTL} className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto" onKeyDown={handleKeyDown}>
            <DialogHeader>
              <DialogTitle>{t('createNewTestPlan')}</DialogTitle>
              <DialogDescription>
                {t('createTestPlanDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="planName" className="text-right">
                  {t('name')}
                </Label>
                <div className="col-span-3 space-y-1">
                  <Input
                    ref={planNameInputRef}
                    id="planName"
                    value={planName}
                    onChange={(e) => {
                      setPlanName(e.target.value);
                      if (validationErrors.planName) {
                        setValidationErrors({...validationErrors, planName: ''});
                      }
                    }}
                    onBlur={() => setTouchedFields({...touchedFields, planName: true})}
                    className={validationErrors.planName ? 'border-red-300 focus:border-red-500' : ''}
                    placeholder={t('enterTestPlanName')}
                    maxLength={200}
                  />
                  {validationErrors.planName && (
                    <span className="text-xs text-red-500">{validationErrors.planName}</span>
                  )}
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{t('enterTestPlanName')}</span>
                    <span>{planName.length}/200</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="planDescription" className="text-right pt-2">
                  {t('description')}
                </Label>
                <div className="col-span-3 space-y-1">
                  <Textarea
                    id="planDescription"
                    value={planDescription}
                    onChange={(e) => setPlanDescription(e.target.value)}
                    placeholder={t('testPlanDescribe')}
                    rows={2}
                    maxLength={1000}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{t('testPlanDescribe')}</span>
                    <span>{planDescription.length}/1000</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="planObjectives" className="text-right pt-2">
                  {t('testPlanObjectivesLabel')}
                </Label>
                <div className="col-span-3 space-y-1">
                  <Textarea
                    id="planObjectives"
                    value={planObjectives}
                    onChange={(e) => setPlanObjectives(e.target.value)}
                    placeholder={t('testPlanGoals')}
                    rows={2}
                    maxLength={2000}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{t('testPlanGoals')}</span>
                    <span>{planObjectives.length}/2000</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="scopeIn" className="text-right pt-2">
                  {t('scopeIn')}
                </Label>
                <div className="col-span-3 space-y-1">
                  <Textarea
                    id="scopeIn"
                    value={planScopeIn}
                    onChange={(e) => setPlanScopeIn(e.target.value)}
                    placeholder={t('scopeInPlaceholder')}
                    rows={2}
                    maxLength={2000}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{t('scopeInPlaceholder')}</span>
                    <span>{planScopeIn.length}/2000</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="scopeOut" className="text-right pt-2">
                  {t('scopeOut')}
                </Label>
                <div className="col-span-3 space-y-1">
                  <Textarea
                    id="scopeOut"
                    value={planScopeOut}
                    onChange={(e) => setPlanScopeOut(e.target.value)}
                    placeholder={t('scopeOutPlaceholder')}
                    rows={2}
                    maxLength={2000}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{t('scopeOutPlaceholder')}</span>
                    <span>{planScopeOut.length}/2000</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">{t('targetStartDate')}</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={targetStartDate}
                    onChange={(e) => {
                      setTargetStartDate(e.target.value);
                      if (validationErrors.targetEndDate) {
                        setValidationErrors({...validationErrors, targetEndDate: ''});
                      }
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">{t('targetEndDate')}</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={targetEndDate}
                    onChange={(e) => {
                      setTargetEndDate(e.target.value);
                      if (validationErrors.targetEndDate) {
                        setValidationErrors({...validationErrors, targetEndDate: ''});
                      }
                    }}
                    className={validationErrors.targetEndDate ? 'border-red-300 focus:border-red-500' : ''}
                  />
                  {validationErrors.targetEndDate && (
                    <span className="text-xs text-red-500">{validationErrors.targetEndDate}</span>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <div className="text-xs text-gray-500 mb-2 sm:mb-0 sm:mr-auto">
                {t('ctrlEnterToSubmit')}
              </div>
              <Button
                variant="outline"
                onClick={() => handleDialogClose(false)}
              >
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                onClick={handleCreatePlan}
                disabled={!planName.trim() || !currentUser || isSubmitting}
                className="transition-all duration-200"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('creating')}
                  </>
                ) : currentUser ? t('createTestPlan') : t('loading')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Unsaved Changes Confirmation Dialog */}
        <Dialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
          <DialogContent isRTL={isRTL} className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>{t('unsavedChanges')}</DialogTitle>
              <DialogDescription>
                {t('unsavedChangesMessage')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleUnsavedConfirm(false)}>
                {t('continueEditing')}
              </Button>
              <Button onClick={() => handleUnsavedConfirm(true)}>
                {t('discardChanges')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mr-2" />
          <span className="text-gray-600">{t('loadingTestPlans')}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={t('searchTestPlans')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Test Plans List */}
      <div className="space-y-4">
        {!isLoading && paginatedPlans.length > 0 ? (
          paginatedPlans.map((plan) => (
            <Card key={plan.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={getStatusBadge(plan.status)}>
                        {plan.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg mb-1">{plan.name}</CardTitle>
                    <p className="text-sm text-gray-600 mb-2">{plan.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(plan.target_start_date)} - {formatDate(plan.target_end_date)}</span>
                      </div>
                      {plan.actual_end_date && (
                        <div className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          <span>{t('completed')} {formatDate(plan.actual_end_date)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">
                    {t('testPlanCreated')} {new Date(plan.created_at).toLocaleDateString()}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-1">{t('testPlanObjectives')}</h4>
                    <p className="text-sm text-gray-600">{plan.test_objectives}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">{t('scopeIn')}:</h4>
                      <p className="text-gray-600">{plan.scope_inclusions}</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">{t('scopeOut')}:</h4>
                      <p className="text-gray-600">{plan.scope_exclusions}</p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleEditPlan(plan)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    {t('edit')}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleViewTestRuns(plan.id)}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    {t('viewTestRuns')}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleGenerateReport(plan.id)}
                  >
                    <FileCheck className="h-4 w-4 mr-1" />
                    {t('generateReport')}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-red-600 hover:text-red-700"
                    onClick={() => handleDeletePlan(plan.id)}
                    disabled={isDeleting === plan.id}
                  >
                    {isDeleting === plan.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        {t('deleting')}
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-1" />
                        {t('delete')}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-semibold text-gray-900">
                  {searchQuery ? t('noTestPlansFound') : t('noRequirements')}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchQuery
                    ? t('tryAdjustingSearchTerms')
                    : t('createFirstTestPlan')
                  }
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow mt-4">
          <div className="text-sm text-gray-600">
            {t('showing', { start: startIndex + 1, end: Math.min(startIndex + itemsPerPage, filteredPlans.length), total: filteredPlans.length })} {t('testPlansTitle').toLowerCase()}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              {t('previous')}
            </Button>
            <span className="text-sm text-gray-600">
              {t('pageOf', { current: currentPage, total: totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              {t('next')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit Test Plan Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('editTestPlan')}: {selectedPlan?.name}</DialogTitle>
            <DialogDescription>
              {t('editTestPlanDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editPlanName" className="text-right">
                {t('name')}
              </Label>
              <div className="col-span-3 space-y-1">
                <Input
                  id="editPlanName"
                  value={planName}
                  onChange={(e) => {
                    setPlanName(e.target.value);
                    if (validationErrors.planName) {
                      setValidationErrors({...validationErrors, planName: ''});
                    }
                  }}
                  className={validationErrors.planName ? 'border-red-300 focus:border-red-500' : ''}
                  placeholder={t('enterTestPlanName')}
                />
                {validationErrors.planName && (
                  <span className="text-xs text-red-500">{validationErrors.planName}</span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="editPlanDescription" className="text-right pt-2">
                {t('description')}
              </Label>
              <Textarea
                id="editPlanDescription"
                value={planDescription}
                onChange={(e) => setPlanDescription(e.target.value)}
                className="col-span-3"
                placeholder={t('testPlanDescribe')}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="editPlanObjectives" className="text-right pt-2">
                {t('testPlanObjectivesLabel')}
              </Label>
              <Textarea
                id="editPlanObjectives"
                value={planObjectives}
                onChange={(e) => setPlanObjectives(e.target.value)}
                className="col-span-3"
                placeholder={t('testPlanGoals')}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="editScopeIn" className="text-right pt-2">
                {t('scopeIn')}
              </Label>
              <Textarea
                id="editScopeIn"
                value={planScopeIn}
                onChange={(e) => setPlanScopeIn(e.target.value)}
                className="col-span-3"
                placeholder={t('scopeInPlaceholder')}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="editScopeOut" className="text-right pt-2">
                {t('scopeOut')}
              </Label>
              <Textarea
                id="editScopeOut"
                value={planScopeOut}
                onChange={(e) => setPlanScopeOut(e.target.value)}
                className="col-span-3"
                placeholder={t('scopeOutPlaceholder')}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editStartDate">{t('targetStartDate')}</Label>
                <Input
                  id="editStartDate"
                  type="date"
                  value={targetStartDate}
                  onChange={(e) => {
                    setTargetStartDate(e.target.value);
                    if (validationErrors.targetEndDate) {
                      setValidationErrors({...validationErrors, targetEndDate: ''});
                    }
                  }}
                />
              </div>
              <div>
                <Label htmlFor="editEndDate">{t('targetEndDate')}</Label>
                <Input
                  id="editEndDate"
                  type="date"
                  value={targetEndDate}
                  onChange={(e) => {
                    setTargetEndDate(e.target.value);
                    if (validationErrors.targetEndDate) {
                      setValidationErrors({...validationErrors, targetEndDate: ''});
                    }
                  }}
                  className={validationErrors.targetEndDate ? 'border-red-300 focus:border-red-500' : ''}
                />
                {validationErrors.targetEndDate && (
                  <span className="text-xs text-red-500">{validationErrors.targetEndDate}</span>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              onClick={handleUpdatePlan}
              disabled={!planName.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('updating')}
                </>
              ) : t('updateTestPlan')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}