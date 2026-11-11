// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ProjectAction } from '@minutrel/contracts';
import { t as tr } from './i18n.ts';
import { useResource } from './useResource.ts';

export function ActionPicker({
  projectId,
  taskId,
  value,
  onChange,
  disabled,
  existingTitle,
  revision,
}: {
  projectId: string;
  taskId: string;
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  existingTitle?: string | null;
  revision?: number;
}) {
  const result = useResource<ProjectAction[]>(
    projectId ? `/project-actions?projectId=${projectId}` : null,
    revision,
  );
  const actions = (result?.data ?? []).filter((a) => (a.taskId ?? '') === taskId);
  if (!actions.length && !value) return null;
  return (
    <select
      aria-label={tr('Action facultative')}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      <option value="">{tr('Sans action')}</option>
      {value && !actions.some((a) => a.id === value) && (
        <option value={value}>{existingTitle ?? tr('Action associée')}</option>
      )}
      {actions.map((a) => (
        <option key={a.id} value={a.id}>
          {a.title}
        </option>
      ))}
    </select>
  );
}
