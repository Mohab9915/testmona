import { useEffect, useState, useRef } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FolderOpen, Plus } from 'lucide-react';
import { useProjectStore, type Project } from '@/stores/projectStore';
import { projectsAPI } from '@/lib/api';

interface ProjectSelectorProps {
  onProjectSelected?: (project: Project) => void;
  showCreateButton?: boolean;
  onCreateClick?: () => void;
}

export function ProjectSelector({
  onProjectSelected,
  showCreateButton = false,
  onCreateClick,
}: ProjectSelectorProps) {
  const { selectedProject, projects, setSelectedProject, setProjects } = useProjectStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoaded = useRef(false);
  const refreshController = useRef<AbortController | null>(null);
  const requestId = useRef(0);

  // Load projects from API on component mount
  useEffect(() => {
    if (hasLoaded.current) return; // Prevent multiple calls
    
    const loadProjects = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const projectsData = await projectsAPI.getAll();
        setProjects(projectsData);
        
        // If no project is selected and we have projects, select the first one
        if (!selectedProject && projectsData.length > 0) {
          const firstProject = projectsData[0];
          setSelectedProject(firstProject);
          onProjectSelected?.(firstProject);
        }
      } catch (error) {
        console.error('Failed to load projects:', error);
        setError('Failed to load projects');
        setProjects([]);
      } finally {
        setIsLoading(false);
        hasLoaded.current = true;
      }
    };

    loadProjects();
  }, []); // Only run on mount

  const handleProjectChange = async (projectId: string) => {
    const project = projects.find((p) => p.id === parseInt(projectId));
    if (!project) return;

    // Cancel any pending refresh request from previous selection
    if (refreshController.current) {
      refreshController.current.abort();
    }

    // Create new AbortController for this request
    refreshController.current = new AbortController();
    const currentRequestId = ++requestId.current;

    // Set selected project immediately for UI responsiveness
    setSelectedProject(project);
    onProjectSelected?.(project);

    // Refresh project data to get latest counts
    try {
      const updatedProject = await projectsAPI.getById(project.id, refreshController.current.signal);
      
      // Ignore response if a newer selection has been made
      if (currentRequestId !== requestId.current) {
        return;
      }

      // Update the project in the store with fresh data
      setProjects(projects.map(p => p.id === project.id ? updatedProject : p));
      setSelectedProject(updatedProject);
      onProjectSelected?.(updatedProject);
    } catch (error) {
      // Ignore error if request was aborted due to new selection
      if (error.name !== 'AbortError') {
        console.error('Failed to refresh project data:', error);
        // Continue with the cached project data
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      <FolderOpen className="h-5 w-5 text-gray-600" />
      <Select
        value={selectedProject?.id.toString() || ''}
        onValueChange={handleProjectChange}
        disabled={isLoading || projects.length === 0}
      >
        <SelectTrigger className="w-64">
          <SelectValue placeholder={isLoading ? "Loading projects..." : "Select a project..."} />
        </SelectTrigger>
        <SelectContent>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id.toString()}>
              <div className="flex flex-col">
                <span>{project.name}</span>
                {project.test_cases_count !== undefined && (
                  <span className="text-xs text-gray-500">
                    {project.test_cases_count} test cases
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showCreateButton && (
        <Button
          variant="outline"
          size="sm"
          onClick={onCreateClick}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          New
        </Button>
      )}
      {error && (
        <div className="text-xs text-red-500 max-w-64 truncate">
          {error}
        </div>
      )}
    </div>
  );
}
