// Quick script to check user violations in database
import Database from 'better-sqlite3';

const db = new Database('./database.db');

// Get all users with their block status
console.log('\n=== USERS ===');
const users = db.prepare(`
  SELECT id, name, email, banned, blockedForCommands, prohibitedCommandCount, blockedAt
  FROM user
  ORDER BY prohibitedCommandCount DESC
`).all();

console.table(users);

// Get recent blocked commands
console.log('\n=== RECENT BLOCKED COMMANDS ===');
const blockedCommands = db.prepare(`
  SELECT
    cl.userId,
    u.name,
    cl.command,
    cl.blocked,
    cl.executedAt,
    datetime(cl.executedAt / 1000, 'unixepoch') as executed_time
  FROM command_logs cl
  LEFT JOIN user u ON cl.userId = u.id
  WHERE cl.blocked = 1
  ORDER BY cl.executedAt DESC
  LIMIT 20
`).all();

console.table(blockedCommands);

// Count violations per user
console.log('\n=== VIOLATION COUNTS (last 24 hours) ===');
const windowStart = Date.now() - (24 * 60 * 60 * 1000);
const violations = db.prepare(`
  SELECT
    userId,
    u.name,
    u.email,
    COUNT(*) as violation_count,
    MAX(executedAt) as last_violation
  FROM command_logs cl
  LEFT JOIN user u ON cl.userId = u.id
  WHERE blocked = 1
    AND executedAt > ?
  GROUP BY userId
  ORDER BY violation_count DESC
`).all(windowStart);

console.table(violations);

db.close();
