import { v4 as uuidv4 } from 'uuid'
import { getDatabase, save } from '../db.js'
import { chatCompletion, chatCompletionStream } from './deepseek.js'
import { searchAndFormat } from './search.js'
import { getAllAgents, getAgentById, type AgentDefinition } from './agents.js'
import { formatKnowledgeForPrompt } from './knowledge.js'

export type SSEEvent = {
  type: 'phase_start' | 'agent_start' | 'agent_chunk' | 'agent_message' | 'agent_complete' | 'phase_complete' | 'arbitration_start' | 'arbitration_complete' | 'complete' | 'error' | 'question_extracted'
  phase?: 'questioning' | 'question_eval' | 'answering' | 'arbitration'
  agentId?: string
  agentName?: string
  content?: string
  targetAgentId?: string
  targetAgentName?: string
  result?: any
  progress?: number
  durationMs?: number
  chunk?: string
}

type OnEventCallback = (event: SSEEvent) => void

const ROUNDTABLE_RULES = `## 圆桌会议总规则（必须严格遵守）

1. **必须分四个阶段进行**：
   - **阶段一：互相提问**（每位角色向1位其他角色提出1个关键问题）
   - **阶段二：问题筛选**（仲裁官评估哪些问题是必须回答的，筛选掉冗余问题）
   - **阶段三：回答与辩论**（每位角色回答被筛选保留的问题，可补充观点或反驳）
   - **阶段四：仲裁与决策**（综合仲裁官汇总所有观点，给出最终入库建议）

2. **提问要求**：
   - 每位角色只需向1位其他角色提出1个最关键的问题
   - 问题必须与新闻相关，且针对对方专业领域
   - 禁止"是/否"类简单问题；应提出"如何…？""为什么…？""依据什么…？"等开放性问题
   - 每个问题后用"[等待回答]"标记

3. **回答要求**：
   - 须先引用对方的问题原文，再给出基于自身专业视角的答案
   - 可主动补充未被问到的观点
   - 可礼貌质疑或补充其他角色的答案

4. **防幻觉与事实优先**：
   - 引用事实、数据、日期、地点时必须加上来源说明
   - 无法验证的信息必须标注"【待验证】"
   - 禁止编造任何不存在的研究、事件或言论`

function buildPhase1Prompt(agent: AgentDefinition, allAgents: AgentDefinition[]): string {
  const otherAgents = allAgents.filter((a) => a.id !== agent.id)
  const agentList = otherAgents.map((a) => `- ${a.nameZh}：${a.questionHint}`).join('\n')

  return `现在是**阶段一：互相提问**。

你是【${agent.nameZh}】，请从以下角色中选择1位，提出1个你认为最关键的问题。

可提问的其他角色：
${agentList}

你的提问方向提示：${agent.questionHint}

请严格按以下格式输出：
向【角色名】提问：你的问题内容 [等待回答]

（可选）你还可以补充一段你对新闻的初步观察（不超过2句话）。`
}

function buildQuestionEvalPrompt(allQuestions: string): string {
  return `现在是**阶段二：问题筛选**。

你是【综合仲裁官】，以下是阶段一中各位角色提出的问题。请评估每个问题的必要性，筛选出必须回答的关键问题。

评估标准：
1. 该问题是否直接关系到新闻的真实性判断？
2. 该问题是否涉及宗教敏感度或伦理风险的核心？
3. 该问题是否能引出其他问题无法替代的独特视角？
4. 去掉重复或相似的问题

以下是所有提出的问题：
---
${allQuestions}
---

请按以下格式输出评估结果：

✅ 必须回答的问题：
- 【提问者→被提问者】问题内容 | 理由：...

⏭️ 可跳过的问题：
- 【提问者→被提问者】问题内容 | 理由：...

最终保留的问题数量建议不超过${Math.min(7, Math.ceil(allQuestions.split('\n').filter(l => l.trim()).length * 0.6))}个。`
}

