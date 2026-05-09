import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FolderTree, Folder, FolderOpen, FileText, Plus, Edit, Trash2, 
  ChevronRight, ChevronDown, Eye, ArrowLeft,
  BarChart3, CheckCircle, XCircle, AlertCircle, GripVertical
} from 'lucide-react';
import { projectsAPI, testSuitesAPI, sectionsAPI } from '@/lib/api';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface SectionNode {
  id: number;
  name: string;
  description?: string;
  test_case_count: number;
  subsections: SectionNode[];
  test_suite_id?: number;
  parent_section_id?: number;
}

interface SectionDetails {
  section: {
    id: number;
    name: string;
    description?: string;
    created_at: string;
    updated_at: string;
  };
  project: {
    id: number;
    name: string;
    description?: string;
  };
  test_suite: {
    id: number;
    name: string;
    description?: string;
  };
  parent_section?: {
    id: number;
    name: string;
  };
  subsections: Array<{
    id: number;
    name: string;
    description?: string;
    test_case_count: number;
  }>;
  test_cases: Array<{
    id: number;
    title: string;
    description?: string;
    priority: string;
    status: string;
    created_at: string;
    updated_at: string;
    latest_result?: any;
  }>;
  statistics: {
    total_test_cases: number;
    executed_test_cases: number;
    passed_test_cases: number;
    failed_test_cases: number;
    pass_rate: number;
    subsections_count: number;
  };
}

