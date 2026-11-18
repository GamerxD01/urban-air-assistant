/**
 * Vercel serverless entry: every /api/* request is routed here (see vercel.json).
 * Static files in /public are served directly by Vercel's CDN.
 * @module api/index
 */
import app from '../server.js';

export default app;
