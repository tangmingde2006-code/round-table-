import { Router, type Request, type Response } from 'express'
import { getDatabase, save } from '../db.js'
import { agents, getAllAgents } from '../services/agents.js'
import { chatCompletion } from '../services/deepseek.js'

const router = Router()

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase()
    const allAgents = getAllAgents()

    const customPromptResult = db.exec("SELECT key, value FROM config WHERE key LIKE 'prompt_%'")
    const customPrompts: Record<string, string> = {}
    if (customPromptResult.length > 0 && customPromptResult[0].values.length > 0) {
      for (const row of customPromptResult[0].values) {
        const key = row[0] as string
        const value = row[1] as string
        const agentId = key.replace('prompt_', '')
        customPrompts[agentId] = value
      }
    }

    const globalCriteriaResult = db.exec("SELECT value FROM config WHERE key = 'global_criteria'")
    let globalCriteria = ''
    if (globalCriteriaResult.length > 0 && globalCriteriaResult[0].values.length > 0 && globalCriteriaResult[0].values[0][0]) {
      globalCriteria = globalCriteriaResult[0].values[0][0] as string
    }

    const agentPrompts = allAgents.map((agent) => {
      const customPrompt = customPrompts[agent.id] || null
      return {
        agentId: agent.id,
        agentName: agent.nameZh,
        icon: agent.icon,
        color: agent.color,
        defaultPrompt: agent.systemPrompt,
        customPrompt,
        activePrompt: customPrompt || agent.systemPrompt,
      }
    })

    res.json({
      success: true,
      data: {
        agents: agentPrompts,
        global_criteria: globalCriteria,
      },
    })
  } catch (error: any) {
    console.error('[Prompts] GET / failed:', error.message)
    res.status(500).json({ success: false, error: error.message || '获取提示词失败' })
  }
})

router.put('/global-criteria', async (req: Request, res: Response): Promise<void> => {
  try {
    const { criteria } = req.body

    if (typeof criteria !== 'string') {
      res.status(400).json({ success: false, error: 'criteria 必须为字符串' })
      return
    }

    const db = getDatabase()

    db.run(
      `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
      ['global_criteria', criteria],
    )
    save()

    res.json({
      success: true,
      data: {
        global_criteria: criteria,
      },
    })
  } catch (error: any) {
    console.error('[Prompts] PUT /global-criteria failed:', error.message)
    res.status(500).json({ success: false, error: error.message || '更新全局标准失败' })
  }
})

router.put('/:agentId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { agentId } = req.params
    const { customPrompt } = req.body

    if (typeof customPrompt !== 'string') {
      res.status(400).json({ success: false, error: 'customPrompt 必须为字符串' })
      return
    }

    const db = getDatabase()

    if (customPrompt === '') {
      db.run('DELETE FROM config WHERE key = ?', [`prompt_${agentId}`])
    } else {
      db.run(
        `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
        [`prompt_${agentId}`, customPrompt],
      )
    }

    save()

    res.json({
      success: true,
      data: {
        agentId,
        customPrompt: customPrompt || null,
      },
    })
  } catch (error: any) {
    console.error('[Prompts] PUT /:agentId failed:', error.message)
    res.status(500).json({ success: false, error: error.message || '更新提示词失败' })
  }
})

router.delete('/:agentId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { agentId } = req.params
    const db = getDatabase()

    db.run('DELETE FROM config WHERE key = ?', [`prompt_${agentId}`])
    save()

    res.json({
      success: true,
      data: {
        agentId,
        message: '已恢复默认提示词',
      },
    })
  } catch (error: any) {
    console.error('[Prompts] DELETE /:agentId failed:', error.message)
    res.status(500).json({ success: false, error: error.message || '重置提示词失败' })
  }
})

