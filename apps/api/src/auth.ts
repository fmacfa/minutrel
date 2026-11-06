// SPDX-License-Identifier: AGPL-3.0-or-later
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { FastifyRequest } from 'fastify';
import type { Member, Session, Workspace } from '@minutrel/contracts';
import { Store, ensure, hash, secret } from './store.ts';

const derive = promisify(scrypt);
export interface MemberRow extends Omit<Member, 'enabled'> {
  enabled: number;
  password: string;
}
export function publicMember(member: MemberRow): Member {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    enabled: !!member.enabled,
    createdAt: member.createdAt,
  };
}
export async function passwordHash(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = (await derive(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}
export async function passwordMatches(password: string, stored: string): Promise<boolean> {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const actual = (await derive(password, salt, 64)) as Buffer;
  const expectedKey = Buffer.from(expected, 'hex');
  return actual.length === expectedKey.length && timingSafeEqual(actual, expectedKey);
}
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
}
export function newSession(
  store: Store,
  member: MemberRow,
  native: boolean,
): Session & { token: string } {
  const token = secret();
  const csrf = secret();
  store.run('DELETE FROM sessions WHERE expiresAt<=?', store.now());
  store.run(
    'INSERT INTO sessions VALUES (?,?,?,?,?)',
    hash(token),
    member.id,
    csrf,
    native ? 1 : 0,
    store.now() + (native ? 30 : 7) * 86400,
  );
  return {
    token,
    csrf,
    member: publicMember(member),
    workspace: store.get<Workspace>('SELECT * FROM workspace')!,
    serverNow: store.now(),
  };
}
export function authenticate(store: Store, request: FastifyRequest, write = false): MemberRow {
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : request.cookies.minutrel;
  ensure(token, 'Connectez-vous pour continuer.', 401);
  const session = store.get<{ memberId: string; csrf: string; native: number }>(
    'SELECT * FROM sessions WHERE hash=? AND expiresAt>?',
    hash(token),
    store.now(),
  );
  ensure(
    session && (session.native ? authorization : !authorization),
    'Votre session a expiré. Reconnectez-vous.',
    401,
  );
  if (write && !session.native)
    ensure(
      safeEqual(String(request.headers['x-csrf-token'] ?? ''), session.csrf),
      'Jeton de session invalide.',
      403,
    );
  const member = store.get<MemberRow>(
    'SELECT * FROM members WHERE id=? AND enabled=1',
    session.memberId,
  );
  ensure(member, 'Ce compte est désactivé.', 401);
  return member;
}
export function requireRole(member: MemberRow, ...roles: Member['role'][]) {
  ensure(roles.includes(member.role), 'Ce droit est réservé à la gestion de l’équipe.', 403);
}
export function sessionDetails(store: Store, request: FastifyRequest): Session {
  const member = authenticate(store, request);
  const token = request.headers.authorization?.slice(7) ?? request.cookies.minutrel!;
  return {
    member: publicMember(member),
    workspace: store.get<Workspace>('SELECT * FROM workspace')!,
    csrf: store.get<{ csrf: string }>('SELECT csrf FROM sessions WHERE hash=?', hash(token))!.csrf,
    serverNow: store.now(),
  };
}
