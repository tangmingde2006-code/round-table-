import { Router, type Request, type Response } from 'express'
import { getDatabase } from '../db.js'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  type ISectionOptions,
} from 'docx'

const router = Router()

const AGENT_NAMES: Record<string, string> = {
  fact_checker: '事实核查员',
  stance_analyst: '立场分析师',
  ethics_evaluator: '宗教伦理评估师',
  intent_analyst: '传播意图分析师',
  sentiment_analyst: '深度舆情分析师',
  sensitivity_reviewer: '宗教敏感度审查员',
  arbitrator: '综合仲裁官',
}

router.get('/:taskId', async (req: Request, res: Response): Promise<void> => {
  const { taskId } = req.params
  const db = getDatabase()

  const taskResult = db.exec('SELECT id, content, url, status, created_at, completed_at FROM analysis_tasks WHERE id = ?', [taskId])
  if (taskResult.length === 0 || taskResult[0].values.length === 0) {
    res.status(404).json({ success: false, error: 'Task not found' })
    return
  }

  const task = {
    id: taskResult[0].values[0][0] as string,
    content: taskResult[0].values[0][1] as string,
    url: taskResult[0].values[0][2] as string,
    status: taskResult[0].values[0][3] as string,
    created_at: taskResult[0].values[0][4] as string,
    completed_at: taskResult[0].values[0][5] as string,
  }

  const agentResultRows = db.exec('SELECT agent_id, agent_name, raw_output, parsed_output FROM agent_results WHERE task_id = ?', [taskId])
  const agents = (agentResultRows.length > 0 ? agentResultRows[0].values : []).map((row) => ({
    agent_id: row[0] as string,
    agent_name: row[1] as string,
    raw_output: row[2] as string,
    parsed_output: row[3] as string,
  }))

  const arbResultRows = db.exec('SELECT final_score, risk_level, priority, summary, decision_reason, recommendation, consensus, dissents, full_output FROM arbitration_results WHERE task_id = ?', [taskId])
  const arbRow = arbResultRows.length > 0 && arbResultRows[0].values.length > 0 ? arbResultRows[0].values[0] : null

  const arbitration = arbRow ? {
    final_score: arbRow[0] as number | null,
    risk_level: arbRow[1] as string | null,
    priority: arbRow[2] as string | null,
    summary: arbRow[3] as string | null,
    decision_reason: arbRow[4] as string | null,
    recommendation: arbRow[5] as string | null,
    consensus: (() => { try { return JSON.parse(arbRow[6] as string) } catch { return null } })(),
    dissents: (() => { try { return JSON.parse(arbRow[7] as string) } catch { return null } })(),
    full_output: arbRow[8] as string,
  } : null

  const children: (Paragraph | Table)[] = []

  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'Round Table AI', bold: true, size: 56, color: 'D4A843', font: 'Playfair Display' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: '宗教智库新闻筛选 · 圆桌会议分析报告', size: 28, color: '666666' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
  )

  children.push(
    new Paragraph({
      text: '一、基本信息',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 200 },
    }),
  )

  const infoRows = [
    ['分析时间', task.created_at || '—'],
    ['完成时间', task.completed_at || '—'],
    ['新闻来源', task.url || '文本输入'],
    ['综合评分', arbitration?.final_score != null ? `${arbitration.final_score}/100` : '—'],
    ['风险等级', arbitration?.risk_level || '—'],
    ['优先级', arbitration?.priority || '—'],
    ['入库建议', arbitration?.recommendation || '—'],
  ]

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: infoRows.map(([label, value]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.SOLID, color: 'F5F0E8' },
              children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20 })] })],
            }),
            new TableCell({
              width: { size: 75, type: WidthType.PERCENTAGE },
              children: [new Paragraph({ children: [new TextRun({ text: value, size: 20 })] })],
            }),
          ],
        })
      ),
    }),
  )

  if (arbitration?.summary) {
    children.push(
      new Paragraph({
        text: '新闻摘要',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
      }),
      new Paragraph({
        children: [new TextRun({ text: arbitration.summary, size: 20 })],
        spacing: { after: 200 },
      }),
    )
  }

  if (arbitration?.decision_reason) {
    children.push(
      new Paragraph({
        text: '决策理由',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      }),
      new Paragraph({
        children: [new TextRun({ text: arbitration.decision_reason, size: 20 })],
        spacing: { after: 200 },
      }),
    )
  }

  children.push(
    new Paragraph({
      text: '二、核心发现',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
  )

  if (arbitration?.consensus && (arbitration.consensus as string[]).length > 0) {
    children.push(
      new Paragraph({
        text: '共识点',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      }),
    )
    for (const c of arbitration.consensus as string[]) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: '✓ ', bold: true, color: '22C55E', size: 20 }),
            new TextRun({ text: c, size: 20 }),
          ],
          spacing: { after: 80 },
        }),
      )
    }
  }

  if (arbitration?.dissents && (arbitration.dissents as string[]).length > 0) {
    children.push(
      new Paragraph({
        text: '分歧点',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      }),
    )
    for (const d of arbitration.dissents as string[]) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: '! ', bold: true, color: 'F97316', size: 20 }),
            new TextRun({ text: d, size: 20 }),
          ],
          spacing: { after: 80 },
        }),
      )
    }
  }

  children.push(
    new Paragraph({
      text: '三、圆桌讨论记录',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
  )

  for (const agent of agents) {
    const name = agent.agent_name || AGENT_NAMES[agent.agent_id] || agent.agent_id
    children.push(
      new Paragraph({
        text: name,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
      }),
    )

    const discussion = agent.raw_output || ''
    const lines = discussion.split('\n').filter((l: string) => l.trim())
    for (const line of lines) {
      const isPhaseLabel = line.startsWith('【') && line.includes('·')
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line,
              size: 18,
              bold: isPhaseLabel,
              color: isPhaseLabel ? 'D4A843' : '333333',
            }),
          ],
          spacing: { after: 60 },
        }),
      )
    }
  }

  children.push(
    new Paragraph({
      text: '四、原始新闻内容',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: task.content, size: 18, color: '555555' })],
      spacing: { after: 200 },
    }),
  )

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  })

  const buffer = await Packer.toBuffer(doc)

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  res.setHeader('Content-Disposition', `attachment; filename="roundtable-report-${taskId}.docx"`)
  res.send(buffer)
})

export default router
