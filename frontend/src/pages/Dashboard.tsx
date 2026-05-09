import { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, TestTube, PlayCircle, TrendingUp, Users, Bug, FileCheck, Target, ExternalLink, AlertTriangle, Flag, Calendar, Loader2 } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { auditAPI, analyticsAPI } from '@/lib/api';
import { useProjectStore } from '@/stores/projectStore';

// StatCard component moved outside to avoid React 19 issues
interface StatCardProps {
  title: string;
  value: string | number;
  icon: any;
  color: string;
  trend?: string;
  href?: string;
  onClick?: () => void;
}

const StatCard = ({ title, value, icon: Icon, color, trend, onClick }: StatCardProps) => (
  <Card 
    className="hover:shadow-lg transition-shadow duration-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
    onClick={onClick}
  >
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
      <Icon className={`h-4 w-4 ${color}`} />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {trend && (
        <p className="text-xs text-gray-500 mt-1">{trend}</p>
      )}
    </CardContent>
  </Card>
);

export function Dashboard() {
  const { t, isRTL } = useTranslation();
  const navigate = useNavigate();
  const { selectedProject } = useProjectStore();
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Load recent activities from real audit API
    const loadRecentActivities = async () => {
      try {
        const response = await auditAPI.getAuditTrails({ limit: 10 });
        setRecentActivities(response.items);
      } catch (error) {
        console.error('Failed to load recent activities:', error);
        // Fallback to empty array if API fails
        setRecentActivities([]);
      }
    };

    // Load dashboard statistics from real API
    const loadDashboardStats = async () => {
      setIsLoading(true);
      try {
        // Pass selectedProject.id if available, otherwise get global stats
        const projectId = selectedProject?.id;
        const stats = await analyticsAPI.getDashboardStatistics(projectId);
        setDashboardStats(stats);
      } catch (error) {
        console.error('❌ Failed to load dashboard statistics:', error);
        // Set empty stats on error
        setDashboardStats({
          totalTestCases: 0,
          totalTestSuites: 0,
          totalTestRuns: 0,
          totalRequirements: 0,
          totalDefects: 0,
          totalMilestones: 0,
          totalTestPlans: 0,
          totalProjects: 0,
          testResults: [
            { status: 'passed', count: 0 },
            { status: 'failed', count: 0 },
            { status: 'blocked', count: 0 },
            { status: 'not_tested', count: 0 }
          ],
          passRate: 0
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadRecentActivities();
    loadDashboardStats();
  }, [selectedProject]); // React to project changes

  const handleActivityClick = (activity: any) => {
    // Only navigate if the activity belongs to the selected project or if no project is selected
    // This prevents users from being navigated to projects they don't have access to
    const targetProjectId = activity.project_id;
    const shouldNavigate = !selectedProject || selectedProject.id === targetProjectId;
    
    if (!shouldNavigate) {
      // If activity belongs to a different project, show message or do nothing
      // This prevents confusing context switching
      return;
    }
    
    // Use the activity's project_id if available, otherwise use selected project
    const projectId = targetProjectId || selectedProject?.id;
    
    if (!projectId) {
      // If no project context, don't navigate
      return;
    }
    
    // Handle real audit trail data
    switch (activity.entity_type) {
      case 'test_case':
        if (activity.entity_id) {
          navigate(`/projects/${projectId}/test-cases/${activity.entity_id}`);
        } else {
          navigate(`/projects/${projectId}/test-cases`);
        }
        break;
      case 'test_run':
        if (activity.entity_id) {
          navigate(`/projects/${projectId}/test-runs/${activity.entity_id}`);
        } else {
          navigate(`/projects/${projectId}/test-runs`);
        }
        break;
      case 'test_suite':
        if (activity.entity_id) {
          navigate(`/projects/${projectId}/test-suites/${activity.entity_id}`);
        } else {
          navigate(`/projects/${projectId}/test-suites`);
        }
        break;
      case 'user':
        navigate('/settings');
        break;
      case 'project':
        if (activity.entity_id) {
          navigate(`/projects/${activity.entity_id}`);
        } else {
          navigate('/projects');
        }
        break;
      default:
        // For other entity types, navigate to activity management
        navigate('/activity-management');
        break;
    }
  };
  const stats = useMemo(() => {
    if (!dashboardStats) {
      // Return empty stats while loading
      return {
        totalTests: 0,
        totalTestSuites: 0,
        totalTestRuns: 0,
        passRate: 0,
        totalRequirements: 0,
        totalDefects: 0,
        totalMilestones: 0,
        totalTestPlans: 0,
        totalProjects: 0,
        recentActivity: recentActivities
      };
    }

    const totalTests = dashboardStats.totalTestCases || 0;
    const totalTestSuites = dashboardStats.totalTestSuites || 0;
    const totalTestRuns = dashboardStats.totalTestRuns || 0;
    const passRate = dashboardStats.passRate || 0;

    return {
      totalTests,
      totalTestSuites,
      totalTestRuns,
      passRate,
      totalRequirements: dashboardStats.totalRequirements || 0,
      totalDefects: dashboardStats.totalDefects || 0,
      totalMilestones: dashboardStats.totalMilestones || 0,
      totalTestPlans: dashboardStats.totalTestPlans || 0,
      totalProjects: dashboardStats.totalProjects || 0,
      recentActivity: recentActivities
    };
  }, [dashboardStats, recentActivities]);

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t('dashboard')}</h1>
            <p className="text-gray-600 dark:text-gray-400">
              {selectedProject 
                ? t('viewingDataFor', { name: selectedProject.name }) 
                : t('welcomeToTestManagement')}
            </p>
          </div>
          {selectedProject && (
            <Badge variant="outline" className="text-sm px-3 py-1">
              <Target className={`h-3.5 w-3.5 ${isRTL ? 'ml-1.5' : 'mr-1.5'}`} />
              {selectedProject.name}
            </Badge>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className={`h-8 w-8 animate-spin text-blue-600 ${isRTL ? 'ml-2' : 'mr-2'}`} />
          <span className="text-gray-600">{t('loadingDashboardStats')}</span>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('testCasesTitle')}
          value={stats.totalTests}
          icon={FileText}
          color="text-blue-600"
          trend={t('active')}
          onClick={() => navigate(selectedProject ? `/projects/${selectedProject.id}/test-cases` : '/projects')}
        />
        <StatCard
          title={t('testSuites')}
          value={stats.totalTestSuites}
          icon={TestTube}
          color="text-green-600"
          trend={t('organizedTestSuites')}
          onClick={() => navigate(selectedProject ? `/projects/${selectedProject.id}/test-suites` : '/projects')}
        />
        <StatCard
          title={t('testRuns')}
          value={stats.totalTestRuns}
          icon={PlayCircle}
          color="text-yellow-600"
          trend={t('completedExecutions')}
          onClick={() => navigate(selectedProject ? `/projects/${selectedProject.id}/test-runs` : '/projects')}
        />
        <StatCard
          title={t('passRate')}
          value={`${stats.passRate}%`}
          icon={TrendingUp}
          color="text-purple-600"
          trend={t('overallSuccessRate')}
          onClick={() => navigate(selectedProject ? `/projects/${selectedProject.id}/test-runs` : '/projects')}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('requirements')}
          value={stats.totalRequirements}
          icon={FileCheck}
          color="text-indigo-600"
          trend={t('trackedRequirements')}
          onClick={() => navigate(selectedProject ? `/projects/${selectedProject.id}/requirements` : '/projects')}
        />
        <StatCard
          title={t('defects')}
          value={stats.totalDefects}
          icon={AlertTriangle}
          color="text-red-600"
          trend={t('openDefects')}
          onClick={() => navigate(selectedProject ? `/projects/${selectedProject.id}/defects` : '/projects')}
        />
        <StatCard
          title={t('milestones')}
          value={stats.totalMilestones}
          icon={Flag}
          color="text-orange-600"
          trend={t('activeMilestones')}
          onClick={() => navigate(selectedProject ? `/projects/${selectedProject.id}/milestones` : '/projects')}
        />
        <StatCard
          title={t('testPlans')}
          value={stats.totalTestPlans}
          icon={Calendar}
          color="text-teal-600"
          trend={t('plannedExecutions')}
          onClick={() => navigate(selectedProject ? `/projects/${selectedProject.id}/test-plans` : '/projects')}
        />
      </div>

      {/* Recent Activity */}
      <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
        <CardHeader className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">{t('recentActivity')}</CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/activity-management')}
              className="h-8 px-3 text-xs font-medium hover:bg-white dark:hover:bg-gray-800 transition-colors"
            >
              <ExternalLink className={`h-3.5 w-3.5 ${isRTL ? 'ml-1.5' : 'mr-1.5'}`} />
              {t('viewAllActivities')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {recentActivities.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                <Calendar className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">{t('noRecentActivity')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('activityWillAppear')}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {stats.recentActivity.map((activity, index) => (
                <div 
                  key={activity.id || index} 
                  className="flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-all duration-150 group"
                  onClick={() => handleActivityClick(activity)}
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-gray-100 dark:bg-gray-800 group-hover:scale-105 transition-transform">
                    {activity.entity_type === 'test_case' && <FileText className="h-[18px] w-[18px] text-blue-600 dark:text-blue-400" />}
                    {activity.entity_type === 'test_run' && <PlayCircle className="h-[18px] w-[18px] text-yellow-600 dark:text-yellow-400" />}
                    {activity.entity_type === 'test_suite' && <Target className="h-[18px] w-[18px] text-orange-600 dark:text-orange-400" />}
                    {activity.entity_type === 'user' && <Users className="h-[18px] w-[18px] text-purple-600 dark:text-purple-400" />}
                    {activity.entity_type === 'project' && <FileCheck className="h-[18px] w-[18px] text-indigo-600 dark:text-indigo-400" />}
                    {activity.entity_type === 'defect' && <Bug className="h-[18px] w-[18px] text-red-600 dark:text-red-400" />}
                    {!activity.entity_type && <Calendar className="h-[18px] w-[18px] text-gray-600 dark:text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white font-medium leading-snug">
                      <span className="capitalize">{activity.action?.replace('_', ' ') || t('unknown')}</span>
                      {activity.entity_type && <span className="text-gray-600 dark:text-gray-400 font-normal"> {activity.entity_type.replace('_', ' ')}</span>}
                      {activity.description && <span className="text-gray-600 dark:text-gray-400 font-normal">: {activity.description}</span>}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {activity.created_at ? new Date(activity.created_at).toLocaleString() : t('unknownTime')}
                    </p>
                  </div>
                  <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105"
          onClick={() => navigate(selectedProject ? `/projects/${selectedProject.id}/test-cases` : '/projects')}
        >
          <CardContent className="p-6 text-center">
            <FileText className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <h3 className="font-semibold">{t('createTestCase')}</h3>
            <p className="text-sm text-gray-600">{t('addNewTestCase')}</p>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105"
          onClick={() => navigate(selectedProject ? `/projects/${selectedProject.id}/test-runs` : '/projects')}
        >
          <CardContent className="p-6 text-center">
            <PlayCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <h3 className="font-semibold">{t('startTestRun')}</h3>
            <p className="text-sm text-gray-600">{t('executeTests')}</p>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105"
          onClick={() => navigate(selectedProject ? `/projects/${selectedProject.id}/defects` : '/projects')}
        >
          <CardContent className="p-6 text-center">
            <Bug className="h-8 w-8 text-red-600 mx-auto mb-2" />
            <h3 className="font-semibold">{t('reportDefect')}</h3>
            <p className="text-sm text-gray-600">{t('logNewIssue')}</p>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105"
          onClick={() => navigate(selectedProject ? `/projects/${selectedProject.id}/reports` : '/projects')}
        >
          <CardContent className="p-6 text-center">
            <FileCheck className="h-8 w-8 text-purple-600 mx-auto mb-2" />
            <h3 className="font-semibold">{t('viewReports')}</h3>
            <p className="text-sm text-gray-600">{t('checkAnalytics')}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
