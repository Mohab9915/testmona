import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Search, 
  Filter, 
  Eye, 
  Calendar, 
  User, 
  CheckCircle, 
  AlertTriangle,
  Download,
  RefreshCw,
  History,
  Settings,
  FileText,
  GitBranch,
  Users,
  Package,
  Play,
  Plus,
  Trash2,
  LogIn,
  LogOut,
  UserCheck,
  UserMinus,
  Check,
  X,
  Archive,
  ArchiveRestore,
  FileDown,
  FileUp,
  RotateCw
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { auditAPI, usersAPI } from '@/lib/api';
import { AuditTrail, AuditTrailFilters, AuditAction, EntityType } from '@/types';

const ACTION_LABELS: Record<AuditAction, string> = {
  create: 'actionCreated',
  update: 'actionUpdated',
  delete: 'actionDeleted',
  login: 'actionLoggedIn',
  logout: 'actionLoggedOut',
  execute: 'actionExecuted',
  assign: 'actionAssigned',
  unassign: 'actionUnassigned',
  approve: 'actionApproved',
  reject: 'actionRejected',
  archive: 'actionArchived',
  restore: 'actionRestored',
  export: 'actionExported',
  import: 'actionImported',
  sync: 'actionSynced'
};

const ENTITY_LABELS: Record<EntityType, string> = {
  user: 'entityUser',
  project: 'entityProject',
  test_case: 'entityTestCase',
  test_suite: 'entityTestSuite',
  test_run: 'entityTestRun',
  test_result: 'entityTestResult',
  test_plan: 'entityTestPlan',
  requirement: 'entityRequirement',
  defect: 'entityDefect',
  milestone: 'entityMilestone',
  custom_field: 'entityCustomField',
  jira_integration: 'entityJiraIntegration',
  notification: 'entityNotification'
};

const ACTION_ICONS: Record<AuditAction, React.ReactNode> = {
  create: <Plus className="h-3 w-3" />,
  update: <RefreshCw className="h-3 w-3" />,
  delete: <Trash2 className="h-3 w-3" />,
  login: <LogIn className="h-3 w-3" />,
  logout: <LogOut className="h-3 w-3" />,
  execute: <Play className="h-3 w-3" />,
  assign: <UserCheck className="h-3 w-3" />,
  unassign: <UserMinus className="h-3 w-3" />,
  approve: <Check className="h-3 w-3" />,
  reject: <X className="h-3 w-3" />,
  archive: <Archive className="h-3 w-3" />,
  restore: <ArchiveRestore className="h-3 w-3" />,
  export: <FileDown className="h-3 w-3" />,
  import: <FileUp className="h-3 w-3" />,
  sync: <RotateCw className="h-3 w-3" />
};

const ENTITY_ICONS: Record<EntityType, React.ReactNode> = {
  user: <Users className="h-4 w-4" />,
  project: <Package className="h-4 w-4" />,
  test_case: <FileText className="h-4 w-4" />,
  test_suite: <GitBranch className="h-4 w-4" />,
  test_run: <Settings className="h-4 w-4" />,
  test_result: <CheckCircle className="h-4 w-4" />,
  test_plan: <Calendar className="h-4 w-4" />,
  requirement: <FileText className="h-4 w-4" />,
  defect: <AlertTriangle className="h-4 w-4" />,
  milestone: <CheckCircle className="h-4 w-4" />,
  custom_field: <Settings className="h-4 w-4" />,
  jira_integration: <GitBranch className="h-4 w-4" />,
  notification: <AlertTriangle className="h-4 w-4" />
};

