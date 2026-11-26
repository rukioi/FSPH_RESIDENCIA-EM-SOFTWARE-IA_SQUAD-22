import type { Config } from '@netlify/server';
import { createApp } from '../../../backend/src/app.js';

export const config: Config = { path: ['/api', '/api/*'] };

export default createApp();
