import { Router, type Request, type Response } from 'express'
import { getDatabase, save } from '../db.js'

const router = Router()

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const db = getDatabase()

  const result = db.exec('SELECT key, value, updated_at FROM config')

  const config: Record<string, any> = {}
  const rows = result.length > 0 ? result[0].values : []
  rows.forEach((row) => {
    const key = row[0] as string
    let value: any = row[1]
    const updatedAt = row[2]

    if (key === 'enabled_agents' && typeof value === 'string') {
      try {
        value = JSON.parse(value)
      } catch {}
    }

    if (key === 'deepseek_api_key' && value) {
      const str = value as string
      value = str.slice(0, 4) + '****' + str.slice(-4)
    }

    if (key === 'tavily_api_key' && value) {
      const str = value as string
      value = str.slice(0, 4) + '****' + str.slice(-4)
    }

    config[key] = { value, updatedAt }
  })

  res.json({
    success: true,
    data: config,
  })
})

router.put('/', async (req: Request, res: Response): Promise<void> => {
  const db = getDatabase()
  const updates = req.body

  if (!updates || typeof updates !== 'object') {
    res.status(400).json({ success: false, error: 'Request body must be an object' })
    return
  }

  const allowedKeys = ['deepseek_model', 'enabled_agents', 'depth', 'deepseek_api_key', 'tavily_api_key']
  const keys = Object.keys(updates).filter((k) => allowedKeys.includes(k))

  if (keys.length === 0) {
    res.status(400).json({ success: false, error: 'No valid config keys provided' })
    return
  }

  for (const key of keys) {
    let value = updates[key]

    if (key === 'deepseek_api_key') {
      if (!value || typeof value !== 'string' || value.includes('****')) {
        continue
      }
    }

    if (key === 'tavily_api_key') {
      if (!value || typeof value !== 'string' || value.includes('****')) {
        continue
      }
    }

    if (key === 'enabled_agents' && Array.isArray(value)) {
      value = JSON.stringify(value)
    }
    if (typeof value !== 'string') {
      value = String(value)
    }
    db.run(
      `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
      [key, value],
    )
  }

  save()

  const result = db.exec('SELECT key, value, updated_at FROM config')
  const config: Record<string, any> = {}
  const rows = result.length > 0 ? result[0].values : []
  rows.forEach((row) => {
    const key = row[0] as string
    let value: any = row[1]
    const updatedAt = row[2]

    if (key === 'enabled_agents' && typeof value === 'string') {
      try {
        value = JSON.parse(value)
      } catch {}
    }

    if (key === 'deepseek_api_key' && value) {
      const str = value as string
      value = str.slice(0, 4) + '****' + str.slice(-4)
    }

    if (key === 'tavily_api_key' && value) {
      const str = value as string
      value = str.slice(0, 4) + '****' + str.slice(-4)
    }

    config[key] = { value, updatedAt }
  })

  res.json({
    success: true,
    data: config,
  })
})

export default router
