import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const COLORS = {
  passed: '#10b981',
  failed: '#ef4444',
  blocked: '#f59e0b',
  skipped: '#6b7280',
  'in-progress': '#3b82f6',
};

interface TestResultData {
  name: string;
  value: number;
  color: string;
}

interface TestRunChartProps {
  data: TestResultData[];
  title: string;
  onChartClick?: (data: any) => void;
}

export function TestRunPieChart({ data, title, onChartClick }: TestRunChartProps) {
  const handlePieClick = (data: any) => {
    if (onChartClick && data) {
      onChartClick({ type: 'status', value: data.name.toLowerCase() });
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
            onClick={handlePieClick}
            style={{ cursor: 'pointer' }}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

interface SectionData {
  name: string;
  passed: number;
  failed: number;
  blocked: number;
  total: number;
}

export function TestRunBarChart({ data, title, onChartClick }: { data: SectionData[], title: string, onChartClick?: (data: any) => void }) {
  const handleBarClick = (data: any) => {
    if (onChartClick && data) {
      onChartClick({ type: 'section', value: data.name });
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar 
            dataKey="passed" 
            stackId="a" 
            fill={COLORS.passed} 
            name="Passed"
            onClick={handleBarClick}
            style={{ cursor: 'pointer' }}
          />
          <Bar 
            dataKey="failed" 
            stackId="a" 
            fill={COLORS.failed} 
            name="Failed"
            onClick={handleBarClick}
            style={{ cursor: 'pointer' }}
          />
          <Bar 
            dataKey="blocked" 
            stackId="a" 
            fill={COLORS.blocked} 
            name="Blocked"
            onClick={handleBarClick}
            style={{ cursor: 'pointer' }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TrendData {
  date: string;
  passRate: number;
  totalTests: number;
}

export function TestRunTrendChart({ data, title }: { data: TrendData[], title: string }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="passRate" fill={COLORS.passed} name="Pass Rate %" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
