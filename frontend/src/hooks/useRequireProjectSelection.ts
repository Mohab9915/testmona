import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useProjectStore } from '@/stores/projectStore';

/**
 * Hook to require project selection for project-scoped pages
 * Redirects to /projects if no project is selected
 */
export function useRequireProjectSelection() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { selectedProject, setSelectedProject, projects } = useProjectStore();

  useEffect(() => {
    // If we have projectId in URL, use that
    if (projectId) {
      const projectIdNum = parseInt(projectId);
      
      // Check if this project is in our store
      if (!selectedProject || selectedProject.id !== projectIdNum) {
        const project = projects.find(p => p.id === projectIdNum);
        if (project) {
          setSelectedProject(project);
        }
      }
    } else if (!selectedProject) {
      // No project selected and no projectId in URL - redirect to projects
      navigate('/projects');
    }
  }, [projectId, selectedProject, projects, setSelectedProject, navigate]);

  return selectedProject;
}