export function ActivityManagement() {
  const { t, isRTL } = useTranslation();
  const [auditTrails, setAuditTrails] = useState<AuditTrail[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState<AuditAction | 'all'>('all');
  const [selectedEntityType, setSelectedEntityType] = useState<EntityType | 'all'>('all');
  const [dateRange, setDateRange] = useState('all');
  const [selectedAuditTrail, setSelectedAuditTrail] = useState<AuditTrail | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [userMap, setUserMap] = useState<Record<number, string>>({});

  const getActionLabel = (action: AuditAction) => {
    const key = ACTION_LABELS[action];
    return t(key as any);
  };

  const getEntityLabel = (entityType: EntityType) => {
    const key = ENTITY_LABELS[entityType];
    return t(key as any);
  };

  const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const filters = useMemo((): AuditTrailFilters => ({
    limit,
    offset,
    search: searchQuery || undefined,
    action: selectedAction !== 'all' ? selectedAction : undefined,
    entity_type: selectedEntityType !== 'all' ? selectedEntityType : undefined,
    date_from: dateRange === 'today' ? getLocalDateString(new Date()) :
              dateRange === 'week' ? getLocalDateString(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) :
              dateRange === 'month' ? getLocalDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) :
              undefined
  }), [limit, offset, searchQuery, selectedAction, selectedEntityType, dateRange]);

  useEffect(() => {
    loadAuditTrails();
  }, [filters]);

  const loadAuditTrails = async () => {
    setLoading(true);
    try {
      const response = await auditAPI.getAuditTrails(filters);
      setAuditTrails(response.items);
      setTotal(response.total);
      
      // Fetch usernames for unique user IDs
      const uniqueUserIds = [...new Set(response.items.map(item => item.user_id))];
      if (uniqueUserIds.length > 0) {
        const users = await Promise.all(
          uniqueUserIds.map((userId: number) => usersAPI.getById(userId).catch(() => null))
        );
        const newUserMap: Record<number, string> = {};
        let failedLookups = 0;
        users.forEach(user => {
          if (user) {
            newUserMap[user.id] = user.username;
          } else {
            failedLookups++;
          }
        });
        setUserMap(newUserMap);
        if (failedLookups > 0) {
          console.warn(`Failed to fetch ${failedLookups} user(s) for audit trails`);
        }
      }
    } catch (error) {
      console.error('Failed to load audit trails:', error);
      setAuditTrails([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (auditTrail: AuditTrail) => {
    setSelectedAuditTrail(auditTrail);
    setDetailDialogOpen(true);
  };

  const exportAuditTrails = async () => {
    try {
      // Fetch all audit trails with current filters for export
      const exportFilters = { ...filters, limit: 10000, offset: 0 };
      const response = await auditAPI.getAuditTrails(exportFilters);
      const allAuditTrails = response.items;
      
      if (!allAuditTrails || allAuditTrails.length === 0) {
        alert(t('noAuditTrailsToExport'));
        return;
      }
      
      const csvContent = [
        t('csvHeader'),
        ...allAuditTrails.map(audit => 
          `"${audit.id}","${audit.user_id}","${audit.action}","${audit.entity_type}","${audit.entity_id || ''}","${audit.project_id || ''}","${(audit.description || '').replace(/"/g, '""')}","${audit.ip_address || ''}","${(audit.user_agent || '').replace(/"/g, '""')}","${audit.created_at}"`
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-trails-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export audit trails:', error);
      alert(t('failedToExportAuditTrails'));
    }
  };

  const getActionBadge = (action: AuditAction) => {
    const variants: Record<AuditAction, string> = {
      create: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      update: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      delete: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      login: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      logout: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
      execute: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      assign: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
      unassign: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      approve: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      reject: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      archive: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
      restore: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
      export: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
      import: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
      sync: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400'
    };
    return variants[action] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  };

  const getEntityBadge = (entityType: EntityType) => {
    const variants: Record<EntityType, string> = {
      user: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      project: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      test_case: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      test_suite: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      test_run: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      test_result: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      test_plan: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
      requirement: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
      defect: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      milestone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
      custom_field: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
      jira_integration: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
      notification: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400'
    };
    return variants[entityType] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('activityManagement')}</h1>
          <p className="text-gray-600 dark:text-gray-400">{t('activityManagementDescription')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadAuditTrails}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('refresh')}
          </Button>
          <Button variant="outline" onClick={exportAuditTrails}>
            <Download className="h-4 w-4 mr-2" />
            {t('export')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t('auditFilters')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>{t('search')}</Label>
              <Input
                placeholder={t('searchActivities')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('action')}</Label>
              <Select value={selectedAction} onValueChange={(value: any) => setSelectedAction(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allActions')}</SelectItem>
                  {Object.entries(ACTION_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{t(label as any)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('entityType')}</Label>
              <Select value={selectedEntityType} onValueChange={(value: any) => setSelectedEntityType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allEntityTypes')}</SelectItem>
                  {Object.entries(ENTITY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{t(label as any)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('allTime')}</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allTime')}</SelectItem>
                  <SelectItem value="today">{t('today')}</SelectItem>
                  <SelectItem value="week">{t('last7Days')}</SelectItem>
                  <SelectItem value="month">{t('last30Days')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activities Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{t('auditTrails')} ({auditTrails.length} of {total})</span>
            <Button variant="outline" size="sm" onClick={loadAuditTrails}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('refresh')}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">{t('loadingAuditTrails')}</span>
            </div>
          ) : auditTrails.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>{t('noAuditTrailsFound')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('auditAction')}</TableHead>
                  <TableHead>{t('entityType')}</TableHead>
                  <TableHead>{t('entityId')}</TableHead>
                  <TableHead>{t('auditDescription')}</TableHead>
                  <TableHead>{t('userId')}</TableHead>
                  <TableHead>{t('ipAddress')}</TableHead>
                  <TableHead>{t('timestamp')}</TableHead>
                  <TableHead>{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditTrails.map((auditTrail) => (
                  <TableRow key={auditTrail.id}>
                    <TableCell>
                      <Badge className={`${getActionBadge(auditTrail.action)} inline-flex items-center gap-1.5 px-2.5 py-1 whitespace-nowrap`}>
                        {ACTION_ICONS[auditTrail.action]}
                        <span>{getActionLabel(auditTrail.action)}</span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getEntityBadge(auditTrail.entity_type)} inline-flex items-center gap-1.5 px-2.5 py-1 whitespace-nowrap`}>
                        {ENTITY_ICONS[auditTrail.entity_type]}
                        <span>{getEntityLabel(auditTrail.entity_type)}</span>
                      </Badge>
                    </TableCell>
                    <TableCell>{auditTrail.entity_id || '-'}</TableCell>
                    <TableCell className="max-w-xs truncate">{auditTrail.description || '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {userMap[auditTrail.user_id] ?? `${t('auditUser')} ${auditTrail.user_id}`}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-5">
                          {t('idPrefix')}: {auditTrail.user_id}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{auditTrail.ip_address || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">
                          {new Date(auditTrail.created_at).toLocaleString()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(auditTrail)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t('showingEntries', { start: total > 0 ? offset + 1 : 0, end: total > 0 ? Math.min(offset + limit, total) : 0, total })}
                </span>
                <Select value={limit.toString()} onValueChange={(value) => {
                  setLimit(parseInt(value));
                  setOffset(0);
                }}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-gray-600 dark:text-gray-400">{t('perPage')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0 || total === 0}
                >
                  {t('previousItem')}
                </Button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t('auditPageOf', { current: total > 0 ? Math.floor(offset / limit) + 1 : 0, total: total > 0 ? Math.ceil(total / limit) : 0 })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newOffset = offset + limit;
                    const maxOffset = total > 0 ? Math.floor((total - 1) / limit) * limit : 0;
                    setOffset(Math.min(newOffset, maxOffset));
                  }}
                  disabled={offset + limit >= total || total === 0}
                >
                  {t('nextItem')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Trail Details Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent isRTL={isRTL} className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              {t('auditTrailDetails')}
            </DialogTitle>
          </DialogHeader>
          {selectedAuditTrail && (
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('auditAction')}</Label>
                  <Badge className={`${getActionBadge(selectedAuditTrail.action)} inline-flex items-center gap-1.5 px-2.5 py-1 whitespace-nowrap`}>
                    {ACTION_ICONS[selectedAuditTrail.action]}
                    <span>{getActionLabel(selectedAuditTrail.action)}</span>
                  </Badge>
                </div>
                <div>
                  <Label>{t('entityType')}</Label>
                  <Badge className={`${getEntityBadge(selectedAuditTrail.entity_type)} inline-flex items-center gap-1.5 px-2.5 py-1 whitespace-nowrap`}>
                    {ENTITY_ICONS[selectedAuditTrail.entity_type]}
                    <span>{getEntityLabel(selectedAuditTrail.entity_type)}</span>
                  </Badge>
                </div>
                <div>
                  <Label>{t('entityId')}</Label>
                  <p className="text-sm font-medium">{selectedAuditTrail.entity_id || '-'}</p>
                </div>
                <div>
                  <Label>{t('auditProjectId')}</Label>
                  <p className="text-sm font-medium">{selectedAuditTrail.project_id || '-'}</p>
                </div>
                <div>
                  <Label>{t('userId')}</Label>
                  <p className="text-sm font-medium">{selectedAuditTrail.user_id}</p>
                </div>
                <div>
                  <Label>{t('ipAddress')}</Label>
                  <p className="text-sm font-medium">{selectedAuditTrail.ip_address || '-'}</p>
                </div>
              </div>
              <div>
                <Label>{t('auditDescription')}</Label>
                <p className="text-sm">{selectedAuditTrail.description || t('noDescriptionAvailable')}</p>
              </div>
              <div>
                <Label>{t('timestamp')}</Label>
                <p className="text-sm">{new Date(selectedAuditTrail.created_at).toLocaleString()}</p>
              </div>
              <div>
                <Label>{t('userAgent')}</Label>
                <p className="text-sm font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded">
                  {selectedAuditTrail.user_agent || t('notAvailable')}
                </p>
              </div>
              {selectedAuditTrail.old_values && (
                <div>
                  <Label>{t('oldValues')}</Label>
                  <Textarea 
                    value={JSON.stringify(selectedAuditTrail.old_values, null, 2)} 
                    readOnly 
                    className="mt-1 font-mono text-sm"
                    rows={4}
                  />
                </div>
              )}
              {selectedAuditTrail.new_values && (
                <div>
                  <Label>{t('newValues')}</Label>
                  <Textarea 
                    value={JSON.stringify(selectedAuditTrail.new_values, null, 2)} 
                    readOnly 
                    className="mt-1 font-mono text-sm"
                    rows={4}
                  />
                </div>
              )}
              {selectedAuditTrail.field_changes && (
                <div>
                  <Label>{t('fieldChanges')}</Label>
                  <Textarea 
                    value={JSON.stringify(selectedAuditTrail.field_changes, null, 2)} 
                    readOnly 
                    className="mt-1 font-mono text-sm"
                    rows={3}
                  />
                </div>
              )}
              {selectedAuditTrail.additional_metadata && (
                <div>
                  <Label>{t('additionalMetadata')}</Label>
                  <Textarea 
                    value={JSON.stringify(selectedAuditTrail.additional_metadata, null, 2)} 
                    readOnly 
                    className="mt-1 font-mono text-sm"
                    rows={3}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setDetailDialogOpen(false)}>{t('close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
