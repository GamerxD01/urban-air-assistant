import { createApp } from './src/app.js';
import { createAssistant } from './src/services/llm.js';

const port = Number(process.env.PORT) || 3000;
const assistant = createAssistant({
  apiKey: process.env.GEMINI_API_KEY ?? '',
  model: process.env.GEMINI_MODEL || undefined,
});

const server = createApp({ assistant }).listen(port, () => {
  console.log(`Urban Air Quality Assistant on http://localhost:${port} (GenAI: ${assistant.enabled ? 'Gemini' : 'rule-based fallback'})`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
