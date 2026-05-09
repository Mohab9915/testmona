import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Search, Copy, TrendingUp, AlertCircle } from 'lucide-react';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

export function SharedSteps() {
  const { projectId } = useParams<{ projectId: string }>();
  const { t, isRTL } = useTranslation();
  const [sharedSteps, setSharedSteps] = useState<any[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedStep, setSelectedStep] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const stepNameInputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    action: '',
    expected_result: '',
    project_id: ''
  });
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  // Load shared steps from API
  const loadSharedSteps = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const url = projectId 
        ? `${API_BASE_URL}/shared-steps/?project_id=${projectId}`
        : `${API_BASE_URL}/shared-steps/`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load shared steps');
      }

      const data = await response.json();
      setSharedSteps(data);
    } catch (error) {
      console.error('Failed to load shared steps:', error);
      setError('Failed to load shared steps. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSharedSteps();
  }, [projectId]);

  // Auto-focus on name input when dialog opens
  useEffect(() => {
    if (isCreateDialogOpen && stepNameInputRef.current) {
      setTimeout(() => stepNameInputRef.current?.focus(), 100);
    }
  }, [isCreateDialogOpen]);

  // Track unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(
      formData.name.trim() !== '' || 
      formData.description.trim() !== '' ||
      formData.action.trim() !== '' ||
      formData.expected_result.trim() !== ''
    );
  }, [formData.name, formData.description, formData.action, formData.expected_result]);

  const handleCreateSharedStep = async () => {
    try {
      setIsCreating(true);
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      if (!projectId) {
        throw new Error('Project ID is required');
      }

      const response = await fetch(`${API_BASE_URL}/shared-steps/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          action: formData.action,
          expected_result: formData.expected_result,
          project_id: parseInt(projectId),
          created_by: 1
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create shared step');
      }

      resetForm();
      setHasUnsavedChanges(false);
      setIsCreateDialogOpen(false);
      await loadSharedSteps();
    } catch (error) {
      console.error('Failed to create shared step:', error);
      setError('Failed to create shared step. Please try again.');
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
        resetForm();
        setHasUnsavedChanges(false);
        setTouchedFields({});
      }
    }
  };

  const handleUnsavedConfirm = (discard: boolean) => {
    setShowUnsavedDialog(false);
    if (discard) {
      resetForm();
      setHasUnsavedChanges(false);
      setTouchedFields({});
      setIsCreateDialogOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleCreateSharedStep();
    }
  };

  const handleEditSharedStep = async () => {
    if (!selectedStep) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_BASE_URL}/shared-steps/${selectedStep.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          action: formData.action,
          expected_result: formData.expected_result
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update shared step');
      }

      resetForm();
      setIsEditDialogOpen(false);
      setSelectedStep(null);
      await loadSharedSteps();
    } catch (error) {
      console.error('Failed to update shared step:', error);
      setError('Failed to update shared step. Please try again.');
    }
  };

  const handleDeleteSharedStep = async (stepId: number) => {
    if (!confirm('Are you sure you want to delete this shared step? This will deactivate it and remove it from all test cases that use it.')) return;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_BASE_URL}/shared-steps/${stepId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete shared step');
      }

      await loadSharedSteps();
    } catch (error) {
      console.error('Failed to delete shared step:', error);
      setError('Failed to delete shared step. Please try again.');
    }
  };

  const handleDuplicateStep = async (step: any) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_BASE_URL}/shared-steps/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `${step.name} (Copy)`,
          description: step.description,
          action: step.action,
          expected_result: step.expected_result,
          project_id: step.project_id,
          created_by: 1
        })
      });

      if (!response.ok) {
        throw new Error('Failed to duplicate shared step');
      }

      await loadSharedSteps();
    } catch (error) {
      console.error('Failed to duplicate shared step:', error);
      setError('Failed to duplicate shared step. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      action: '',
      expected_result: '',
      project_id: ''
    });
  };

  const openEditDialog = (step: any) => {
    setSelectedStep(step);
    setFormData({
      name: step.name,
      description: step.description,
      action: step.action,
      expected_result: step.expected_result,
      project_id: step.project_id
    });
    setIsEditDialogOpen(true);
  };

  const filteredSteps = sharedSteps.filter(step => {
    const matchesSearch = step.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         step.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch && step.is_active;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Shared Steps</h1>
          <p className="text-gray-600">Manage reusable test steps to reduce duplication</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Shared Step
            </Button>
          </DialogTrigger>
          <DialogContent isRTL={isRTL} className="sm:max-w-[600px]" onKeyDown={handleKeyDown}>
            <DialogHeader>
              <DialogTitle>Create New Shared Step</DialogTitle>
              <DialogDescription>
                Create a reusable test step that can be used across multiple test cases.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name *
                </Label>
                <div className="col-span-3 space-y-1">
                  <Input
                    ref={stepNameInputRef}
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    onBlur={() => setTouchedFields({...touchedFields, name: true})}
                    className={touchedFields.name && formData.name.trim() === '' ? 'border-red-300 focus:border-red-500' : ''}
                    placeholder="Enter step name"
                    maxLength={100}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Enter step name</span>
                    <span>{formData.name.length}/100</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="description" className="text-right pt-2">
                  Description
                </Label>
                <div className="col-span-3 space-y-1">
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Enter step description"
                    rows={2}
                    maxLength={500}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Enter step description</span>
                    <span>{formData.description.length}/500</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="action" className="text-right pt-2">
                  Action *
                </Label>
                <div className="col-span-3 space-y-1">
                  <Textarea
                    id="action"
                    value={formData.action}
                    onChange={(e) => setFormData({...formData, action: e.target.value})}
                    placeholder="Describe the action to perform"
                    rows={3}
                    maxLength={1000}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Describe the action to perform</span>
                    <span>{formData.action.length}/1000</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="expected_result" className="text-right pt-2">
                  Expected Result *
                </Label>
                <div className="col-span-3 space-y-1">
                  <Textarea
                    id="expected_result"
                    value={formData.expected_result}
                    onChange={(e) => setFormData({...formData, expected_result: e.target.value})}
                    placeholder="Describe the expected result"
                    rows={3}
                    maxLength={1000}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Describe the expected result</span>
                    <span>{formData.expected_result.length}/1000</span>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <div className="text-xs text-gray-500 mb-2 sm:mb-0 sm:mr-auto">
                Ctrl+Enter to submit
              </div>
              <Button
                variant="outline"
                onClick={() => handleDialogClose(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                onClick={handleCreateSharedStep}
                disabled={!formData.name.trim() || !formData.action.trim() || !formData.expected_result.trim() || !projectId || isCreating}
                className="transition-all duration-200"
              >
                {isCreating ? 'Creating...' : 'Create Shared Step'}
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

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={t('searchSharedSteps')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Shared Steps List */}
      {!loading && (
        <div className="grid gap-4">
          {filteredSteps.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {searchTerm ? 'No shared steps found' : 'No shared steps yet'}
                </h3>
                <p className="text-gray-600 text-center mb-4">
                  {searchTerm 
                    ? 'Try adjusting your search terms'
                    : projectId 
                      ? 'Create your first shared step to reuse across test cases'
                      : 'Select a project to view its shared steps'
                  }
                </p>
                {!searchTerm && projectId && (
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Shared Step
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredSteps.map((step) => (
              <Card key={step.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 mr-4">
                      <CardTitle className="text-lg truncate" title={step.name}>
                        {step.name}
                      </CardTitle>
                      <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center text-sm text-gray-500">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Used {step.usage_count || 0} times
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDuplicateStep(step)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(step)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteSharedStep(step.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <h4 className="font-medium text-sm text-gray-700">Action:</h4>
                      <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">{step.action}</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-gray-700">Expected Result:</h4>
                      <p className="text-sm text-gray-600 bg-green-50 p-2 rounded">{step.expected_result}</p>
                    </div>
                    <div className="text-xs text-gray-500">
                      Created: {new Date(step.created_at).toLocaleString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Shared Step</DialogTitle>
            <DialogDescription>
              Update the shared step details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">
                Name *
              </Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="col-span-3"
                placeholder="Enter step name"
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="edit-description" className="text-right pt-2">
                Description
              </Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="col-span-3"
                placeholder="Enter step description"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="edit-action" className="text-right pt-2">
                Action *
              </Label>
              <Textarea
                id="edit-action"
                value={formData.action}
                onChange={(e) => setFormData({...formData, action: e.target.value})}
                className="col-span-3"
                placeholder="Describe the action to perform"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="edit-expected_result" className="text-right pt-2">
                Expected Result *
              </Label>
              <Textarea
                id="edit-expected_result"
                value={formData.expected_result}
                onChange={(e) => setFormData({...formData, expected_result: e.target.value})}
                className="col-span-3"
                placeholder="Describe the expected result"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              onClick={handleEditSharedStep}
              disabled={!formData.name.trim() || !formData.action.trim() || !formData.expected_result.trim()}
            >
              Update Shared Step
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
