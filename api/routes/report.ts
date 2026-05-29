import { Router, type Request, type Response } from 'express'
import { getDatabase } from '../db.js'

const router = Router()

router.get('/:taskId', async (req: Request, res: Response): Promise<void> => {
  const { taskId } = req.params
  const db = getDatabase()

  const taskResult = db.exec('SELECT * FROM analysis_tasks WHERE id = ?', [taskId])
  if (taskResult.length === 0 || taskResult[0].values.length === 0) {
    res.status(404).json({ success: false, error: 'Task not found' })
    return
  }

  const taskColumns = taskResult[0].columns
  const taskRow = taskResult[0].values[0]
  const task: Record<string, any> = {}
  taskColumns.forEach((col, i) => {
    task[col] = taskRow[i]
  })

  if (task.options) {
    try {
      task.options = JSON.parse(task.options as string)
    } catch {}
  }

  const agentResult = db.exec('SELECT * FROM agent_results WHERE task_id = ?', [taskId])
  const agentColumns = agentResult.length > 0 ? agentResult[0].columns : []
  const agents = (agentResult.length > 0 ? agentResult[0].values : []).map((row) => {
    const obj: Record<string, any> = {}
    agentColumns.forEach((col, i) => {
      obj[col] = row[i]
    })
    if (obj.parsed_output) {
      try {
        obj.parsed_output = JSON.parse(obj.parsed_output as string)
      } catch {}
    }
    return obj
  })

  const arbResult = db.exec('SELECT * FROM arbitration_results WHERE task_id = ?', [taskId])
  const arbColumns = arbResult.length > 0 ? arbResult[0].columns : []
  let arbitration: Record<string, any> | null = null
  if (arbResult.length > 0 && arbResult[0].values.length > 0) {
    arbitration = {}
    arbColumns.forEach((col, i) => {
      arbitration![col] = arbResult[0].values[0][i]
    })
    if (arbitration.consensus) {
      try {
        arbitration.consensus = JSON.parse(arbitration.consensus as string)
      } catch {}
    }
    if (arbitration.dissents) {
      try {
        arbitration.dissents = JSON.parse(arbitration.dissents as string)
      } catch {}
    }
    if (arbitration.full_output) {
      try {
        arbitration.full_output = JSON.parse(arbitration.full_output as string)
      } catch {}
    }
  }

  res.json({
    success: true,
    data: {
      task,
      agents,
      arbitration,
    },
  })
})

export default router
