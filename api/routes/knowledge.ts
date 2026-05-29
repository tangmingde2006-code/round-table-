import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import { PDFParse } from 'pdf-parse'
import { storePDF, searchKnowledge, getAllKnowledge, deleteKnowledge } from '../services/knowledge.js'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
})

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const entries = getAllKnowledge()
  res.json({ success: true, data: entries })
})

router.post('/upload', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  const file = req.file
  if (!file) {
    res.status(400).json({ success: false, error: '请上传PDF文件' })
    return
  }

  try {
    const parser = new PDFParse({ data: new Uint8Array(file.buffer) })
    const textResult = await parser.getText()
    const text = textResult.text
    const title = req.body.title || file.originalname.replace('.pdf', '')
    const category = req.body.category || '宗教知识'

    const id = storePDF(file.originalname, title, text, category)

    res.json({
      success: true,
      data: { id, title, category, pages: textResult.total, characters: text.length }
    })

    await parser.destroy()
  } catch (error: any) {
    console.error('[Knowledge] PDF parse error:', error.message)
    res.status(500).json({ success: false, error: 'PDF解析失败: ' + error.message })
  }
})

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params
  deleteKnowledge(id)
  res.json({ success: true })
})

router.get('/search', async (req: Request, res: Response): Promise<void> => {
  const q = req.query.q as string
  if (!q) {
    res.status(400).json({ success: false, error: '请提供搜索关键词' })
    return
  }

  const entries = searchKnowledge(q)
  const results = entries.map(entry => ({
    ...entry,
    content: entry.content.slice(0, 500)
  }))

  res.json({ success: true, data: results })
})

export default router