// Draggable Section Component
const DraggableSection = ({ 
  section, 
  level, 
  onToggle, 
  onSelect, 
  onEdit, 
  isExpanded, 
  isSelected,
  isDragging 
}: {
  section: SectionNode;
  level: number;
  onToggle: (id: number) => void;
  onSelect: (id: number) => void;
  onEdit: (section: SectionNode) => void;
  isExpanded: boolean;
  isSelected: boolean;
  isDragging: boolean;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: isDraggableDragging,
  } = useDraggable({ 
    id: section.id,
    data: {
      type: 'section',
      section: section
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const hasSubsections = section.subsections && section.subsections.length > 0;

  return (
    <div ref={setNodeRef} style={style} className="select-none">
      <div
        className={`flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors ${
          isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500' : ''
        } ${isDraggableDragging ? 'opacity-50' : ''}`}
        style={{ paddingLeft: `${level * 24 + 8}px` }}
        onClick={() => onSelect(section.id)}
      >
        <div
          className="cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-gray-400 hover:text-gray-600 mr-2" />
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(section.id);
          }}
        >
          {hasSubsections ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : (
            <div className="h-4 w-4" />
          )}
        </Button>
        
        {hasSubsections ? (
          isExpanded ? (
            <FolderOpen className="h-4 w-4 text-blue-600" />
          ) : (
            <Folder className="h-4 w-4 text-blue-600" />
          )
        ) : (
          <Folder className="h-4 w-4 text-gray-400" />
        )}
        
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{section.name}</span>
            <Badge variant="secondary" className="text-xs">
              {section.test_case_count} TCs
            </Badge>
          </div>
          {section.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
              {section.description}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(section);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// Root Droppable Area Component
const RootDroppableArea = ({ isDragging, children }: { isDragging: boolean; children: React.ReactNode }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: 'root-drop-zone',
    data: {
      type: 'root',
      message: 'Move to root level'
    }
  });

  return (
    <div 
      ref={setNodeRef}
      className={`relative transition-all ${
        isOver && isDragging 
          ? 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-400 ring-offset-1 rounded-lg p-4 mb-4' 
          : ''
      }`}
    >
      {isOver && isDragging && (
        <div className="text-center text-blue-600 dark:text-blue-400 font-medium py-2">
          <Folder className="h-5 w-5 inline mr-2" />
          Drop here to move to root level
        </div>
      )}
      {children}
    </div>
  );
};

// Droppable Section Component
const DroppableSection = ({ 
  section, 
  level, 
  onToggle, 
  onSelect, 
  onEdit, 
  isExpanded, 
  isSelected,
  isDragging,
  children 
}: {
  section: SectionNode;
  level: number;
  onToggle: (id: number) => void;
  onSelect: (id: number) => void;
  onEdit: (section: SectionNode) => void;
  isExpanded: boolean;
  isSelected: boolean;
  isDragging: boolean;
  children: React.ReactNode;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `section-${section.id}`,
    data: {
      type: 'section',
      sectionId: section.id,
      sectionName: section.name
    }
  });

  const hasSubsections = section.subsections && section.subsections.length > 0;

  return (
    <div 
      ref={setNodeRef}
      className={`relative transition-all ${
        isOver && isDragging 
          ? 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-400 ring-offset-1 rounded shadow-lg scale-[1.02]' 
          : isDragging 
            ? 'hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded' 
            : ''
      }`}
    >
      <DraggableSection
        section={section}
        level={level}
        onToggle={onToggle}
        onSelect={onSelect}
        onEdit={onEdit}
        isExpanded={isExpanded}
        isSelected={isSelected}
        isDragging={isDragging}
      />
      
      {hasSubsections && isExpanded && (
        <div className="relative">
          {isOver && isDragging && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 rounded-full animate-pulse" />
          )}
          <div className="ml-6 border-l-2 border-gray-200 dark:border-gray-700">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

export function SectionManagement() {
  const { projectId, sectionId } = useParams();
  const navigate = useNavigate();
  
  const [viewMode, setViewMode] = useState<'tree' | 'details'>('tree');
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  
  // Data states
  const [project, setProject] = useState<any>(null);
  const [testSuites, setTestSuites] = useState<any[]>([]);
  const [sectionHierarchy, setSectionHierarchy] = useState<any>(null);
  const [sectionDetails, setSectionDetails] = useState<SectionDetails | null>(null);
  const [selectedTestSuite, setSelectedTestSuite] = useState<number | null>(null);
  
  // Drag and drop state
  const [activeDragId, setActiveDragId] = useState<number | null>(null);
  const [draggedSection, setDraggedSection] = useState<any>(null);
  
  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor),
    useSensor(TouchSensor)
  );
  
  // Form states
  const [isCreatingSection, setIsCreatingSection] = useState(false);
  const [isEditingSection, setIsEditingSection] = useState(false);
  const [sectionForm, setSectionForm] = useState({
    name: '',
    description: '',
    test_suite_id: 0,
    parent_section_id: 0
  });

  // Load initial data
  useEffect(() => {
    if (projectId) {
      loadProject();
      loadTestSuites();
      loadSectionHierarchy();
    }
  }, [projectId]);

  // Load section details when sectionId changes in URL
  useEffect(() => {
    if (sectionId) {
      loadSectionDetails(parseInt(sectionId));
    } else {
      setViewMode('tree');
      setSelectedSectionId(null);
      setSectionDetails(null);
    }
  }, [sectionId]);

  const loadProject = async () => {
    console.log('🔄 Loading project:', projectId);
    try {
      const data = await projectsAPI.getById(parseInt(projectId!));
      console.log('✅ Project loaded successfully:', data);
      setProject(data);
    } catch (error: any) {
      console.error('❌ Failed to load project:', error);
      console.error('Error details:', {
        message: (error as any).message,
        stack: (error as any).stack,
        response: (error as any).response?.data,
        status: (error as any).response?.status
      });
      
      // Set empty state on API failure - no mock data
      console.log('🔄 API call failed, setting empty project data...');
      setProject({
        id: parseInt(projectId!),
        name: 'Project Not Found',
        description: 'Unable to load project details',
        status: 'unknown',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  };

  const loadTestSuites = async () => {
    try {
      const data = await testSuitesAPI.getAll(parseInt(projectId!));
      setTestSuites(data);
    } catch (error) {
      console.error('Failed to load test suites:', error);
      // Set empty state on API failure - no mock data
      console.log('🔄 API call failed, setting empty test suites...');
      setTestSuites([]);
    }
  };

  const loadSectionHierarchy = async () => {
    if (!projectId) return;
    setIsLoading(true);
    
    console.log('🔄 Loading section hierarchy for project:', projectId);
    console.log('📦 sectionsAPI object:', sectionsAPI);
    console.log('📦 sectionsAPI methods:', Object.getOwnPropertyNames(sectionsAPI));
    
    try {
      console.log('📞 Calling sectionsAPI.getProjectSectionHierarchy...');
      const data = await sectionsAPI.getProjectSectionHierarchy(parseInt(projectId));
      console.log('✅ Section hierarchy loaded successfully:', data);
      setSectionHierarchy(data);
      
      // Don't fall back to mock data - use real API response even if empty
      if (!data.hierarchy || data.hierarchy.length === 0) {
        console.log('📝 No sections found in real data - showing empty state');
      }
    } catch (error: any) {
      console.error('❌ Failed to load section hierarchy:', error);
      console.error('Error details:', {
        message: (error as any).message,
        stack: (error as any).stack,
        response: (error as any).response?.data,
        status: (error as any).response?.status
      });
      
      // Set empty state on API failure - no mock data
      setSectionHierarchy({
        project_id: parseInt(projectId),
        hierarchy: []
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadSectionDetails = async (sectionId: number) => {
    setIsLoading(true);
    console.log('🔄 Loading section details for section:', sectionId);
    console.log('📦 sectionsAPI object:', sectionsAPI);
    console.log('📦 sectionsAPI methods:', Object.getOwnPropertyNames(sectionsAPI));
    
    try {
      console.log('📞 Calling sectionsAPI.getSectionDetails...');
      const data = await sectionsAPI.getSectionDetails(sectionId);
      console.log('✅ Section details loaded successfully:', data);
      setSectionDetails(data);
      setSelectedSectionId(sectionId);
      setViewMode('details');
    } catch (error: any) {
      console.error('❌ Failed to load section details:', error);
      console.error('Error details:', {
        message: (error as any).message,
        stack: (error as any).stack,
        response: (error as any).response?.data,
        status: (error as any).response?.status
      });
      
      // Set empty state on API failure - no mock data
      console.log('🔄 API call failed, setting empty section details...');
      setSectionDetails({
        section: {
          id: sectionId,
          name: 'Section Not Found',
          description: 'Unable to load section details',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        project: {
          id: parseInt(projectId!),
          name: 'Unknown Project',
          description: 'Unable to load project details'
        },
        test_suite: {
          id: 0,
          name: 'Unknown Test Suite',
          description: 'Unable to load test suite details'
        },
        parent_section: undefined,
        subsections: [],
        test_cases: [],
        statistics: {
          total_test_cases: 0,
          executed_test_cases: 0,
          passed_test_cases: 0,
          failed_test_cases: 0,
          pass_rate: 0,
          subsections_count: 0
        }
      });
      setSelectedSectionId(sectionId);
      setViewMode('details');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSectionExpansion = (sectionId: number) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const renderSectionTree = (sections: SectionNode[], level: number = 0) => {
    return sections.map((section) => (
      <DroppableSection
        key={section.id}
        section={section}
        level={level}
        onToggle={toggleSectionExpansion}
        onSelect={(id) => navigate(`/projects/${projectId}/sections/${id}`)}
        onEdit={startEditSection}
        isExpanded={expandedSections.has(section.id)}
        isSelected={selectedSectionId === section.id}
        isDragging={activeDragId !== null}
      >
        {section.subsections.length > 0 && expandedSections.has(section.id) && (
          <div>
            {renderSectionTree(section.subsections, level + 1)}
          </div>
        )}
      </DroppableSection>
    ));
  };

  const startEditSection = (section: any) => {
    setSectionForm({
      name: section.name,
      description: section.description || '',
      test_suite_id: section.test_suite_id || 0,
      parent_section_id: section.parent_section_id || 0
    });
    setIsEditingSection(true);
  };

  const startCreateSection = () => {
    setSectionForm({
      name: '',
      description: '',
      test_suite_id: selectedTestSuite || 0,
      parent_section_id: selectedSectionId || 0
    });
    setIsCreatingSection(true);
  };

  const handleSaveSection = async () => {
    try {
      if (isEditingSection && selectedSectionId) {
        await sectionsAPI.update(selectedSectionId, sectionForm);
      } else if (isCreatingSection) {
        await sectionsAPI.create(sectionForm);
      }
      
      // Reset form and reload data
      setIsCreatingSection(false);
      setIsEditingSection(false);
      setSectionForm({ name: '', description: '', test_suite_id: 0, parent_section_id: 0 });
      loadSectionHierarchy();
      
      if (selectedSectionId) {
        loadSectionDetails(selectedSectionId);
      }
    } catch (error) {
      console.error('Failed to save section:', error);
    }
  };

  const handleDeleteSection = async (sectionId: number) => {
    if (confirm('Are you sure you want to delete this section?')) {
      try {
        await sectionsAPI.delete(sectionId);
        loadSectionHierarchy();
        if (selectedSectionId === sectionId) {
          setViewMode('tree');
          setSelectedSectionId(null);
          setSectionDetails(null);
        }
      } catch (error) {
        console.error('Failed to delete section:', error);
      }
    }
  };

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    const draggedId = event.active.id as number;
    setActiveDragId(draggedId);
    
    // Find the dragged section data
    const findSection = (sections: any[]): any => {
      for (const section of sections) {
        if (section.id === draggedId) {
          return section;
        }
        if (section.subsections && section.subsections.length > 0) {
          const found = findSection(section.subsections);
          if (found) return found;
        }
      }
      return null;
    };
    
    if (sectionHierarchy && sectionHierarchy.hierarchy) {
      for (const suite of sectionHierarchy.hierarchy) {
        const found = findSection(suite.sections);
        if (found) {
          setDraggedSection(found);
          break;
        }
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    setDraggedSection(null);

    if (!over || !active || !draggedSection) {
      return;
    }

    const draggedId = active.id as number;
    const dropTargetId = over.id as string;

    // Don't allow dropping on itself
    if (draggedId.toString() === dropTargetId) {
      return;
    }

    let targetSectionId: number | null = null;
    let moveToRoot = false;

    // Check if dropping on root zone
    if (dropTargetId === 'root-drop-zone') {
      moveToRoot = true;
    } 
    // Check if dropping on a section
    else if (dropTargetId.startsWith('section-')) {
      targetSectionId = parseInt(dropTargetId.replace('section-', ''));
    }

    // Don't allow moving a section to be its own descendant
    const isDescendant = (section: any, targetId: number): boolean => {
      if (section.id === targetId) return true;
      if (section.subsections) {
        return section.subsections.some((sub: any) => isDescendant(sub, targetId));
      }
      return false;
    };

    if (!moveToRoot && targetSectionId && isDescendant(draggedSection, targetSectionId)) {
      alert('Cannot move a section to be its own subsection');
      return;
    }

    try {
      // Update the section's parent
      await sectionsAPI.update(draggedId, {
        parent_section_id: moveToRoot ? null : targetSectionId
      });

      // Reload the hierarchy
      await loadSectionHierarchy();
      
      const action = moveToRoot ? 'moved to root level' : `moved to new parent`;
      console.log(`Section "${draggedSection.name}" ${action}`);
    } catch (error) {
      console.error('Failed to move section:', error);
      alert('Failed to move section. Please try again.');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'fail': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'block': return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  if (viewMode === 'details' && sectionDetails && sectionDetails.section) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/projects/${projectId}/sections`)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Sections
            </Button>
            <h1 className="text-2xl font-bold">Section Details</h1>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => startEditSection(sectionDetails.section)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Section
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDeleteSection(sectionDetails.section.id)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {/* Section Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5 text-blue-600" />
              {sectionDetails.section.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="text-sm font-medium text-gray-700">Description</Label>
                <p className="text-sm text-gray-600 mt-1">
                  {sectionDetails.section.description || 'No description provided'}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Created</Label>
                <p className="text-sm text-gray-600 mt-1">
                  {new Date(sectionDetails.section.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project and Test Suite Info */}
        {sectionDetails.project && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Project</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Name</Label>
                    <p className="text-sm text-gray-900">{sectionDetails.project.name}</p>
                  </div>
                  {sectionDetails.project.description && (
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Description</Label>
                      <p className="text-sm text-gray-600">{sectionDetails.project.description}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {sectionDetails.test_suite && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Test Suite</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Name</Label>
                      <p className="text-sm text-gray-900">{sectionDetails.test_suite.name}</p>
                    </div>
                    {sectionDetails.test_suite.description && (
                      <div>
                        <Label className="text-sm font-medium text-gray-700">Description</Label>
                        <p className="text-sm text-gray-600">{sectionDetails.test_suite.description}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Parent Section Info */}
        {sectionDetails.parent_section && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Parent Section</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Name</Label>
                  <p className="text-sm text-gray-900">{sectionDetails.parent_section.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (sectionDetails.parent_section) {
                        navigate(`/projects/${projectId}/sections/${sectionDetails.parent_section.id}`);
                      } else {
                        navigate(`/projects/${projectId}/sections`);
                      }
                    }}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Parent
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

      {/* Statistics */}
      {sectionDetails?.statistics && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{sectionDetails?.statistics?.total_test_cases || 0}</p>
                <p className="text-sm text-gray-600">Total Test Cases</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{(sectionDetails?.statistics?.pass_rate || 0).toFixed(1)}%</p>
                <p className="text-sm text-gray-600">Pass Rate</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">{sectionDetails?.statistics?.subsections_count || 0}</p>
                <p className="text-sm text-gray-600">Subsections</p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <p className="text-2xl font-bold text-orange-600">{sectionDetails?.statistics?.executed_test_cases || 0}</p>
                <p className="text-sm text-gray-600">Executed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subsections */}
      {sectionDetails?.subsections && sectionDetails.subsections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderTree className="h-5 w-5" />
              Subsections ({sectionDetails.subsections.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sectionDetails.subsections.map((subsection) => (
                <div
                  key={subsection.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/projects/${projectId}/sections/${subsection.id}`)}
                >
                  <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">{subsection.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {subsection.test_case_count} TCs
                    </Badge>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

        {/* Test Cases */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Test Cases ({sectionDetails.test_cases?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sectionDetails.test_cases && sectionDetails.test_cases.length > 0 ? (
                sectionDetails.test_cases.map((testCase) => (
                  <div
                    key={testCase.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{testCase.title}</span>
                        <Badge variant="outline" className="text-xs">
                          {testCase.priority}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {testCase.status}
                        </Badge>
                      </div>
                      {testCase.description && (
                        <p className="text-sm text-gray-600 mt-1 truncate">{testCase.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {testCase.latest_result && getStatusIcon(testCase.latest_result.status)}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/test-cases/${testCase.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No test cases in this section</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderTree className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold">Section Management</h1>
          {project && (
            <Badge variant="secondary" className="ml-2">
              {project.name}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Select value={selectedTestSuite?.toString() || ''} onValueChange={(value) => setSelectedTestSuite(parseInt(value))}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by Test Suite" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">All Test Suites</SelectItem>
              {testSuites.map((suite) => (
                <SelectItem key={suite.id} value={suite.id.toString()}>
                  {suite.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={startCreateSection}>
            <Plus className="h-4 w-4 mr-2" />
            New Section
          </Button>
        </div>
      </div>

      {/* Create/Edit Section Modal */}
      {(isCreatingSection || isEditingSection) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {isCreatingSection ? 'Create New Section' : 'Edit Section'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Section Name</Label>
                <Input
                  id="name"
                  value={sectionForm.name}
                  onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                  placeholder="Enter section name"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={sectionForm.description}
                  onChange={(e) => setSectionForm({ ...sectionForm, description: e.target.value })}
                  placeholder="Enter section description"
                />
              </div>
              <div>
                <Label htmlFor="test_suite">Test Suite</Label>
                <Select
                  value={sectionForm.test_suite_id.toString()}
                  onValueChange={(value) => setSectionForm({ ...sectionForm, test_suite_id: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {testSuites.map((suite) => (
                      <SelectItem key={suite.id} value={suite.id.toString()}>
                        {suite.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="parent_section">Parent Section (Optional)</Label>
                <Select
                  value={sectionForm.parent_section_id.toString()}
                  onValueChange={(value) => setSectionForm({ ...sectionForm, parent_section_id: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Root Level</SelectItem>
                    {/* Would need to load available parent sections here */}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={handleSaveSection}>
                  {isCreatingSection ? 'Create' : 'Save'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreatingSection(false);
                    setIsEditingSection(false);
                    setSectionForm({ name: '', description: '', test_suite_id: 0, parent_section_id: 0 });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section Tree View */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5" />
            Section Hierarchy
            <div className="ml-auto text-xs text-gray-500">
              <GripVertical className="h-3 w-3 inline mr-1" />
              Drag sections to reorganize
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading sections...</span>
            </div>
          ) : sectionHierarchy ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <RootDroppableArea isDragging={activeDragId !== null}>
                <div className="space-y-2">
                  {sectionHierarchy.hierarchy.map((suite: any) => (
                    <div key={suite.test_suite.id} className="mb-6">
                      <div className="flex items-center gap-2 mb-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <Folder className="h-5 w-5 text-blue-600" />
                        <span className="font-semibold">{suite.test_suite.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {suite.sections.reduce((sum: number, s: any) => sum + s.test_case_count, 0)} TCs
                        </Badge>
                      </div>
                      {renderSectionTree(suite.sections)}
                    </div>
                  ))}
                </div>
              </RootDroppableArea>
              
              <DragOverlay>
                {draggedSection ? (
                  <div className="flex items-center gap-2 p-3 bg-white dark:bg-gray-800 border-2 border-blue-500 rounded-lg shadow-lg opacity-90">
                    <GripVertical className="h-4 w-4 text-blue-500" />
                    <Folder className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">{draggedSection.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {draggedSection.test_case_count} TCs
                    </Badge>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No sections found. Create your first section to get started.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
