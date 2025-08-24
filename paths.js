// @path: paths.js
import path from 'path';
import { fileURLToPath } from 'url';

export const getDirname = importMetaUrl =>
  path.dirname(fileURLToPath(importMetaUrl));
  
