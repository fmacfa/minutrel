// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from './auth.ts';
import { activeTimer, createManual, entryById, projectAccess } from './service.ts';
import { ensure, hash, id, Store } from './store.ts';

const snapshot = z
  .object({
    mutationId: z.uuid(),
    baseVersion: z.number().int().positive().nullable(),
    entry: z
      .object({
        id: z.uuid(),
        projectId: z.uuid(),
        taskId: z.uuid().nullable(),
        description: z.string().trim().max(2000),
        state: z.enum(['running', 'paused', 'finished', 'deleted']),
        segments: z
          .array(
            z
              .object({
                startedAt: z.number().int().nonnegative(),
                endedAt: z.number().int().nonnegative().nullable(),
              })
              .strict(),
          )
          .min(1)
          .max(500),
      })
      .strict(),
  })
  .strict();

export function registerOffline(app: FastifyInstance, store: Store) {
  app.post('/api/v1/sync/import', async (request) => {
    const member = authenticate(store, request, true);
    const data = z
      .object({
        localId: z.uuid(),
        input: z
          .object({
            projectId: z.uuid(),
            taskId: z.uuid().nullable().optional(),
            description: z.string().max(2000),
            kind: z.enum(['duration', 'interval']),
            duration: z.string().max(60).optional(),
            workDate: z.string().max(10).optional(),
            startedAt: z.string().max(60).optional(),
            endedAt: z.string().max(60).optional(),
            allowOverlap: z.boolean().default(false),
          })
          .strict(),
      })
      .strict()
      .parse(request.body);
    const fingerprint = hash(JSON.stringify(data));
    const result = store.tx(() => {
      const receipt = store.get<{ fingerprint: string; response: string }>(
        'SELECT * FROM sync_receipts WHERE memberId=? AND mutationId=?',
        member.id,
        data.localId,
      );
      if (receipt) {
        ensure(
          receipt.fingerprint === fingerprint,
          'Ce transfert a déjà une autre affectation. Conservez le projet choisi au premier envoi.',
          409,
        );
        return JSON.parse(receipt.response) as ReturnType<typeof createManual>;
      }
      const result = createManual(store, member, data.input);
      store.run(
        'INSERT INTO sync_receipts VALUES (?,?,?,?)',
        member.id,
        data.localId,
        fingerprint,
        JSON.stringify(result),
      );
      return result;
    });
    store.changed();
    return result;
  });
  app.post('/api/v1/sync/time-entry', async (request) => {
    const member = authenticate(store, request, true);
    const data = snapshot.parse(request.body);
    const fingerprint = hash(JSON.stringify(data));
    const result = store.tx(() => {
      const receipt = store.get<{ fingerprint: string; response: string }>(
        'SELECT * FROM sync_receipts WHERE memberId=? AND mutationId=?',
        member.id,
        data.mutationId,
      );
      if (receipt) {
        ensure(receipt.fingerprint === fingerprint, 'Cet envoi a déjà un autre contenu.', 409);
        return JSON.parse(receipt.response) as {
          entry: ReturnType<typeof entryById>;
          serverNow: number;
        };
      }
      const e = data.entry;
      projectAccess(store, member, e.projectId, e.taskId);
      const previous = store.get<{
        memberId: string;
        version: number;
        kind: string;
        state: string;
        projectId: string;
        taskId: string | null;
      }>('SELECT * FROM entries WHERE id=?', e.id);
      ensure(
        !previous || previous.memberId === member.id,
        'Ce temps appartient à un autre membre.',
        403,
      );
      ensure(
        data.baseVersion === null ? !previous : previous && previous.version === data.baseVersion,
        'Ce temps a changé sur le serveur. Vos données locales sont conservées ; résolvez le conflit.',
        409,
      );
      ensure(
        !previous || (previous.kind === 'timer' && ['running', 'paused'].includes(previous.state)),
        'Ce temps ne peut plus être synchronisé.',
        409,
      );
      ensure(
        !previous || (previous.projectId === e.projectId && previous.taskId === e.taskId),
        'Le chronomètre a changé sur un autre appareil. Actualisez.',
        409,
      );
      const open = e.segments.filter((s) => s.endedAt === null);
      ensure(
        e.state === 'running'
          ? open.length === 1 && e.segments.at(-1)?.endedAt === null
          : open.length === 0,
        'Les segments ne correspondent pas à l’état du chronomètre.',
      );
      const now = store.now();
      let seconds = 0;
      for (const [index, s] of e.segments.entries()) {
        ensure(
          s.startedAt <= now + 60 &&
            (s.endedAt === null || (s.endedAt >= s.startedAt && s.endedAt <= now + 60)),
          'L’horloge locale est incohérente. Corrigez les dates avant de synchroniser.',
          409,
        );
        if (index)
          ensure(
            e.segments[index - 1]!.endedAt !== null &&
              e.segments[index - 1]!.endedAt! <= s.startedAt,
            'Les segments se chevauchent.',
          );
        seconds += s.endedAt === null ? 0 : s.endedAt - s.startedAt;
        const overlap = store.get(
          `SELECT 1 FROM segments s JOIN entries e ON e.id=s.entryId
          WHERE e.memberId=? AND e.id!=? AND e.state!='deleted' AND s.startedAt<? AND COALESCE(s.endedAt,?)>? LIMIT 1`,
          member.id,
          e.id,
          s.endedAt ?? now + 1,
          now + 1,
          s.startedAt,
        );
        ensure(
          !overlap,
          'Ce temps chevauche un temps du serveur. Vos données locales sont conservées.',
          409,
        );
      }
      const current = activeTimer(store, member.id);
      ensure(
        !['running', 'paused'].includes(e.state) || !current || current.id === e.id,
        'Un autre chronomètre est actif sur le serveur. Terminez-le avant de synchroniser.',
        409,
      );
      ensure(
        e.state !== 'deleted' || seconds === 0,
        'Un temps non vide doit être conservé puis corrigé avec un motif.',
      );
      const state = e.state === 'finished' && !seconds ? 'deleted' : e.state;
      if (previous) {
        const before = entryById(store, e.id);
        // Une synchronisation ne réécrit pas l’historique déjà accepté.
        for (const [index, old] of before.segments.entries()) {
          const next = e.segments[index];
          ensure(
            next &&
              next.startedAt === old.startedAt &&
              (old.endedAt === null || old.endedAt === next.endedAt),
            'L’historique du serveur ne peut pas être remplacé par la synchronisation.',
            409,
          );
        }
        store.run(
          'UPDATE entries SET state=?,description=?,seconds=?,version=version+1,updatedAt=? WHERE id=?',
          state,
          e.description,
          seconds,
          now,
          e.id,
        );
        store.run('DELETE FROM segments WHERE entryId=?', e.id);
      } else
        store.run(
          "INSERT INTO entries VALUES (?,?,?,?,'timer',?,?,NULL,?,1,?,?)",
          e.id,
          member.id,
          e.projectId,
          e.taskId,
          state,
          e.description,
          seconds,
          e.segments[0]!.startedAt,
          now,
        );
      for (const s of e.segments)
        store.run('INSERT INTO segments VALUES (?,?,?,?)', id(), e.id, s.startedAt, s.endedAt);
      store.audit(member.id, 'time.sync', e.id, {
        mutationId: data.mutationId,
        baseVersion: data.baseVersion,
        seconds,
        state,
      });
      const response = { entry: entryById(store, e.id), serverNow: now };
      store.run(
        'INSERT INTO sync_receipts VALUES (?,?,?,?)',
        member.id,
        data.mutationId,
        fingerprint,
        JSON.stringify(response),
      );
      return response;
    });
    store.changed();
    return result;
  });
}
