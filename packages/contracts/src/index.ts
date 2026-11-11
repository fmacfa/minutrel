// SPDX-License-Identifier: AGPL-3.0-or-later

export const instanceInfo = { name: 'Minutrel', api_version: 'v1', version: '0.1.0' } as const;
export type Role = 'contributor' | 'manager' | 'admin';
export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  enabled: boolean;
  createdAt: number;
}
export interface Workspace {
  id: string;
  name: string;
  timezone: string;
}
export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  archived: boolean;
  version: number;
  memberIds: string[];
  tasks: Task[];
  budgetSeconds?: number | null;
  dueOn?: string | null;
}
export interface Task {
  id: string;
  projectId: string;
  name: string;
  archived: boolean;
}
export type ActionStatus = 'todo' | 'in_progress' | 'done';
export interface ProjectAction {
  id: string;
  projectId: string;
  taskId: string | null;
  title: string;
  status: ActionStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  startOn: string | null;
  dueOn: string | null;
  estimateSeconds: number | null;
  version: number;
}
export interface Segment {
  startedAt: number;
  endedAt: number | null;
}
export interface TimeEntry {
  id: string;
  memberId: string;
  projectId: string;
  taskId: string | null;
  projectName: string;
  projectColor: string;
  taskName: string | null;
  actionId?: string | null;
  actionName?: string | null;
  memberName: string;
  kind: 'timer' | 'duration' | 'interval';
  state: 'running' | 'paused' | 'finished' | 'deleted';
  description: string;
  workDate: string | null;
  seconds: number;
  version: number;
  createdAt: number;
  updatedAt: number;
  segments: Segment[];
}
export type ReportEntry = TimeEntry & { reportSeconds: number };
export interface ProjectOverview {
  scope: 'personal' | 'team';
  totalSeconds: number;
  filteredSeconds: number;
  entryCount: number;
  categories: { taskId: string | null; seconds: number }[];
  entries: ReportEntry[];
}
export type TimesheetStatus = 'draft' | 'submitted' | 'approved' | 'returned';
export interface Timesheet {
  memberId: string;
  memberName: string;
  weekStart: string;
  status: TimesheetStatus;
  version: number;
  seconds: number;
  hasActiveTime: boolean;
  submittedAt: number | null;
  reviewedAt: number | null;
  reviewerName: string | null;
  reason: string;
}
export interface TimesheetDetail {
  sheet: Timesheet;
  entries: ReportEntry[];
  entryCount: number;
}
export interface WorkNote {
  id: string;
  memberId: string;
  projectId: string;
  workDate: string;
  text: string;
  projectName: string;
  shared: boolean;
  source: 'human' | 'assistant';
  createdAt: number;
  updatedAt: number;
}
export interface MonthlyReport {
  language?: 'fr' | 'en' | 'de';
  approvedOnly?: boolean;
  month: string;
  timezone: string;
  generatedAt: number;
  totalSeconds: number;
  workspaceName: string;
  activeTimers: number;
  entryCount: number;
  members: { id: string; name: string; email: string; seconds: number }[];
  projects: { id: string; name: string; color: string; seconds: number }[];
  entries: ReportEntry[];
  notes: WorkNote[];
  summaries: WorkSummary[];
}
export interface WorkSummary {
  id: string;
  memberId: string;
  month: string;
  text: string;
  status: 'draft' | 'approved';
  source: 'human' | 'ai';
  entryIds: string[];
  createdAt: number;
  approvedAt: number | null;
}
export const mcpScopes = [
  'projects.read',
  'time.read_own',
  'work.read_own',
  'work.draft_own',
  'timer.write_own',
] as const;
export type McpScope = (typeof mcpScopes)[number];
export interface McpToken {
  id: string;
  name: string;
  scopes: McpScope[];
  expiresAt: number;
  createdAt: number;
}
export interface Provider {
  id: string;
  name: string;
  kind: 'openai-compatible' | 'anthropic';
  baseUrl: string;
  model: string;
  enabled: boolean;
  hasSecret: boolean;
}
export interface Session {
  member: Member;
  workspace: Workspace;
  csrf: string;
  serverNow: number;
}
