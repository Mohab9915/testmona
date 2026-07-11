// Builds a self-contained, copy-pasteable Markdown prompt for an AI coding
// assistant (Claude Code, Copilot, Cursor, ...) from a defect's data, optionally
// enriched with its linked test case. Kept as a pure function (no i18n, no React)
// so it stays reusable if a future "connect repo" / auto-apply-fix flow wants the
// same context block.
export type PromptDefect = {
  defect_id?: string | null;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  severity?: string | null;
  priority?: string | null;
  steps_to_reproduce?: string | null;
  expected_result?: string | null;
  actual_result?: string | null;
  environment?: string | null;
  browser_info?: string | null;
  tags?: string | null;
  found_in_version?: string | null;
  fix_version?: string | null;
};

export type PromptTestCaseStep = {
  step_number?: number | null;
  action?: string | null;
  expected_result?: string | null;
};

export type PromptTestCase = {
  key?: string | null;
  title?: string | null;
  test_type?: string | null;
  priority?: string | null;
  status?: string | null;
  preconditions?: string | null;
  steps?: string | null;
  expected_result?: string | null;
  reference?: string | null;
  tags?: Array<{ name: string } | string> | null;
  test_steps?: PromptTestCaseStep[] | null;
};

export type DefectPromptMode = 'defect' | 'defect_test_case';

const clean = (value?: string | null): string => String(value ?? '').trim();

// Enum-ish backend values ("in_progress", "high") read better title-cased in a prompt.
const humanize = (value?: string | null): string => {
  const text = clean(value);
  if (!text) return '';
  return text
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Defect.tags is a raw comma-separated string that may contain stray whitespace
// or empty segments (e.g. "a,, b,"); normalize before rendering.
const normalizeTagList = (value?: string | null): string =>
  String(value ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .join(', ');

const field = (label: string, value?: string | null): string | null => {
  const text = clean(value);
  return text ? `- **${label}:** ${text}` : null;
};

const humanField = (label: string, value?: string | null): string | null => {
  const text = humanize(value);
  return text ? `- **${label}:** ${text}` : null;
};

const section = (heading: string, value?: string | null): string | null => {
  const text = clean(value);
  return text ? `### ${heading}\n${text}` : null;
};

function formatTestCase(testCase: PromptTestCase): string {
  const lines: string[] = [];
  const heading = `## Linked Test Case${testCase.key ? `: ${testCase.key}` : ''}${testCase.title ? ` — ${testCase.title}` : ''}`;
  lines.push(heading);

  const meta = [
    humanField('Type', testCase.test_type),
    humanField('Priority', testCase.priority),
    humanField('Status', testCase.status),
    field('Reference', testCase.reference),
  ].filter(Boolean);
  if (meta.length) lines.push(meta.join('\n'));

  const tagNames = (testCase.tags || [])
    .map((tag) => (typeof tag === 'string' ? tag : tag?.name))
    .map((name) => clean(name))
    .filter(Boolean);
  if (tagNames.length) lines.push(`- **Tags:** ${tagNames.join(', ')}`);

  const preconditions = section('Preconditions', testCase.preconditions);
  if (preconditions) lines.push(preconditions);

  const stepLines = (testCase.test_steps || [])
    .slice()
    .sort((a, b) => (a.step_number ?? 0) - (b.step_number ?? 0))
    .map((step, index) => {
      const action = clean(step.action) || '(no action described)';
      const expected = clean(step.expected_result);
      const number = step.step_number ?? index + 1;
      return expected ? `${number}. ${action} → *Expected:* ${expected}` : `${number}. ${action}`;
    });
  if (stepLines.length > 0) {
    lines.push(`### Test Steps\n${stepLines.join('\n')}`);
  } else {
    const legacySteps = section('Test Steps', testCase.steps);
    if (legacySteps) lines.push(legacySteps);
  }

  const expected = section('Overall Expected Result', testCase.expected_result);
  if (expected) lines.push(expected);

  return lines.join('\n\n');
}

export function buildDefectPrompt(
  defect: PromptDefect,
  mode: DefectPromptMode,
  testCase?: PromptTestCase | null,
): string {
  const parts: string[] = [];

  parts.push(
    'You are an expert software engineer. Investigate and fix the following defect in this codebase. ' +
      'Locate the relevant code, explain the likely root cause, then implement a fix and, if applicable, a regression test.',
  );

  const heading = `## Defect${defect.defect_id ? `: ${defect.defect_id}` : ''}${defect.title ? ` — ${defect.title}` : ''}`;
  parts.push(heading);

  const meta = [
    humanField('Severity', defect.severity),
    humanField('Priority', defect.priority),
    humanField('Status', defect.status),
    field('Environment', defect.environment),
    field('Browser / Device', defect.browser_info),
    field('Found in version', defect.found_in_version),
    field('Target fix version', defect.fix_version),
  ].filter(Boolean);
  if (meta.length) parts.push(meta.join('\n'));

  const tagList = normalizeTagList(defect.tags);
  if (tagList) parts.push(`- **Tags:** ${tagList}`);

  const description = section('Description', defect.description);
  if (description) parts.push(description);

  const steps = section('Steps to Reproduce', defect.steps_to_reproduce);
  if (steps) parts.push(steps);

  const expected = section('Expected Result', defect.expected_result);
  if (expected) parts.push(expected);

  const actual = section('Actual Result', defect.actual_result);
  if (actual) parts.push(actual);

  if (mode === 'defect_test_case' && testCase) {
    parts.push('---');
    parts.push(formatTestCase(testCase));
  }

  parts.push('---');
  parts.push(
    '## Task\n' +
      '1. Find the code responsible for this behavior.\n' +
      '2. Explain the root cause in a sentence or two.\n' +
      '3. Implement a fix.\n' +
      '4. Suggest (or add) a test that would have caught this regression.',
  );

  return parts.filter(Boolean).join('\n\n');
}
