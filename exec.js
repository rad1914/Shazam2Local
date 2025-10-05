// @path: exec.js
import { promisify } from 'util';
import { exec as _exec } from 'child_process';

export const exec = (cmd, opts = {}) => {
  const defaultOpts = { maxBuffer: 10 * 1024 * 1024 };
  return promisify(_exec)(cmd, { ...defaultOpts, ...opts });
};
