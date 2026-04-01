/**
 * Simple retrieval test using the production database
 * Runs as plain Node.js (no Electron context needed)
 */

const sqlite3 = require('better-sqlite3');
const { join } = require('path');
const { homedir } = require('os');

const DB_PATH = join(homedir(), 'Library', 'Application Support', 'Lumina', 'lumina.db');

async function main() {
  console.log('🔍 Checking recent retrieval performance...\n');

  const db = sqlite3(DB_PATH, { readonly: true });

  // Get last 20 retrievals
  const recent = db.prepare(`
    SELECT
      datetime(created_at, 'localtime') as time,
      duration_ms,
      json_array_length(chunk_ids) as chunks
    FROM retrieval_logs
    ORDER BY created_at DESC
    LIMIT 20
  `).all();

  console.log('Last 20 retrievals:');
  console.log('─'.repeat(60));
  recent.forEach((r, i) => {
    const indicator = r.duration_ms < 250 ? '✓' : r.duration_ms < 500 ? '○' : '✗';
    console.log(`${indicator} ${r.time.padEnd(20)} ${String(r.duration_ms).padStart(5)}ms  (${r.chunks} chunks)`);
  });

  // Statistics
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      ROUND(AVG(duration_ms), 1) as avg_ms,
      MIN(duration_ms) as min_ms,
      MAX(duration_ms) as max_ms,
      ROUND(100.0 * SUM(CASE WHEN duration_ms < 250 THEN 1 ELSE 0 END) / COUNT(*), 1) as pct_under_250ms,
      ROUND(100.0 * SUM(CASE WHEN duration_ms < 500 THEN 1 ELSE 0 END) / COUNT(*), 1) as pct_under_500ms
    FROM retrieval_logs
  `).get();

  console.log('\n📊 Overall Statistics:');
  console.log('─'.repeat(60));
  console.log(`Total retrievals: ${stats.total}`);
  console.log(`Average: ${stats.avg_ms}ms`);
  console.log(`Range: ${stats.min_ms}ms - ${stats.max_ms}ms`);
  console.log(`Under 250ms: ${stats.pct_under_250ms}%`);
  console.log(`Under 500ms: ${stats.pct_under_500ms}%`);

  // Get today's stats if any
  const today = db.prepare(`
    SELECT
      COUNT(*) as count,
      ROUND(AVG(duration_ms), 1) as avg_ms,
      MIN(duration_ms) as min_ms
    FROM retrieval_logs
    WHERE DATE(created_at) = DATE('now')
  `).get();

  if (today.count > 0) {
    console.log('\n📅 Today\'s Performance:');
    console.log('─'.repeat(60));
    console.log(`Retrievals today: ${today.count}`);
    console.log(`Average: ${today.avg_ms}ms`);
    console.log(`Min: ${today.min_ms}ms`);

    if (today.avg_ms < 500) {
      console.log('\n✅ Performance looks good! (< 500ms average)');
    } else {
      console.log('\n⚠️  Performance above target (> 500ms average)');
    }
  } else {
    console.log('\n⚠️  No retrievals yet today. Run the app and use memory search.');
  }

  db.close();
}

main().catch(console.error);
