import { Router, type Request, type Response } from 'express'
import { getDatabase } from '../db.js'

const router = Router()

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const db = getDatabase()

  const keyword = (req.query.keyword as string) || ''
  const riskLevel = (req.query.riskLevel as string) || ''
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))
  const offset = (page - 1) * pageSize

  let whereClauses: string[] = []
  let params: any[] = []

  if (keyword) {
    whereClauses.push("t.content LIKE ?")
    params.push(`%${keyword}%`)
  }

  if (riskLevel) {
    whereClauses.push("arb.risk_level = ?")
    params.push(riskLevel)
  }

  const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

  const countResult = db.exec(
    `SELECT COUNT(DISTINCT t.id) as total
     FROM analysis_tasks t
     LEFT JOIN arbitration_results arb ON t.id = arb.task_id
     ${whereStr}`,
    params,
  )

  const total = countResult.length > 0 ? (countResult[0].values[0][0] as number) : 0

  const queryResult = db.exec(
    `SELECT t.id, t.content, t.url, t.status, t.created_at, t.completed_at,
            arb.final_score, arb.risk_level, arb.priority, arb.summary, arb.recommendation
     FROM analysis_tasks t
     LEFT JOIN arbitration_results arb ON t.id = arb.task_id
     ${whereStr}
     ORDER BY t.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  )

  const columns = queryResult.length > 0 ? queryResult[0].columns : []
  const rows = queryResult.length > 0 ? queryResult[0].values : []

  const items = rows.map((row) => {
    const obj: Record<string, any> = {}
    columns.forEach((col, i) => {
      obj[col] = row[i]
    })
    return obj
  })

  res.json({
    success: true,
    data: {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    },
  })
})

export default router
