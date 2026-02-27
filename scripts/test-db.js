// Quick DB test — runs via electron to verify better-sqlite3 works
// Usage: npm run test-db  (add to package.json if needed)
// Or: node scripts/launch.js -- scripts/test-db.js (not used this way)
// Actually just run test inside main process. This file is unused for now.
// The DB init happens automatically in main.js when the app starts.
console.log('DB test: run the full app with npm start and check console for [KnowledgeDB] errors.');
