// SPDX-License-Identifier: AGPL-3.0-or-later
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { EventEmitter } from 'node:events';
import { randomBytes, randomUUID, createHash, createCipheriv, createDecipheriv } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const id = () => randomUUID();
export const secret = () => randomBytes(32).toString('base64url');
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export class Problem extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}
export function ensure(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new Problem(status, message);
}
export interface StoreOptions {
  path?: string;
  setupToken?: string;
  key?: Buffer;
  now?: () => number;
}
export class Store {
  db: DatabaseSync;
  events = new EventEmitter();
  setupToken: string;
  key: Buffer;
  now: () => number;
  constructor(options: StoreOptions = {}) {
    const path =
      options.path ??
      resolve(
        process.env.APP_DATA_DIR ?? fileURLToPath(new URL('../../../data', import.meta.url)),
        'minutrel.sqlite',
      );
    const dir = dirname(path);
    if (path !== ':memory:') mkdirSync(dir, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    if (path !== ':memory:') chmodSync(path, 0o600);
    this.db.exec(
      'PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA trusted_schema=OFF;',
    );
    const currentVersion = this.get<{ user_version: number }>('PRAGMA user_version')!.user_version;
    if (currentVersion > 3) {
      this.db.close();
      throw new Problem(500, 'Cette base provient d’une version plus récente de Minutrel.');
    }
    this.now = options.now ?? (() => Math.floor(Date.now() / 1000));
    const loadSecret = (name: string) => {
      const file = resolve(dir, name);
      if (path === ':memory:') return secret();
      if (!existsSync(file)) writeFileSync(file, secret(), { mode: 0o600, flag: 'wx' });
      return readFileSync(file, 'utf8').trim();
    };
    this.setupToken =
      options.setupToken ?? (process.env.APP_SETUP_TOKEN || loadSecret('setup-token'));
    this.key =
      options.key ??
      Buffer.from(process.env.APP_MASTER_KEY || loadSecret('master.key'), 'base64url');
    ensure(this.key.length === 32, 'APP_MASTER_KEY doit contenir 32 octets encodés en base64url.');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workspace(id TEXT PRIMARY KEY, name TEXT NOT NULL, timezone TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS members(id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        role TEXT NOT NULL CHECK(role IN ('contributor','manager','admin')), enabled INTEGER NOT NULL DEFAULT 1,
        password TEXT NOT NULL, createdAt INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY, memberId TEXT NOT NULL REFERENCES members(id),
        csrf TEXT NOT NULL, native INTEGER NOT NULL DEFAULT 0, expiresAt INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL,
        color TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS assignments(projectId TEXT NOT NULL REFERENCES projects(id),
        memberId TEXT NOT NULL REFERENCES members(id), PRIMARY KEY(projectId,memberId));
      CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY, projectId TEXT NOT NULL REFERENCES projects(id),
        name TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS entries(id TEXT PRIMARY KEY, memberId TEXT NOT NULL REFERENCES members(id),
        projectId TEXT NOT NULL REFERENCES projects(id), taskId TEXT REFERENCES tasks(id),
        kind TEXT NOT NULL CHECK(kind IN ('timer','duration','interval')),
        state TEXT NOT NULL CHECK(state IN ('running','paused','finished','deleted')),
        description TEXT NOT NULL DEFAULT '', workDate TEXT, seconds INTEGER NOT NULL DEFAULT 0 CHECK(seconds>=0),
        version INTEGER NOT NULL DEFAULT 1, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS one_active_timer ON entries(memberId) WHERE state IN ('running','paused');
      CREATE INDEX IF NOT EXISTS entries_member_date ON entries(memberId,createdAt);
      CREATE TABLE IF NOT EXISTS segments(id TEXT PRIMARY KEY, entryId TEXT NOT NULL REFERENCES entries(id),
        startedAt INTEGER NOT NULL, endedAt INTEGER, CHECK(endedAt IS NULL OR endedAt>=startedAt));
      CREATE UNIQUE INDEX IF NOT EXISTS one_open_segment ON segments(entryId) WHERE endedAt IS NULL;
      CREATE INDEX IF NOT EXISTS segments_entry ON segments(entryId,startedAt);
      CREATE TABLE IF NOT EXISTS notes(id TEXT PRIMARY KEY, memberId TEXT NOT NULL REFERENCES members(id),
        projectId TEXT NOT NULL REFERENCES projects(id), workDate TEXT NOT NULL, text TEXT NOT NULL,
        shared INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS summaries(id TEXT PRIMARY KEY, memberId TEXT NOT NULL REFERENCES members(id),
        month TEXT NOT NULL, text TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', source TEXT NOT NULL,
        entryIds TEXT NOT NULL, createdAt INTEGER NOT NULL, approvedAt INTEGER);
      CREATE TABLE IF NOT EXISTS tokens(id TEXT PRIMARY KEY, hash TEXT NOT NULL UNIQUE,
        memberId TEXT NOT NULL REFERENCES members(id), name TEXT NOT NULL, scopes TEXT NOT NULL,
        expiresAt INTEGER NOT NULL, createdAt INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS providers(id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL,
        baseUrl TEXT NOT NULL, model TEXT NOT NULL, enabled INTEGER NOT NULL, secret TEXT);
      CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY, actorId TEXT REFERENCES members(id), action TEXT NOT NULL,
        objectId TEXT NOT NULL, detail TEXT NOT NULL, createdAt INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS idempotency(memberId TEXT NOT NULL, key TEXT NOT NULL, fingerprint TEXT NOT NULL,
        response TEXT NOT NULL, createdAt INTEGER NOT NULL, PRIMARY KEY(memberId,key));
      CREATE TABLE IF NOT EXISTS exports(id TEXT PRIMARY KEY, memberId TEXT NOT NULL REFERENCES members(id),
        expiresAt INTEGER NOT NULL, format TEXT NOT NULL, snapshot TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sync_receipts(memberId TEXT NOT NULL REFERENCES members(id), mutationId TEXT NOT NULL,
        fingerprint TEXT NOT NULL, response TEXT NOT NULL, PRIMARY KEY(memberId,mutationId));
    `);
    if (currentVersion < 2) {
      this.tx(() => {
        if (this.get<{ user_version: number }>('PRAGMA user_version')!.user_version >= 2) return;
        this.db.exec(`
          ALTER TABLE projects ADD COLUMN budgetSeconds INTEGER CHECK(budgetSeconds>0);
          ALTER TABLE projects ADD COLUMN dueOn TEXT;
          CREATE TABLE project_actions(
            id TEXT PRIMARY KEY, projectId TEXT NOT NULL REFERENCES projects(id), taskId TEXT REFERENCES tasks(id),
            title TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('todo','in_progress','done')),
            assigneeId TEXT REFERENCES members(id), startOn TEXT, dueOn TEXT,
            estimateSeconds INTEGER CHECK(estimateSeconds>0), version INTEGER NOT NULL DEFAULT 1
          );
          CREATE INDEX project_actions_project ON project_actions(projectId);
          ALTER TABLE entries ADD COLUMN actionId TEXT REFERENCES project_actions(id);
          CREATE INDEX entries_project_state ON entries(projectId,state);
          CREATE INDEX entries_action ON entries(actionId) WHERE actionId IS NOT NULL;
          CREATE TABLE timesheets(
            memberId TEXT NOT NULL REFERENCES members(id), weekStart TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('submitted','approved','returned')),
            version INTEGER NOT NULL, submittedAt INTEGER NOT NULL, reviewedAt INTEGER,
            reviewerId TEXT REFERENCES members(id), reason TEXT NOT NULL DEFAULT '',
            PRIMARY KEY(memberId,weekStart)
          );
          CREATE INDEX timesheets_week ON timesheets(weekStart,status);
          PRAGMA user_version=2;
        `);
      });
    }
    if (currentVersion < 3) {
      this.tx(() => {
        if (this.get<{ user_version: number }>('PRAGMA user_version')!.user_version >= 3) return;
        this.db.exec(`
          CREATE TABLE member_rates(
            memberId TEXT PRIMARY KEY NOT NULL REFERENCES members(id),
            amountMinor INTEGER NOT NULL CHECK(amountMinor BETWEEN 0 AND 100000000),
            currency TEXT NOT NULL CHECK(currency IN ('EUR','CHF','GBP','USD','CAD','AUD'))
          );
          PRAGMA user_version=3;
        `);
      });
    }
  }
  get<T>(sql: string, ...params: SQLInputValue[]): T | undefined {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }
  all<T>(sql: string, ...params: SQLInputValue[]): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }
  run(sql: string, ...params: SQLInputValue[]) {
    return this.db.prepare(sql).run(...params);
  }
  tx<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  audit(actorId: string | null, action: string, objectId: string, detail: unknown = {}) {
    this.run(
      'INSERT INTO audit VALUES (?,?,?,?,?,?)',
      id(),
      actorId,
      action,
      objectId,
      JSON.stringify(detail),
      this.now(),
    );
  }
  changed() {
    this.events.emit('change');
  }
  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map((v) => v.toString('base64url')).join('.');
  }
  decrypt(value: string): string {
    const [iv, tag, ciphertext] = value.split('.').map((v) => Buffer.from(v, 'base64url'));
    const cipher = createDecipheriv('aes-256-gcm', this.key, iv!);
    cipher.setAuthTag(tag!);
    return Buffer.concat([cipher.update(ciphertext!), cipher.final()]).toString('utf8');
  }
  close() {
    this.events.removeAllListeners();
    this.db.close();
  }
}
