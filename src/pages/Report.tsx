import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Download,
  ChevronDown,
  ChevronUp,
  Shield,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import RadarChart from '@/components/RadarChart'

const AGENT_CONFIG = [
  { id: 'fact_checker', name: '事实核查员', icon: '🔍', color: '#4A90D9' },
  { id: 'stance_analyst', name: '立场分析师', icon: '⚖️', color: '#7B68EE' },
  { id: 'ethics_evaluator', name: '宗教伦理评估师', icon: '🙏', color: '#D4A843' },
  { id: 'intent_analyst', name: '传播意图分析师', icon: '📡', color: '#E67E22' },
  { id: 'sentiment_analyst', name: '深度舆情分析师', icon: '📊', color: '#2ECC71' },
  { id: 'sensitivity_reviewer', name: '宗教敏感度审查员', icon: '🛡️', color: '#E74C3C' },
]

const RADAR_DIMENSIONS = [
  { key: 'fact_checker', label: '事实可信度' },
  { key: 'stance_analyst', label: '立场中立性' },
  { key: 'ethics_evaluator', label: '伦理合规' },
  { key: 'intent_analyst', label: '传播意图' },
  { key: 'sentiment_analyst', label: '舆情风险' },
  { key: 'sensitivity_reviewer', label: '宗教敏感度' },
]

type AgentResultData = Record<string, any>

interface ReportData {
  task: {
    id: string
    content: string
    url: string | null
    status: string
    created_at: string
    completed_at: string | null
  }
  agents: Array<{
    id: string
    task_id: string
    agent_id: string
    agent_name: string
    raw_output: string
    parsed_output: AgentResultData
    duration_ms: number
    completed_at: string
  }>
  arbitration: {
    id: string
    task_id: string
    final_score: number | null
    risk_level: string | null
    priority: string | null
    summary: string | null
    decision_reason: string | null
    recommendation: string | null
    consensus: string[] | null
    dissents: string[] | null
    full_output: any
    completed_at: string
  } | null
}

function getRiskBadge(level: string | null) {
  const map: Record<string, string> = {
    '低': 'badge-risk-low',
    '中': 'badge-risk-medium',
    '高': 'badge-risk-high',
    '极高': 'badge-risk-critical',
  }
  return map[level || ''] || 'badge-risk-medium'
}

function getRiskColor(level: string | null) {
  const map: Record<string, string> = {
    '低': 'text-emerald-400',
    '中': 'text-yellow-400',
    '高': 'text-orange-400',
    '极高': 'text-red-400',
  }
  return map[level || ''] || 'text-yellow-400'
}

function getScoreColor(score: number) {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-yellow-400'
  if (score >= 40) return 'text-orange-400'
  return 'text-red-400'
}

function AgentResultCard({
  agent,
  result,
}: {
  agent: (typeof AGENT_CONFIG)[0]
  result: AgentResultData
}) {
  const [expanded, setExpanded] = useState(false)

  const discussion = result?.discussion || result?.raw_output || ''
  const summaryText = result?.verdict || result?.overall_assessment || result?.ethical_recommendation || result?.intent_conclusion || result?.risk_areas?.join('; ') || result?.improvement_suggestions?.join('; ') || ''

  const displaySummary = discussion
    ? discussion.slice(0, 200).replace(/【阶段[一二三】·]+/g, '').trim()
    : summaryText

  return (
    <div
      className="card-gold-hover overflow-hidden"
      style={{ borderTopColor: agent.color, borderTopWidth: 2 }}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{agent.icon}</span>
            <span className="font-medium text-gold-100">{agent.name}</span>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded text-gold-100/40 hover:text-gold-300 transition-colors"
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
        {displaySummary && (
          <div className="text-sm text-gold-100/70 leading-relaxed line-clamp-4 mb-2">
            {displaySummary}
          </div>
        )}
        {expanded && (
          <div className="mt-3 p-3 rounded-lg bg-indigo-950/80 text-xs text-gold-100/60 whitespace-pre-wrap overflow-x-auto animate-fade-in max-h-[300px] overflow-y-auto">
            {discussion || JSON.stringify(result, null, 2)}
          </div>
        )}
      </div>
    </div>
  )
}

function extractScore(agentId: string, result: AgentResultData): number {
  if (!result) return 50
  switch (agentId) {
    case 'fact_checker':
      return Math.min(100, (result.fact_check_score || 5) * 10)
    case 'stance_analyst':
      return result.perspective_divergence === '低' ? 85 : result.perspective_divergence === '中' ? 60 : 40
    case 'ethics_evaluator':
      return result.religious_relevance === '高' ? 70 : result.religious_relevance === '中' ? 80 : 90
    case 'intent_analyst':
      return Math.max(0, 100 - (result.manipulation_index || 5) * 10)
    case 'sentiment_analyst':
      return Math.max(0, 100 - (result.polarization_potential || 5) * 10)
    case 'sensitivity_reviewer':
      return (result.respect_level || 5) * 10
    default:
      return 50
  }
}