function buildPhase3Prompt(agent: AgentDefinition, questionsToThisAgent: Array<{from: string, fromId: string, question: string}>, allMessages: string): string {
  const questionsText = questionsToThisAgent.length > 0
    ? questionsToThisAgent.map((q) => `【${q.from}】向你提问：${q.question}`).join('\n\n')
    : '没有必须回答的问题分配给你。请主动发表你的专业分析观点。'

  return `现在是**阶段三：回答与辩论**。

你是【${agent.nameZh}】，以下是经过仲裁官筛选后分配给你的必须回答的问题：

${questionsText}

请按以下格式回答：
1. 先引用对方的问题原文
2. 给出基于你专业视角的答案
3. 回答完后，可自愿补充一句评论或反驳其他角色的观点

以下是此前所有讨论的记录，供你参考：
---
${allMessages}
---`
}

function buildPhase4Prompt(allMessages: string): string {
  return `现在是**阶段四：仲裁与决策**。

你是【综合仲裁官】，请汇总前面所有讨论中的观点，识别共识点和关键分歧，然后给出最终入库建议。

以下是完整的讨论记录：
---
${allMessages}
---

请严格按照以下JSON格式输出最终决策（不要输出其他内容）：
{
  "final_score": 0-100,
  "risk_level": "低/中/高/极高",
  "priority": "紧急/高/中/低/待观察/拒绝入库",
  "core_findings": {
    "consensus": ["共识点1", "共识点2"],
    "dissents": ["分歧点1及其不同观点"]
  },
  "summary": "新闻摘要（1-3句）",
  "decision_reason": "入库/排除原因",
  "recommendation": "入库/补充核查/修正后入库/排除"
}`
}

function extractQuestions(text: string): Array<{targetName: string, question: string}> {
  const questions: Array<{targetName: string, question: string}> = []
  const patterns = [
    /向【(.+?)】提问[：:]\s*(.+?)(?:\s*\[等待回答\])/g,
    /向(.+?)提问[：:]\s*(.+?)(?:\s*\[等待回答\])/g,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      questions.push({
        targetName: match[1].trim(),
        question: match[2].trim(),
      })
    }
  }

  return questions
}

function extractEvaluatedQuestions(text: string): string[] {
  const kept: string[] = []
  const lines = text.split('\n')
  let inKeptSection = false

  for (const line of lines) {
    if (line.includes('✅') || line.includes('必须回答')) {
      inKeptSection = true
      continue
    }
    if (line.includes('⏭️') || line.includes('可跳过')) {
      inKeptSection = false
      continue
    }
    if (inKeptSection && line.trim().startsWith('-')) {
      kept.push(line.trim().substring(1).trim())
    }
  }

  return kept
}

async function callAgent(
  agent: AgentDefinition,
  userMessage: string,
  onEvent: OnEventCallback,
  jsonMode = false,
): Promise<string> {
  onEvent({
    type: 'agent_start',
    agentId: agent.id,
    agentName: agent.nameZh,
  })

  const startTime = Date.now()

  try {
    const db = getDatabase()
    let systemPrompt = agent.systemPrompt

    const customPromptResult = db.exec("SELECT value FROM config WHERE key = ?", [`prompt_${agent.id}`])
    if (customPromptResult.length > 0 && customPromptResult[0].values.length > 0 && customPromptResult[0].values[0][0]) {
      systemPrompt = customPromptResult[0].values[0][0] as string
    }

    const globalCriteriaResult = db.exec("SELECT value FROM config WHERE key = 'global_criteria'")
    if (globalCriteriaResult.length > 0 && globalCriteriaResult[0].values.length > 0 && globalCriteriaResult[0].values[0][0]) {
      systemPrompt += `\n\n【全局评估标准】\n${globalCriteriaResult[0].values[0][0] as string}`
    }

    console.log(`[Orchestrator] Calling agent (streaming): ${agent.nameZh} (${agent.id})`)

    let searchContext = ''
    const needsSearch = ['fact_checker', 'sentiment_analyst'].includes(agent.id)
    if (needsSearch && userMessage.length > 50) {
      const newsSnippet = userMessage.slice(0, 200)
      const searchQuery = agent.id === 'fact_checker'
        ? `事实核查: ${newsSnippet}`
        : `舆情分析: ${newsSnippet}`
      searchContext = await searchAndFormat(searchQuery, 3)
    }

    let knowledgeContext = ''
    if (userMessage.length > 50) {
      try {
        knowledgeContext = formatKnowledgeForPrompt(userMessage.slice(0, 200), 2)
      } catch (e) {
        console.warn(`[Orchestrator] Knowledge base lookup failed, continuing without it:`, (e as Error).message)
      }
    }

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...(searchContext ? [{ role: 'system' as const, content: searchContext }] : []),
      ...(knowledgeContext ? [{ role: 'system' as const, content: knowledgeContext }] : []),
      { role: 'user' as const, content: userMessage },
    ]

    let fullContent = ''

    if (jsonMode) {
      fullContent = await chatCompletion(messages, true)
    } else {
      for await (const chunk of chatCompletionStream(messages)) {
        fullContent += chunk
        onEvent({
          type: 'agent_chunk',
          agentId: agent.id,
          agentName: agent.nameZh,
          chunk,
        })
      }
    }

    const durationMs = Date.now() - startTime
    console.log(`[Orchestrator] Agent ${agent.nameZh} completed in ${durationMs}ms`)

    onEvent({
      type: 'agent_message',
      agentId: agent.id,
      agentName: agent.nameZh,
      content: fullContent,
      durationMs,
    })

    return fullContent
  } catch (error: any) {
    console.error(`[Orchestrator] Agent ${agent.nameZh} failed: ${error.message}`)
    onEvent({
      type: 'error',
      agentId: agent.id,
      agentName: agent.nameZh,
      content: error.message || 'Agent execution failed',
    })
    throw error
  }
}

