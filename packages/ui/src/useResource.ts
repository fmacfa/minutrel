// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useState } from 'react';
import { t as tr } from './i18n.ts';
import { request } from './transport.ts';

export function useResource<T>(path: string | null, revision = 0) {
  const [state, setState] = useState<{ path: string; data?: T; error?: string }>();
  useEffect(() => {
    if (!path) return;
    let active = true;
    void request<T>(path).then(
      (data) => {
        if (active) setState({ path, data });
      },
      (error: unknown) => {
        if (active)
          setState({
            path,
            error: error instanceof Error ? error.message : tr('Chargement impossible.'),
          });
      },
    );
    return () => {
      active = false;
    };
  }, [path, revision]);
  return state?.path === path ? state : undefined;
}
