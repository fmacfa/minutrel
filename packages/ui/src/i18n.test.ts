// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';
import { messages } from './locales/messages.ts';
it('fournit les deux traductions et préserve chaque paramètre des messages de l’interface', () => {
  for (const [key, translations] of Object.entries(messages))
    for (const value of translations) {
      expect(value.trim(), key).not.toBe('');
      expect([...value.matchAll(/\{\d+\}/g)].map((m) => m[0]).sort(), key).toEqual(
        [...key.matchAll(/\{\d+\}/g)].map((m) => m[0]).sort(),
      );
    }
  const root = new URL('./', import.meta.url);
  for (const file of readdirSync(root).filter(
    (f) => /\.tsx?$/.test(f) && !f.includes('.test.') && !f.startsWith('i18n'),
  )) {
    const code = readFileSync(new URL(file, root), 'utf8');
    const ast = ts.createSourceFile(
      file,
      code,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        node.expression.getText(ast) === 'tr' &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        const key = node.arguments[0].text;
        if (!key.startsWith('[mcp_servers') && !key.startsWith('Bearer '))
          expect(messages[key], `${file}: ${key}`).toBeDefined();
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
});
