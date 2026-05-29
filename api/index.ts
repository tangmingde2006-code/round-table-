import type { VercelRequest, VercelResponse } from '@vercel/node'
import app, { initDatabase } from './app.js'

let dbInitialized = false

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!dbInitialized) {
    await initDatabase()
    dbInitialized = true
  }
  return app(req, res)
}
