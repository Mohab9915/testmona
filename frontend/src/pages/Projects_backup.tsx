import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, FolderOpen, Settings, Trash2, TestTube, FileText, PlayCircle, ChevronRight, AlertTriangle, Edit, WifiOff, RefreshCw, Database, Archive, Copy, UserPlus, LayoutTemplate } from 'lucide-react';
import { useProjectStore, type Project } from '@/stores/projectStore';
import { useToast } from '@/hooks/use-toast';
import { projectsAPI } from '@/lib/api';
import { validateProject, getCharacterCount, sanitizeInput } from '@/utils/validation';


export function Projects() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedProject, setSelectedProject, projects: storeProjects, setProjects: setStoreProjects } = useProjectStore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackendDown, setIsBackendDown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Bulk operations states
  const [selectedProjects, setSelectedProjects] = useState<Set<number>>(new Set());
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isBulkArchiveDialogOpen, setIsBulkArchiveDialogOpen] = useState(false);
  const [bulkConfirmationText, setBulkConfirmationText] = useState('');
  
  // Advanced features states
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [statusProject, setStatusProject] = useState<Project | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [transferProject, setTransferProject] = useState<Project | null>(null);
  const [newOwnerId, setNewOwnerId] = useState('');
  const [availableUsers, setAvailableUsers] = useState<Array<{id: number, email: string, name: string}>>([]);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);
  const [cloneProject, setCloneProject] = useState<Project | null>(null);
  const [cloneName, setCloneName] = useState('');
  const [cloneDescription, setCloneDescription] = useState('');

  // Initialize projects on component mount with backend connectivity check
  useEffect(() => {
    const initializeProjects = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Try to fetch projects from backend
        const backendProjects = await projectsAPI.getAll();
        setProjects(backendProjects);
        setStoreProjects(backendProjects);
        setIsBackendDown(false);
      } catch (err) {
        console.warn('Backend unavailable:', err);
        setIsBackendDown(true);
        setProjects([]);
        setStoreProjects([]);
        setError('Unable to connect to the backend server. Please check your connection and try again.');
      } finally {
        setIsLoading(false);
      }
    };

    initializeProjects();
  }, []);

  const handleCreateProject = async () => {
    if (isBackendDown) {
      toast({
        title: "Connection Error",
        description: "Cannot create project while backend is unavailable.",
        variant: "destructive",
      });
      return;
    }

    try {
      const newProject = await projectsAPI.create({
        name: projectName,
        description: projectDescription,
        status: 'active',
      });

      const updatedProjects = [...projects, newProject];
      setProjects(updatedProjects);
      setStoreProjects(updatedProjects);
      
      toast({
        title: "Success",
        description: `Project "${projectName}" created successfully.`,
      });
      
      setProjectName('');
      setProjectDescription('');
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: "Error",
        description: "Failed to create project. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSelectAndNavigate = (project: Project, path: string) => {
    setSelectedProject(project);
    navigate(path);
  };

  const handleViewTestSuites = (project: Project) => {
    handleSelectAndNavigate(project, `/projects/${project.id}/test-suites`);
  };

  const handleViewTestCases = (project: Project) => {
    handleSelectAndNavigate(project, `/projects/${project.id}/test-cases`);
  };

  const handleViewTestRuns = (project: Project) => {
    handleSelectAndNavigate(project, `/projects/${project.id}/test-runs`);
  };

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    // Navigate to project overview or test cases
    navigate(`/projects/${project.id}/test-cases`);
  };

  const handleOpenDeleteDialog = (project: Project) => {
    setProjectToDelete(project);
    setDeleteConfirmationName('');
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    
    if (isBackendDown) {
      toast({
        title: "Connection Error",
        description: "Cannot delete project while backend is unavailable.",
        variant: "destructive",
      });
      return;
    }
    
    // Verify the project name matches
    if (deleteConfirmationName !== projectToDelete.name) {
      toast({
        title: "Error",
        description: "Project name doesn't match. Please type the exact project name to confirm deletion.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Call API to delete project (this will cascade delete all related data)
      await projectsAPI.delete(projectToDelete.id);

      const updatedProjects = projects.filter(p => p.id !== projectToDelete.id);
      setProjects(updatedProjects);
      setStoreProjects(updatedProjects);
      
      toast({
        title: "Success",
        description: `Project "${projectToDelete.name}" and all related data have been deleted successfully.`,
      });
      
      setIsDeleteDialogOpen(false);
      setProjectToDelete(null);
      setDeleteConfirmationName('');
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: "Error",
        description: "Failed to delete project. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleOpenEditDialog = (project: Project) => {
    setEditingProject(project);
    setProjectName(project.name);
    setProjectDescription(project.description || '');
    setIsEditDialogOpen(true);
  };

  const handleUpdateProject = async () => {
    if (!editingProject) return;
    
    if (isBackendDown) {
      toast({
        title: "Connection Error",
        description: "Cannot update project while backend is unavailable.",
        variant: "destructive",
      });
      return;
    }

    try {
      const updatedProject = await projectsAPI.update(editingProject.id, {
        name: projectName,
        description: projectDescription,
      });

      const updatedProjects = projects.map(p => 
        p.id === editingProject.id ? { ...p, name: projectName, description: projectDescription, updated_at: new Date().toISOString() } : p
      );
      setProjects(updatedProjects);
      setStoreProjects(updatedProjects);
      
      toast({
        title: "Success",
        description: "Project updated successfully.",
      });
      
      setIsEditDialogOpen(false);
      setEditingProject(null);
      setProjectName('');
      setProjectDescription('');
    } catch (error) {
      console.error('Error updating project:', error);
      toast({
        title: "Error",
        description: "Failed to update project. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Bulk operations handlers
  const toggleProjectSelection = (projectId: number) => {
    const newSelection = new Set(selectedProjects);
    if (newSelection.has(projectId)) {
      newSelection.delete(projectId);
    } else {
      newSelection.add(projectId);
    }
    setSelectedProjects(newSelection);
  };

  const toggleAllProjects = () => {
    if (selectedProjects.size === projects.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(projects.map(p => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProjects.size === 0) return;
    
    if (isBackendDown) {
      toast({
        title: "Connection Error",
        description: "Cannot delete projects while backend is unavailable.",
        variant: "destructive",
      });
      return;
    }

    if (bulkConfirmationText !== `DELETE ${selectedProjects.size}`) {
      toast({
        title: "Error",
        description: "Confirmation text doesn't match. Please type exact confirmation text.",
        variant: "destructive",
      });
      return;
    }

    try {
      const deletePromises = Array.from(selectedProjects).map(id => projectsAPI.delete(id));
      await Promise.all(deletePromises);

      const updatedProjects = projects.filter(p => !selectedProjects.has(p.id));
      setProjects(updatedProjects);
      setStoreProjects(updatedProjects);
      
      toast({
        title: "Success",
        description: `${selectedProjects.size} project(s) deleted successfully.`,
      });
      
      setSelectedProjects(new Set());
      setIsBulkDeleteDialogOpen(false);
      setBulkConfirmationText('');
    } catch (error) {
      console.error('Error bulk deleting projects:', error);
      toast({
        title: "Error",
        description: "Failed to delete some projects. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleBulkArchive = async () => {
    if (selectedProjects.size === 0) return;
    
    if (isBackendDown) {
      toast({
        title: "Connection Error",
        description: "Cannot archive projects while backend is unavailable.",
        variant: "destructive",
      });
      return;
    }

    try {
      const archivePromises = Array.from(selectedProjects).map(id => 
        projectsAPI.update(id, { status: 'archived' })
      );
      await Promise.all(archivePromises);

      const updatedProjects = projects.map(p => 
        selectedProjects.has(p.id) ? { ...p, status: 'archived' } : p
      );
      setProjects(updatedProjects);
      setStoreProjects(updatedProjects);
      
      toast({
        title: "Success",
        description: `${selectedProjects.size} project(s) archived successfully.`,
      });
      
      setSelectedProjects(new Set());
      setIsBulkArchiveDialogOpen(false);
    } catch (error) {
      console.error('Error bulk archiving projects:', error);
      toast({
        title: "Error",
        description: "Failed to archive some projects. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Advanced features handlers
  const handleStatusChange = async () => {
    if (!statusProject) return;
    
    if (isBackendDown) {
      toast({
        title: "Connection Error",
        description: "Cannot update project status while backend is unavailable.",
        variant: "destructive",
      });
      return;
    }

    try {
      await projectsAPI.update(statusProject.id, { status: newStatus });
      
      const updatedProjects = projects.map(p => 
        p.id === statusProject.id ? { ...p, status: newStatus } : p
      );
      setProjects(updatedProjects);
      setStoreProjects(updatedProjects);
      
      toast({
        title: "Success",
        description: `Project status changed to ${newStatus}.`,
      });
      
      setIsStatusDialogOpen(false);
      setStatusProject(null);
      setNewStatus('');
    } catch (error) {
      console.error('Error updating project status:', error);
      toast({
        title: "Error",
        description: "Failed to update project status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCloneProject = async () => {
    if (!cloneProject || !cloneName.trim()) return;
    
    if (isBackendDown) {
      toast({
        title: "Connection Error",
        description: "Cannot clone project while backend is unavailable.",
        variant: "destructive",
      });
      return;
    }

    try {
      const clonedProject = await projectsAPI.create({
        name: sanitizeInput(cloneName),
        description: sanitizeInput(cloneDescription),
        status: 'active',
        cloned_from: cloneProject.id
      });

      const updatedProjects = [...projects, clonedProject];
      setProjects(updatedProjects);
      setStoreProjects(updatedProjects);
      
      toast({
        title: "Success",
        description: `Project "${cloneName}" cloned successfully.`,
      });
      
      setIsCloneDialogOpen(false);
      setCloneProject(null);
      setCloneName('');
      setCloneDescription('');
    } catch (error) {
      console.error('Error cloning project:', error);
      toast({
        title: "Error",
        description: "Failed to clone project. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Backend Status Alert */}
      {isBackendDown && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <WifiOff className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-red-800">Backend Unavailable</h3>
                <p className="mt-1 text-sm text-red-700">
                  {error || 'Unable to connect to the backend server. Please check your connection and try again.'}
                </p>
                <div className="mt-3 flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.location.reload()}
                    className="text-red-700 border-red-300 hover:bg-red-100"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Retry Connection
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsBackendDown(false)}
                    className="text-red-700 border-red-300 hover:bg-red-100"
                  >
                    <Database className="h-4 w-4 mr-1" />
                    Check Status
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-gray-600">
            {isBackendDown ? 'Backend unavailable - Cannot manage projects' : 'Manage your test projects'}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={isBackendDown}>
              <Plus className="h-4 w-4 mr-2" />
              Add New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Add a new project to organize your test suites and cases.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="col-span-3"
                  placeholder="Enter project name"
                />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="description" className="text-right pt-2">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  className="col-span-3"
                  placeholder="Enter project description (optional)"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                onClick={handleCreateProject}
                disabled={!projectName.trim()}
              >
                Create Project
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Projects List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {isLoading ? (
        <div className="col-span-full bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">Loading projects...</p>
            </div>
          </div>
        </div>
      ) : projects.length > 0 ? (
          projects.map((project) => (
            <Card 
              key={project.id} 
              className={`hover:shadow-lg transition-all cursor-pointer ${
                selectedProject?.id === project.id ? 'ring-2 ring-blue-500 shadow-lg' : ''
              }`}
              onClick={() => handleSelectProject(project)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">{project.description}</p>
                  </div>
                  {selectedProject?.id === project.id && (
                    <div className="ml-2 p-1 bg-blue-100 rounded">
                      <ChevronRight className="h-5 w-5 text-blue-600" />
                    </div>
                  )}
                </div>
                <Badge className={`w-fit ${
                  project.status === 'active' ? 'bg-green-100 text-green-800' :
                  project.status === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
                  project.status === 'archived' ? 'bg-gray-100 text-gray-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{project.test_suites_count}</div>
                      <div className="text-xs text-gray-600">Test Suites</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">{project.test_cases_count}</div>
                      <div className="text-xs text-gray-600">Test Cases</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-purple-600">{project.test_runs_count}</div>
                      <div className="text-xs text-gray-600">Test Runs</div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewTestSuites(project);
                      }}
                      className="flex-1"
                    >
                      <TestTube className="h-4 w-4 mr-1" />
                      Suites
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewTestCases(project);
                      }}
                      className="flex-1"
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      Cases
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewTestRuns(project);
                      }}
                      className="flex-1"
                    >
                      <PlayCircle className="h-4 w-4 mr-1" />
                      Runs
                    </Button>
                  </div>
                  
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-xs text-gray-500">
                      Created: {new Date(project.created_at).toLocaleDateString()}
                      {project.updated_at && project.updated_at !== project.created_at && (
                        <span className="ml-2">• Updated: {new Date(project.updated_at).toLocaleDateString()}</span>
                      )}
                    </span>
                    <div className="flex gap-1">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditDialog(project);
                        }}
                        title="Edit project"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDeleteDialog(project);
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Delete project"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : isBackendDown ? (
          <div className="col-span-full">
            <Card className="border-dashed border-gray-300 bg-gray-50">
              <CardContent className="pt-12 pb-12">
                <div className="text-center">
                  <WifiOff className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Backend Connection Lost</h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    Cannot connect to the backend server. Project management features are unavailable until the connection is restored.
                  </p>
                  <div className="space-y-3">
                    <div className="flex justify-center space-x-3">
                      <Button 
                        onClick={() => window.location.reload()}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retry Connection
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => setIsBackendDown(false)}
                      >
                        Check Status
                      </Button>
                    </div>
                    <div className="text-sm text-gray-500">
                      <p>Possible causes:</p>
                      <ul className="mt-1 space-y-1">
                        <li>• Backend server is not running</li>
                        <li>• Network connectivity issues</li>
                        <li>• Server maintenance in progress</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="col-span-full">
            <Card className="border-dashed border-gray-300 bg-gradient-to-br from-blue-50 to-indigo-50">
              <CardContent className="pt-12 pb-12">
                <div className="text-center max-w-lg mx-auto">
                  <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <FolderOpen className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Start Your First Project</h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    This application is project-first. Create a project to organize your test suites,
                    test cases, and manage your entire testing workflow.
                  </p>
                  <div className="space-y-3">
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700">
                          <Plus className="h-4 w-4 mr-2" />
                          Create Your First Project
                        </Button>
                      </DialogTrigger>
                    </Dialog>
                    <div className="text-sm text-gray-500 space-y-1">
                      <p>✓ Organize test suites and cases</p>
                      <p>✓ Track test runs and results</p>
                      <p>✓ Manage defects and milestones</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Edit Project Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update the project details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">
                Name
              </Label>
              <Input
                id="edit-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="col-span-3"
                placeholder="Enter project name"
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="edit-description" className="text-right pt-2">
                Description
              </Label>
              <Textarea
                id="edit-description"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                className="col-span-3"
                placeholder="Enter project description (optional)"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingProject(null);
                setProjectName('');
                setProjectDescription('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              onClick={handleUpdateProject}
              disabled={!projectName.trim()}
            >
              Update Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Project - Confirmation Required
            </AlertDialogTitle>
            <div className="space-y-4">
              <div className="text-sm">
                <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  You are about to permanently delete the project:
                </p>
                <p className="font-bold text-lg text-red-600 dark:text-red-400 mb-3">
                  "{projectToDelete?.name}"
                </p>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 mb-3">
                  <p className="font-semibold text-red-800 dark:text-red-200 mb-2">
                    ⚠️ This action will permanently delete:
                  </p>
                  <ul className="text-xs text-red-700 dark:text-red-300 space-y-1 ml-4 list-disc">
                    <li>All test suites in this project</li>
                    <li>All test cases in this project</li>
                    <li>All test runs and their results</li>
                    <li>All test plans and milestones</li>
                    <li>All requirements and defects</li>
                    <li>All reports and analytics data</li>
                    <li>All project settings and configurations</li>
                    <li>All custom fields and integrations</li>
                  </ul>
                </div>
                <p className="text-red-600 dark:text-red-400 font-semibold mb-2">
                  This action cannot be undone!
                </p>
                <div className="mt-4">
                  <Label htmlFor="confirm-name" className="text-sm font-medium">
                    To confirm, type the project name: <span className="font-bold">{projectToDelete?.name}</span>
                  </Label>
                  <Input
                    id="confirm-name"
                    value={deleteConfirmationName}
                    onChange={(e) => setDeleteConfirmationName(e.target.value)}
                    placeholder="Type project name here"
                    className="mt-2"
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsDeleteDialogOpen(false);
              setProjectToDelete(null);
              setDeleteConfirmationName('');
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              disabled={deleteConfirmationName !== projectToDelete?.name}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