router.post('/adjust', async (req: Request, res: Response): Promise<void> => {
  try {
    const { agentId, instruction } = req.body

    if (!instruction || typeof instruction !== 'string') {
      res.status(400).json({ success: false, error: 'instruction 必须为非空字符串' })
      return
    }

    const db = getDatabase()
    const allAgents = getAllAgents()

    if (agentId) {
      const agent = allAgents.find((a) => a.id === agentId)
      if (!agent) {
        res.status(404).json({ success: false, error: '未找到该角色' })
        return
      }

      const customPromptResult = db.exec('SELECT value FROM config WHERE key = ?', [`prompt_${agentId}`])
      let currentPrompt = agent.systemPrompt
      if (customPromptResult.length > 0 && customPromptResult[0].values.length > 0 && customPromptResult[0].values[0][0]) {
        currentPrompt = customPromptResult[0].values[0][0] as string
      }

      const deepseekPrompt = `你是一个提示词工程专家。请根据用户的调整指令，修改以下AI角色的系统提示词。

用户调整指令：${instruction}

当前提示词：
${currentPrompt}

请直接输出修改后的完整提示词（不要输出解释或说明，只输出提示词本身）。`

      const adjustedPrompt = await chatCompletion([
        { role: 'system', content: deepseekPrompt },
        { role: 'user', content: instruction },
      ])

      db.run(
        `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
        [`prompt_${agentId}`, adjustedPrompt],
      )
      save()

      res.json({
        success: true,
        data: {
          agentId,
          customPrompt: adjustedPrompt,
        },
      })
    } else {
      const results: Array<{ agentId: string; agentName: string; customPrompt: string }> = []

      for (const agent of allAgents) {
        const customPromptResult = db.exec('SELECT value FROM config WHERE key = ?', [`prompt_${agent.id}`])
        let currentPrompt = agent.systemPrompt
        if (customPromptResult.length > 0 && customPromptResult[0].values.length > 0 && customPromptResult[0].values[0][0]) {
          currentPrompt = customPromptResult[0].values[0][0] as string
        }

        const deepseekPrompt = `你是一个提示词工程专家。请根据用户的调整指令，修改以下AI角色的系统提示词。

用户调整指令：${instruction}

当前提示词：
${currentPrompt}

请直接输出修改后的完整提示词（不要输出解释或说明，只输出提示词本身）。`

        const adjustedPrompt = await chatCompletion([
          { role: 'system', content: deepseekPrompt },
          { role: 'user', content: instruction },
        ])

        db.run(
          `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
          [`prompt_${agent.id}`, adjustedPrompt],
        )

        results.push({
          agentId: agent.id,
          agentName: agent.nameZh,
          customPrompt: adjustedPrompt,
        })
      }

      save()

      res.json({
        success: true,
        data: results,
      })
    }
  } catch (error: any) {
    console.error('[Prompts] POST /adjust failed:', error.message)
    res.status(500).json({ success: false, error: error.message || '调整提示词失败' })
  }
})

router.post('/adjust-global', async (req: Request, res: Response): Promise<void> => {
  try {
    const { instruction } = req.body

    if (!instruction || typeof instruction !== 'string') {
      res.status(400).json({ success: false, error: 'instruction 必须为非空字符串' })
      return
    }

    const db = getDatabase()

    const globalCriteriaResult = db.exec("SELECT value FROM config WHERE key = 'global_criteria'")
    let currentCriteria = '暂无'
    if (globalCriteriaResult.length > 0 && globalCriteriaResult[0].values.length > 0 && globalCriteriaResult[0].values[0][0]) {
      currentCriteria = globalCriteriaResult[0].values[0][0] as string
    }

    const deepseekPrompt = `你是一个宗教智库新闻筛选系统的提示词工程专家。用户希望调整系统的全局评估标准。

用户调整指令：${instruction}

当前全局标准：
${currentCriteria}

请直接输出修改后的全局评估标准（一段自然语言描述，会被追加到所有角色的系统提示词中）。不要输出解释，只输出标准内容。`

    const adjustedCriteria = await chatCompletion([
      { role: 'system', content: deepseekPrompt },
      { role: 'user', content: instruction },
    ])

    db.run(
      `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
      ['global_criteria', adjustedCriteria],
    )
    save()

    res.json({
      success: true,
      data: {
        global_criteria: adjustedCriteria,
      },
    })
  } catch (error: any) {
    console.error('[Prompts] POST /adjust-global failed:', error.message)
    res.status(500).json({ success: false, error: error.message || '调整全局标准失败' })
  }
})

export default router
