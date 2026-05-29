import initSqlJs, { type Database } from 'sql.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const IS_VERCEL = process.env.VERCEL === '1'

function getDbPath(): string {
  if (IS_VERCEL) {
    return '/tmp/roundtable.db'
  }
  return path.join(__dirname, 'data', 'roundtable.db')
}

let db: Database

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS analysis_tasks (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    url TEXT,
    status TEXT NOT NULL DEFAULT 'analyzing',
    options TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS agent_results (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    raw_output TEXT,
    parsed_output TEXT,
    duration_ms INTEGER,
    completed_at TEXT,
    UNIQUE(task_id, agent_id)
  )`,
  `CREATE TABLE IF NOT EXISTS arbitration_results (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    final_score INTEGER,
    risk_level TEXT,
    priority TEXT,
    summary TEXT,
    decision_reason TEXT,
    recommendation TEXT,
    consensus TEXT,
    dissents TEXT,
    full_output TEXT,
    completed_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS knowledge_base (
    id TEXT PRIMARY KEY,
    filename TEXT,
    title TEXT,
    content TEXT,
    category TEXT,
    created_at TEXT
  )`,
]

const SEED_STATEMENTS = [
  `INSERT OR IGNORE INTO config (key, value) VALUES ('deepseek_model', 'deepseek-chat')`,
  `INSERT OR IGNORE INTO config (key, value) VALUES ('enabled_agents', '["fact_checker","stance_analyst","ethics_evaluator","intent_analyst","sentiment_analyst","sensitivity_reviewer"]')`,
  `INSERT OR IGNORE INTO config (key, value) VALUES ('depth', 'standard')`,
]

export async function initDatabase(): Promise<Database> {
  const SQL = await initSqlJs()

  const dbPath = getDbPath()
  const dataDir = path.dirname(dbPath)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  for (const stmt of SCHEMA_STATEMENTS) {
    db.run(stmt)
  }
  for (const stmt of SEED_STATEMENTS) {
    db.run(stmt)
  }
  save()

  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'")
  const tableNames = tables.length > 0 ? tables[0].values.map(v => v[0]) : []
  console.log(`[DB] Initialized at ${dbPath} (Vercel: ${IS_VERCEL})`)
  console.log(`[DB] Tables: ${tableNames.join(', ')}`)

  return db
}

export function getDatabase(): Database {
  return db
}

export function save(): void {
  if (!db) return
  const data = db.export()
  const buffer = Buffer.from(data)
  const dbPath = getDbPath()
  fs.writeFileSync(dbPath, buffer)
}
