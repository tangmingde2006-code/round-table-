import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase, save } from '../db.js'
import { runAnalysis, type SSEEvent } from '../services/orchestrator.js'

const router = Router()

const runningTasks = new Set<string>()

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { content, url, options } = req.body

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    res.status(400).json({ success: false, error: 'content is required' })
    return
  }

  const taskId = uuidv4()
  const db = getDatabase()

  db.run(
    `INSERT INTO analysis_tasks (id, content, url, status, options) VALUES (?, ?, ?, 'analyzing', ?)`,
    [taskId, content.trim(), url || null, options ? JSON.stringify(options) : null],
  )
  save()

  res.status(201).json({
    success: true,
    data: { taskId },
  })
})

router.get('/:taskId/stream', async (req: Request, res: Response): Promise<void> => {
  const { taskId } = req.params
  const db = getDatabase()

  const taskResult = db.exec('SELECT id, status, content FROM analysis_tasks WHERE id = ?', [taskId])
  if (taskResult.length === 0 || taskResult[0].values.length === 0) {
    res.status(404).json({ success: false, error: 'Task not found' })
    return
  }

  const status = taskResult[0].values[0][1] as string
  const content = taskResult[0].values[0][2] as string

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const sendSSE = (event: SSEEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`)
    if (typeof (res as any).flush === 'function') {
      (res as any).flush()
    }
  }

  if (status === 'completed') {
    const agentResults = db.exec('SELECT agent_id, agent_name, parsed_output, duration_ms FROM agent_results WHERE task_id = ?', [taskId])
    const arbResult = db.exec('SELECT full_output FROM arbitration_results WHERE task_id = ?', [taskId])

    for (const row of (agentResults.length > 0 ? agentResults[0].values : [])) {
      sendSSE({
        type: 'agent_complete',
        agentId: row[0] as string,
        agentName: row[1] as string,
        result: (() => { try { return JSON.parse(row[2] as string) } catch { return row[2] } })(),
        durationMs: row[3] as number,
      })
    }

    if (arbResult.length > 0 && arbResult[0].values.length > 0) {
      sendSSE({
        type: 'arbitration_complete',
        agentId: 'arbitrator',
        agentName: '综合仲裁官',
        result: (() => { try { return JSON.parse(arbResult[0].values[0][0] as string) } catch { return arbResult[0].values[0][0] } })(),
      })
    }

    sendSSE({ type: 'complete' })
    res.end()
    return
  }

  if (status === 'failed') {
    sendSSE({
      type: 'error',
      content: 'Task previously failed',
    })
    res.end()
    return
  }

  try {
    if (runningTasks.has(taskId)) {
      sendSSE({
        type: 'error',
        content: '该任务正在分析中，请勿重复连接。刷新页面后将自动接收进度。',
      })
      res.end()
      return
    }

    runningTasks.add(taskId)
    let clientDisconnected = false
    req.on('close', () => {
      clientDisconnected = true
      console.log(`[Analyze] Client disconnected for task ${taskId}`)
    })

    const guardedSendSSE = (event: SSEEvent) => {
      if (clientDisconnected) return
      sendSSE(event)
    }

    await runAnalysis(taskId, content, guardedSendSSE)
    if (!clientDisconnected) {
      sendSSE({ type: 'complete' })
    }
  } catch (error: any) {
    try {
      sendSSE({
        type: 'error',
        content: error.message || 'Analysis failed',
      })
    } catch {}
  } finally {
    runningTasks.delete(taskId)
  }

  res.end()
})

export default router
