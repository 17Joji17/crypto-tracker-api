import { createDatabase } from './db/database';
import { createApp } from './app';

const port = Number(process.env.PORT ?? 3000);
const dbPath = process.env.DB_PATH ?? './data/app.sqlite';

const db = createDatabase(dbPath);
const app = createApp(db);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});