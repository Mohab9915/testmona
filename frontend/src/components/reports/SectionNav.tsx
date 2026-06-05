import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { Activity, BarChart3, Loader2, Target } from 'lucide-react';
import { ReportsData } from '@/hooks/useReportsData';
import { SectionKey } from '@/components/reports/reportsUtils';

export function SectionNav({ ctx }: { ctx: ReportsData }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const { activeSection, sectionLoading } = ctx;

  // Tabs are real navigations so each section is linkable; the page syncs the
  // URL slug back into the active section. Existing query params (scope/share)
  // are preserved across tab switches.
  const goToSection = (key: SectionKey) => {
    const query = searchParams.toString();
    navigate(`/projects/${projectId}/reports/${key}${query ? `?${query}` : ''}`);
  };

  const sections: { key: SectionKey; label: string; desc: string; icon: any }[] = [
    { key: 'overview', label: t('reportsSectionOverview'), desc: t('reportsSectionOverviewDesc'), icon: BarChart3 },
    { key: 'coverage-risk', label: t('reportsSectionCoverageRisk'), desc: t('reportsSectionCoverageRiskDesc'), icon: Target },
    { key: 'activity', label: t('reportsSectionActivity'), desc: t('reportsSectionActivityDesc'), icon: Activity },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {sections.map((section) => {
        const Icon = section.icon;
        const loading = sectionLoading(section.key);
        const active = activeSection === section.key;
        return (
          <button
            key={section.key}
            type="button"
            onClick={() => goToSection(section.key)}
            className={`rounded-lg border p-4 text-start transition-all ${
              active
                ? 'border-blue-500 bg-blue-50 text-blue-900 shadow-xs dark:border-blue-500 dark:bg-blue-950/30 dark:text-blue-100'
                : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-semibold">
                <Icon className="h-4 w-4" />
                <span>{section.label}</span>
              </div>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{section.desc}</p>
          </button>
        );
      })}
    </div>
  );
}
