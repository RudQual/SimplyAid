/**
 * Development helper: starts a throwaway MongoDB server in memory.
 * Useful when MongoDB is not installed locally.
 *
 *   npm run dev:mongo            # listens on 27017
 *   DEV_MONGO_PORT=27018 npm run dev:mongo
 *
 * Data is lost when the process exits — never use this in production.
 */
const path = require('path');

// Reuse the binary cached under server/node_modules regardless of the working
// directory the script is launched from (otherwise it re-downloads ~600 MB).
if (!process.env.MONGOMS_DOWNLOAD_DIR) {
  process.env.MONGOMS_DOWNLOAD_DIR = path.join(__dirname, '..', 'node_modules', '.cache', 'mongodb-memory-server');
}

const { MongoMemoryServer } = require('mongodb-memory-server');

(async () => {
  const port = Number(process.env.DEV_MONGO_PORT) || 27017;
  const server = await MongoMemoryServer.create({ instance: { port, dbName: 'simplyaid' } });
  console.log(`In-memory MongoDB running at ${server.getUri()}simplyaid`);
  const stop = async () => { await server.stop(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
})().catch((err) => {
  console.error('Failed to start in-memory MongoDB:', err.message);
  process.exit(1);
});
