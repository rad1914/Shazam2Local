// @path: exec.js
import { promisify } from 'util';
import { exec as _exec } from 'child_process';

export const exec = promisify(_exec);