export default function Report() {
  const { id: taskId } = useParams<{ id: string }>()
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!taskId) return
    setLoading(true)
    fetch(`/api/report/${taskId}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setReport(json.data)
        }
      })
      .catch(() => { /* ignore */ })
      .finally(() => setLoading(false))
  }, [taskId])

  const handleExport = () => {
    if (!report) return
    window.open(`/api/export/${taskId}`, '_blank')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-gold-300 text-2xl">●</div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="text-center py-20 text-gold-100/40">
        报告加载失败
      </div>
    )
  }

  const agentResultsMap: Record<string, AgentResultData> = {}
  for (const agent of report.agents) {
    agentResultsMap[agent.agent_id] = agent.parsed_output || {}
  }

  const finalScore = report.arbitration?.final_score ?? 0
  const riskLevel = report.arbitration?.risk_level ?? '未知'
  const summary = report.arbitration?.summary ?? report.task.content.slice(0, 100)
  const recommendation = report.arbitration?.recommendation ?? ''

  const radarData = RADAR_DIMENSIONS.map((dim) => ({
    label: dim.label,
    value: extractScore(dim.key, agentResultsMap[dim.key]),
    maxValue: 100,
  }))

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="card-gold p-6">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex-1 min-w-[280px]">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-gold-300" />
              <h2 className="font-display text-2xl font-bold text-gold-300">
                分析报告
              </h2>
            </div>
            <p className="text-gold-100/70 leading-relaxed mb-4">
              {summary}
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={getRiskBadge(riskLevel)}>
                风险等级：{riskLevel}
              </span>
              {recommendation && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gold-300/15 text-gold-300 border border-gold-300/25">
                  {recommendation}
                </span>
              )}
              {report.arbitration?.priority && (
                <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-medium border', getRiskColor(riskLevel))} style={{ borderColor: 'currentColor', opacity: 0.5 }}>
                  优先级：{report.arbitration.priority}
                </span>
              )}
            </div>
            {report.arbitration?.decision_reason && (
              <div className="mt-3 text-sm text-gold-100/50">
                决策理由：{report.arbitration.decision_reason}
              </div>
            )}
          </div>
          <div className="flex flex-col items-center">
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="#d4a84315"
                  strokeWidth="6"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="#d4a843"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${(finalScore / 100) * 264} 264`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className={cn(
                    'font-display text-3xl font-bold',
                    getScoreColor(finalScore)
                  )}
                >
                  {finalScore}
                </span>
              </div>
            </div>
            <span className="text-xs text-gold-100/40 mt-1">综合评分</span>
          </div>
        </div>
      </div>

      {report.arbitration?.consensus && report.arbitration.consensus.length > 0 && (
        <div className="card-gold p-6">
          <h3 className="font-display text-lg font-bold text-gold-300 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            核心发现
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-emerald-400 mb-2">共识点</h4>
              <ul className="space-y-1">
                {(report.arbitration.consensus as string[]).map((c, i) => (
                  <li key={i} className="text-sm text-gold-100/70 flex gap-2">
                    <span className="text-emerald-400 shrink-0">✓</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
            {report.arbitration.dissents && (report.arbitration.dissents as string[]).length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-orange-400 mb-2">分歧点</h4>
                <ul className="space-y-1">
                  {(report.arbitration.dissents as string[]).map((d, i) => (
                    <li key={i} className="text-sm text-gold-100/70 flex gap-2">
                      <span className="text-orange-400 shrink-0">!</span>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <h3 className="font-display text-lg font-bold text-gold-300 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          各智能体分析
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {AGENT_CONFIG.map((agent) => {
            const result = agentResultsMap[agent.id]
            if (!result || Object.keys(result).length === 0) return null
            return (
              <AgentResultCard
                key={agent.id}
                agent={agent}
                result={result}
              />
            )
          })}
        </div>
      </div>

      <div className="card-gold p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-gold-300">
            多维雷达图
          </h3>
          <button onClick={handleExport} className="btn-gold flex items-center gap-2">
            <Download className="w-4 h-4" />
            导出 Word 报告
          </button>
        </div>
        <div className="flex justify-center">
          <RadarChart data={radarData} size={360} />
        </div>
      </div>
    </div>
  )
}
