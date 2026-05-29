import { getDatabase, save } from '../db.js'
import { v4 as uuidv4 } from 'uuid'

interface KnowledgeEntry {
  id: string
  filename: string
  title: string
  content: string
  category: string
  created_at: string
}

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS knowledge_base (
  id TEXT PRIMARY KEY,
  filename TEXT,
  title TEXT,
  content TEXT,
  category TEXT,
  created_at TEXT
)`

function ensureTable(): void {
  try {
    const db = getDatabase()
    db.run(CREATE_TABLE_SQL)
  } catch (e) {
    console.error('[Knowledge] Failed to ensure table:', (e as Error).message)
  }
}

export function storePDF(filename: string, title: string, content: string, category: string): string {
  ensureTable()
  const db = getDatabase()
  const id = uuidv4()
  db.run(
    'INSERT INTO knowledge_base (id, filename, title, content, category, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))',
    [id, filename, title, content, category]
  )
  save()
  return id
}

export function searchKnowledge(query: string, limit = 5): KnowledgeEntry[] {
  ensureTable()
  const db = getDatabase()
  const keywords = query.split(/\s+/).filter(k => k.length > 1)
  if (keywords.length === 0) return []

  const conditions = keywords.map(() => 'content LIKE ? OR title LIKE ?').join(' OR ')
  const params = keywords.flatMap(k => [`%${k}%`, `%${k}%`])
  params.push(String(limit))

  const result = db.exec(
    `SELECT id, filename, title, content, category, created_at FROM knowledge_base WHERE ${conditions} ORDER BY created_at DESC LIMIT ?`,
    params
  )

  if (result.length === 0 || result[0].values.length === 0) return []

  return result[0].values.map(row => ({
    id: row[0] as string,
    filename: row[1] as string,
    title: row[2] as string,
    content: row[3] as string,
    category: row[4] as string,
    created_at: row[5] as string,
  }))
}

export function getAllKnowledge(): Array<{id: string, filename: string, title: string, category: string, content_length: number, created_at: string}> {
  ensureTable()
  const db = getDatabase()
  const result = db.exec('SELECT id, filename, title, category, length(content) as content_length, created_at FROM knowledge_base ORDER BY created_at DESC')
  if (result.length === 0 || result[0].values.length === 0) return []

  return result[0].values.map(row => ({
    id: row[0] as string,
    filename: row[1] as string,
    title: row[2] as string,
    category: row[3] as string,
    content_length: row[4] as number,
    created_at: row[5] as string,
  }))
}

export function deleteKnowledge(id: string): void {
  ensureTable()
  const db = getDatabase()
  db.run('DELETE FROM knowledge_base WHERE id = ?', [id])
  save()
}

export function formatKnowledgeForPrompt(query: string, limit = 3): string {
  try {
    const entries = searchKnowledge(query, limit)
    if (entries.length === 0) return ''

    let formatted = '【知识库参考材料】\n'
    for (const entry of entries) {
      formatted += `\n来源: ${entry.title} (${entry.category})\n${entry.content.slice(0, 1500)}\n`
    }
    return formatted
  } catch (e) {
    console.warn('[Knowledge] formatKnowledgeForPrompt failed:', (e as Error).message)
    return ''
  }
}
