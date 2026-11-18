/**
 * Entry point for local and long-running hosting (Render, Cloud Run, Docker).
 * On Vercel the same app is exported and wrapped by api/index.js.
 * @module server
 */
import { createApp } from './src/createApp.js';
import { createAssistant } from './src/services/llm.js';

const assistant = createAssistant({
  apiKey: process.env.GEMINI_API_KEY ?? '',
  model: process.env.GEMINI_MODEL || undefined,
});

const app = createApp({ assistant });

// Serverless platforms (Vercel) import the app; locally and on Render we listen ourselves.
if (!process.env.VERCEL) {
  const port = Number(process.env.PORT) || 3000;
  const server = app.listen(port, () => {
    console.log(
      `Urban Air Quality Assistant on http://localhost:${port} (GenAI: ${assistant.enabled ? 'Gemini' : 'rule-based fallback'})`,
    );
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
}

export default app;
