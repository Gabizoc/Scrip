// backend/src/server.js
import 'dotenv/config';
import { createApp } from './app.js';
import { initDb } from './db.js';

const PORT = process.env.PORT ?? 3001;

await initDb();
const app = createApp();
app.listen(PORT, () => {
  console.log(`[scrip-backend] http://localhost:${PORT}`);
});
