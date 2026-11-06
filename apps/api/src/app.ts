// SPDX-License-Identifier: AGPL-3.0-or-later
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { instanceInfo } from '@minutrel/contracts';
import { Store, type StoreOptions, ensure, Problem } from './store.ts';
import { registerRoutes } from './routes.ts';
import { authenticate } from './auth.ts';
import { registerExports } from './reports.ts';
import { registerAi } from './integrations/ai.ts';
import { registerMcp } from './integrations/mcp.ts';
import { registerPortability } from './portability.ts';
import { registerOffline } from './offline.ts';

export function createApp(
  options: StoreOptions & {
    fetcher?: typeof fetch;
    logLevel?: 'silent' | 'error' | 'warn' | 'info';
  } = {},
) {
  const store = new Store(options);
  const app = Object.assign(
    Fastify({
      logger: options.logLevel
        ? {
            level: options.logLevel,
            redact: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
            ],
          }
        : false,
      bodyLimit: 1024 * 1024,
      requestTimeout: 70000,
    }),
    { store },
  );
  app.register(cookie);
  app.register(rateLimit, { global: false });
  const streams = new Set<() => void>();
  store.events.setMaxListeners(0);
  app.addHook('onRequest', async (request, reply) => {
    reply
      .header('Cache-Control', 'no-store')
      .header('X-Content-Type-Options', 'nosniff')
      .header('Referrer-Policy', 'same-origin');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.origin) {
      const expected = process.env.APP_PUBLIC_URL
        ? new URL(process.env.APP_PUBLIC_URL).origin
        : `${request.protocol}://${request.headers.host}`;
      ensure(request.headers.origin === expected, 'Cette origine n’est pas autorisée.', 403);
    }
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError)
      return reply.code(400).send({
        error: 'validation',
        message: `Données invalides : ${error.issues
          .map((i) => `${i.path.join('.')} ${i.message}`)
          .slice(0, 3)
          .join(' ; ')}`,
      });
    if (error instanceof Problem)
      return reply.code(error.statusCode).send({ error: 'request', message: error.message });
    if (error instanceof RangeError)
      return reply.code(400).send({ error: 'validation', message: error.message });
    const typed = error as { statusCode?: number; code?: string };
    if (typed.statusCode === 429)
      return reply
        .code(429)
        .send({ error: 'rate_limit', message: 'Trop de tentatives. Réessayez dans une minute.' });
    if (typed.statusCode && typed.statusCode >= 400 && typed.statusCode < 500)
      return reply
        .code(typed.statusCode)
        .send({ error: 'request', message: 'La requête n’est pas valide.' });
    request.log.error({ err: error }, 'Erreur interne');
    return reply.code(500).send({ error: 'internal', message: 'Une erreur interne est survenue.' });
  });
  app.get('/api/v1/instance', async () => instanceInfo);
  app.get('/api/v1/health/live', async () => ({ status: 'ok' }));
  app.get('/api/v1/health/ready', async () => {
    store.get('SELECT 1');
    return { status: 'ok' };
  });
  app.after(() => {
    registerRoutes(app, store);
    registerExports(app, store);
    registerAi(app, store, options.fetcher);
    registerMcp(app, store);
    registerPortability(app, store);
    registerOffline(app, store);
  });
  app.get('/api/v1/events', async (request, reply) => {
    authenticate(store, request);
    ensure(streams.size < 200, 'Trop de connexions simultanées.', 429);
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
      'X-Content-Type-Options': 'nosniff',
    });
    const send = () => {
      try {
        authenticate(store, request);
        reply.raw.write('event: change\ndata: {}\n\n');
      } catch {
        close();
      }
    };
    const close = () => {
      clearInterval(heartbeat);
      store.events.off('change', send);
      streams.delete(close);
      reply.raw.end();
    };
    const heartbeat = setInterval(() => {
      try {
        authenticate(store, request);
        reply.raw.write(': heartbeat\n\n');
      } catch {
        close();
      }
    }, 25000);
    heartbeat.unref();
    store.events.on('change', send);
    streams.add(close);
    request.raw.on('close', close);
    reply.raw.write('event: connected\ndata: {}\n\n');
  });
  app.addHook('preClose', async () => {
    for (const close of streams) close();
  });
  app.addHook('onClose', async () => {
    store.close();
  });
  return app;
}
