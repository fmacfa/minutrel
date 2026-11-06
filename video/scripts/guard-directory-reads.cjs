// On this Mac, reading an ancestor directory as a file can remain pending.
// Webpack needs file contents; return the standard EISDIR result promptly.
const fs = require('node:fs');
const readFile = fs.readFile;
fs.readFile = function (path, ...args) {
  try {
    if (fs.statSync(path).isDirectory()) {
      const error = Object.assign(new Error('EISDIR: illegal operation on a directory'), {
        code: 'EISDIR',
        errno: -21,
        path,
      });
      const callback = args.at(-1);
      queueMicrotask(() => callback(error));
      return;
    }
  } catch {}
  return readFile.call(this, path, ...args);
};