export async function runAnalysis(taskId: string, content: string, onEvent: OnEventCallback): Promise<void> {
  const db = getDatabase()
  const allAgents = getAllAgents()

  let aborted = false
  const guardedOnEvent: OnEventCallback = (event) => {
    if (aborted) return
    onEvent(event)
  }

  const enabledAgentsResult = db.exec("SELECT value FROM config WHERE key = 'enabled_agents'")
  let enabledAgentIds: string[] | null = null
  if (enabledAgentsResult.length > 0 && enabledAgentsResult[0].values.length > 0) {
    try {
      enabledAgentIds = JSON.parse(enabledAgentsResult[0].values[0][0] as string)
    } catch {}
  }

  const activeAgents = enabledAgentIds
    ? allAgents.filter((a) => enabledAgentIds!.includes(a.id) || a.id === 'arbitrator')
    : allAgents

  if (activeAgents.filter((a) => a.id !== 'arbitrator').length < 2) {
    guardedOnEvent({ type: 'error', content: '至少需要启用2个分析角色才能进行圆桌讨论' })
    db.run("UPDATE analysis_tasks SET status = 'failed', completed_at = datetime('now') WHERE id = ?", [taskId])
    save()
    return
  }

  const discussionLog: string[] = []
  const questionsMap: Map<string, Array<{from: string, fromId: string, question: string}>> = new Map()
  for (const agent of activeAgents) {
    questionsMap.set(agent.id, [])
  }

  // ========== Phase 1: Questioning (1 question each) ==========
  guardedOnEvent({
    type: 'phase_start',
    phase: 'questioning',
    content: '圆桌会议启动，进入阶段一：互相提问',
    progress: 0,
  })

  let phase1SuccessCount = 0

  for (let i = 0; i < activeAgents.length; i++) {
    if (aborted) break
    const agent = activeAgents[i]
    const progress = Math.round(((i + 1) / activeAgents.length) * 20)

    try {
      const newsContext = `${ROUNDTABLE_RULES}\n\n## 新闻内容\n\n${content}`
      const prompt = buildPhase1Prompt(agent, activeAgents)

      const response = await callAgent(agent, `${newsContext}\n\n${prompt}`, guardedOnEvent)

      discussionLog.push(`【阶段一·${agent.nameZh}提问】\n${response}`)

      const extractedQuestions = extractQuestions(response)
      for (const q of extractedQuestions) {
        const targetAgent = activeAgents.find((a) =>
          a.nameZh === q.targetName || a.id === q.targetName || q.targetName.includes(a.nameZh)
        )
        if (targetAgent) {
          const existing = questionsMap.get(targetAgent.id) || []
          existing.push({ from: agent.nameZh, fromId: agent.id, question: q.question })
          questionsMap.set(targetAgent.id, existing)

          guardedOnEvent({
            type: 'question_extracted',
            agentId: agent.id,
            agentName: agent.nameZh,
            targetAgentId: targetAgent.id,
            targetAgentName: targetAgent.nameZh,
            content: q.question,
          })
        }
      }

      phase1SuccessCount++
    } catch {
      discussionLog.push(`【阶段一·${agent.nameZh}提问】⚠️ 此角色因错误未能完成提问`)
    }

    guardedOnEvent({ type: 'agent_complete', agentId: agent.id, agentName: agent.nameZh, progress })
  }

  if (aborted) return

  guardedOnEvent({
    type: 'phase_complete',
    phase: 'questioning',
    content: '阶段一完成，进入阶段二：问题筛选',
    progress: 20,
  })

  if (phase1SuccessCount === 0) {
    db.run("UPDATE analysis_tasks SET status = 'failed', completed_at = datetime('now') WHERE id = ?", [taskId])
    save()
    guardedOnEvent({ type: 'error', content: 'All agents failed in phase 1' })
    return
  }

  // ========== Phase 2: Question Evaluation ==========
  guardedOnEvent({
    type: 'phase_start',
    phase: 'question_eval',
    content: '进入阶段二：问题筛选（仲裁官评估问题必要性）',
    progress: 20,
  })

  const arbitrator = activeAgents.find((a) => a.id === 'arbitrator')
  if (!arbitrator) {
    db.run("UPDATE analysis_tasks SET status = 'failed', completed_at = datetime('now') WHERE id = ?", [taskId])
    save()
    guardedOnEvent({ type: 'error', content: 'Arbitrator agent not found' })
    return
  }

  let evalResult: string = ''
  try {
    const allQuestionsText = Array.from(questionsMap.entries())
      .flatMap(([targetId, questions]) =>
        questions.map((q) => `【${q.from} → ${activeAgents.find(a => a.id === targetId)?.nameZh || targetId}】${q.question}`)
      )
      .join('\n')

    const newsContext = `${ROUNDTABLE_RULES}\n\n## 新闻内容\n\n${content}`
    const prompt = buildQuestionEvalPrompt(allQuestionsText)

    evalResult = await callAgent(arbitrator, `${newsContext}\n\n${prompt}`, guardedOnEvent)
    discussionLog.push(`【阶段二·综合仲裁官问题筛选】\n${evalResult}`)

    const keptQuestions = extractEvaluatedQuestions(evalResult)

    const filteredMap: Map<string, Array<{from: string, fromId: string, question: string}>> = new Map()
    for (const agent of activeAgents) {
      filteredMap.set(agent.id, [])
    }

    for (const [targetId, questions] of questionsMap.entries()) {
      const targetName = activeAgents.find(a => a.id === targetId)?.nameZh || targetId
      for (const q of questions) {
        const isKept = keptQuestions.some((kq) =>
          kq.includes(q.question.slice(0, 15)) ||
          (kq.includes(q.from) && kq.includes(targetName))
        )
        if (isKept) {
          const existing = filteredMap.get(targetId) || []
          existing.push(q)
          filteredMap.set(targetId, existing)
        }
      }
    }

    for (const [targetId, questions] of filteredMap.entries()) {
      questionsMap.set(targetId, questions)
    }

    guardedOnEvent({
      type: 'phase_complete',
      phase: 'question_eval',
      content: `问题筛选完成。共提出 ${Array.from(questionsMap.values()).flat().length} 个问题，保留 ${Array.from(filteredMap.values()).flat().length} 个必须回答的问题。`,
      progress: 35,
    })
  } catch {
    discussionLog.push(`【阶段二·问题筛选】⚠️ 筛选失败，将保留所有问题`)
    guardedOnEvent({
      type: 'phase_complete',
      phase: 'question_eval',
      content: '问题筛选失败，将保留所有问题进入阶段三。',
      progress: 35,
    })
  }

  if (aborted) return

  // ========== Phase 3: Answering & Debate ==========
  guardedOnEvent({
    type: 'phase_start',
    phase: 'answering',
    content: '进入阶段三：回答与辩论',
    progress: 35,
  })

  let phase3SuccessCount = 0

  for (let i = 0; i < activeAgents.length; i++) {
    if (aborted) break
    const agent = activeAgents[i]
    const progress = 35 + Math.round(((i + 1) / activeAgents.length) * 35)

    try {
      const questionsForAgent = questionsMap.get(agent.id) || []
      const allMessagesSoFar = discussionLog.join('\n\n---\n\n')
      const prompt = buildPhase3Prompt(agent, questionsForAgent, allMessagesSoFar)
      const newsContext = `${ROUNDTABLE_RULES}\n\n## 新闻内容\n\n${content}`

      const response = await callAgent(agent, `${newsContext}\n\n${prompt}`, guardedOnEvent)

      discussionLog.push(`【阶段三·${agent.nameZh}回答】\n${response}`)
      phase3SuccessCount++
    } catch {
      discussionLog.push(`【阶段三·${agent.nameZh}回答】⚠️ 此角色因错误未能完成回答`)
    }

    guardedOnEvent({ type: 'agent_complete', agentId: agent.id, agentName: agent.nameZh, progress })
  }

  if (aborted) return

  guardedOnEvent({
    type: 'phase_complete',
    phase: 'answering',
    content: '阶段三完成，进入阶段四：仲裁与决策',
    progress: 70,
  })

  // ========== Phase 4: Arbitration ==========
  guardedOnEvent({
    type: 'phase_start',
    phase: 'arbitration',
    content: '进入阶段四：仲裁与决策',
    progress: 70,
  })

  guardedOnEvent({
    type: 'arbitration_start',
    agentId: arbitrator.id,
    agentName: arbitrator.nameZh,
    progress: 75,
  })

  try {
    const allMessages = discussionLog.join('\n\n---\n\n')
    const prompt = buildPhase4Prompt(allMessages)
    const newsContext = `${ROUNDTABLE_RULES}\n\n## 新闻内容\n\n${content}`

    const raw = await callAgent(arbitrator, `${newsContext}\n\n${prompt}`, guardedOnEvent, true)

    let parsed: any = null
    try {
      parsed = JSON.parse(raw)
    } catch {
      console.warn('[Orchestrator] Arbitrator output is not valid JSON')
      parsed = raw
    }

    discussionLog.push(`【阶段四·综合仲裁官决策】\n${raw}`)

    for (const agent of activeAgents) {
      const resultId = uuidv4()
      const agentDiscussion = discussionLog
        .filter((log) => log.includes(agent.nameZh))
        .join('\n\n')

      db.run(
        `INSERT OR REPLACE INTO agent_results (id, task_id, agent_id, agent_name, raw_output, parsed_output, duration_ms, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))`,
        [resultId, taskId, agent.id, agent.nameZh, agentDiscussion, JSON.stringify({ discussion: agentDiscussion })],
      )
    }

    const arbId = uuidv4()
    db.run(
      `INSERT OR REPLACE INTO arbitration_results (id, task_id, final_score, risk_level, priority, summary, decision_reason, recommendation, consensus, dissents, full_output, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        arbId,
        taskId,
        parsed?.final_score ?? null,
        parsed?.risk_level ?? null,
        parsed?.priority ?? null,
        parsed?.summary ?? null,
        parsed?.decision_reason ?? null,
        parsed?.recommendation ?? null,
        parsed?.core_findings?.consensus ? JSON.stringify(parsed.core_findings.consensus) : null,
        parsed?.core_findings?.dissents ? JSON.stringify(parsed.core_findings.dissents) : null,
        raw,
      ],
    )

    db.run("UPDATE analysis_tasks SET status = 'completed', completed_at = datetime('now') WHERE id = ?", [taskId])
    save()

    guardedOnEvent({
      type: 'arbitration_complete',
      agentId: arbitrator.id,
      agentName: arbitrator.nameZh,
      result: parsed,
      progress: 100,
    })
  } catch (error: any) {
    console.error(`[Orchestrator] Arbitration failed: ${error.message}`)
    db.run("UPDATE analysis_tasks SET status = 'failed', completed_at = datetime('now') WHERE id = ?", [taskId])
    save()
    guardedOnEvent({
      type: 'error',
      content: `Arbitration failed: ${error.message}`,
    })
  }
}
