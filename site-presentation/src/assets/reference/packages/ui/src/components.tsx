// SPDX-License-Identifier: AGPL-3.0-or-later
import { t as tr } from './i18n.ts';
import { useEffect, useId, useRef, type ReactNode, type FormEvent } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';

export type IconName =
  | 'clock'
  | 'projects'
  | 'report'
  | 'team'
  | 'spark'
  | 'settings'
  | 'plus'
  | 'play'
  | 'pause'
  | 'stop'
  | 'arrow'
  | 'download'
  | 'close'
  | 'widget'
  | 'logout'
  | 'check'
  | 'edit'
  | 'link'
  | 'chevron';
const paths: Record<IconName, ReactNode> = {
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  projects: (
    <>
      <rect x="3" y="4" width="7" height="7" rx="1.5" />
      <rect x="14" y="4" width="7" height="7" rx="1.5" />
      <rect x="3" y="15" width="7" height="6" rx="1.5" />
      <path d="M14 16h7m-7 4h5" />
    </>
  ),
  report: (
    <>
      <path d="M5 20V4h14v16ZM8 16v-4m4 4V8m4 8v-6" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-2a6 6 0 0 1 12 0v2m1-15a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5" />
    </>
  ),
  spark: (
    <>
      <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="3" fill="currentColor" stroke="none" />
      <circle cx="16" cy="17" r="3" fill="currentColor" stroke="none" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  play: <path d="m8 5 11 7-11 7Z" fill="currentColor" stroke="none" />,
  pause: <path d="M8 5v14M16 5v14" strokeWidth="4" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  download: (
    <>
      <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
    </>
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
  widget: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <rect x="12" y="11" width="7" height="7" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  logout: (
    <>
      <path d="M9 4H4v16h5m-1-8h13m-5-5 5 5-5 5" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  edit: (
    <>
      <path d="m4 15 11-11 5 5L9 20H4Zm9-9 5 5" />
    </>
  ),
  link: (
    <>
      <path
        d="m10 14 4-4m-5 0 3-3a4 4 0 0 1 6 6l-3 3m-6-3-3 3a4 4 0 0 0 6 6l3-3"
        transform="translate(0 -2)"
      />
    </>
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
};
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="logo">
      <svg width="36" height="36" viewBox="0 0 96 96" aria-hidden="true">
        <path
          d="M22 67V29L48 53L74 29V67"
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx="74" cy="13" r="6" fill="var(--color-accent)" />
      </svg>
      {!compact && (
        <span>
          minutrel<span className="logo-dot">.</span>
        </span>
      )}
    </span>
  );
}
export function Dialog({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="icon-button" onClick={close} aria-label={tr('Fermer')}>
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name="clock" size={28} />
      </span>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
export function Badge({ children, tone = '' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  return (
    <span className={`avatar ${small ? 'small' : ''}`} aria-hidden="true">
      {name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0])
        .join('')
        .toUpperCase()}
    </span>
  );
}
export function formData(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return new FormData(event.currentTarget);
}
export const val = (f: FormData, name: string) => String(f.get(name) ?? '');
export function clockText(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
export function shortDuration(seconds: number) {
  return tr(
    '{0}h {1}',
    Math.floor(seconds / 3600),
    String(Math.floor(seconds / 60) % 60).padStart(2, '0'),
  );
}
export type Act = (
  operation: () => Promise<unknown>,
  success?: string,
  background?: boolean,
) => Promise<boolean>;
export interface Actions {
  act: Act;
  pending: boolean;
  refresh: () => Promise<void>;
  open: (title: string, content: ReactNode) => void;
  close: () => void;
}
export function WidgetFrame({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isTauri() || !ref.current) return;
    const observer = new ResizeObserver(() => {
      if (ref.current)
        void invoke('resize_widget', {
          height: Math.ceil(ref.current.getBoundingClientRect().height + 26),
        }).catch(() => {});
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <main className="widget-shell">
      <div ref={ref}>{children}</div>
    </main>
  );
}
