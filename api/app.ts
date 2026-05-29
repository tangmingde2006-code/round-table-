import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { initDatabase } from './db.js'
import analyzeRoutes from './routes/analyze.js'
import reportRoutes from './routes/report.js'
import historyRoutes from './routes/history.js'
import configRoutes from './routes/config.js'
import exportRoutes from './routes/export.js'
import promptsRoutes from './routes/prompts.js'
import knowledgeRoutes from './routes/knowledge.js'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

app.use('/api/analyze', analyzeRoutes)
app.use('/api/report', reportRoutes)
app.use('/api/history', historyRoutes)
app.use('/api/config', configRoutes)
app.use('/api/export', exportRoutes)
app.use('/api/prompts', promptsRoutes)
app.use('/api/knowledge', knowledgeRoutes)

app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))

app.get('*', (req: Request, res: Response, next: NextFunction): void => {
  if (req.path.startsWith('/api')) {
    next()
    return
  }
  res.sendFile(path.join(distPath, 'index.html'))
})

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', error)
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export { initDatabase }

export default app
