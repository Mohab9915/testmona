import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '@/stores/projectStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FolderOpen, ArrowRight } from 'lucide-react';

interface ProjectGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ProjectGuard({ children, fallback }: ProjectGuardProps) {
  const navigate = useNavigate();
  const { projects } = useProjectStore();

  // Check if there are any projects in the database
  const hasProjects = projects && projects.length > 0;
  const isProjectsLoaded = projects !== undefined;

  useEffect(() => {
    // Only redirect if projects are loaded and none exist
    if (isProjectsLoaded && !hasProjects) {
      navigate('/projects');
    }
  }, [hasProjects, isProjectsLoaded, navigate]);

  if (!hasProjects) {
    return fallback || (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <FolderOpen className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                No Projects Found
              </h2>
              <p className="text-gray-600 mb-6 leading-relaxed">
                TestMona is project-first. You need to create a project before accessing this feature.
              </p>
              <Button 
                onClick={() => navigate('/projects')}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                Go to Projects
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
