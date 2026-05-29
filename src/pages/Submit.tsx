import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Send,
  Link as LinkIcon,
  ChevronDown,
  ChevronUp,
  Shield,
  BookOpen,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

const AGENTS = [
  { id: 'fact_checker', name: '事实核查员', icon: '🔍' },
  { id: 'stance_analyst', name: '立场分析师', icon: '⚖️' },
  { id: 'ethics_evaluator', name: '宗教伦理评估师', icon: '🙏' },
  { id: 'intent_analyst', name: '传播意图分析师', icon: '📡' },
  { id: 'sentiment_analyst', name: '深度舆情分析师', icon: '📊' },
  { id: 'sensitivity_reviewer', name: '宗教敏感度审查员', icon: '🛡️' },
]

const DEPTHS = [
  { value: 'quick', label: '快速', desc: '简要扫描' },
  { value: 'standard', label: '标准', desc: '全面分析' },
  { value: 'deep', label: '深度', desc: '深度挖掘' },
]

export default function Submit() {
  const navigate = useNavigate()
  const { config, setConfig, reset } = useStore()
  const [newsText, setNewsText] = useState('')
  const [newsUrl, setNewsUrl] = useState('')
  const [paramsOpen, setParamsOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleToggleAgent = (agentId: string) => {
    const enabled = config.enabledAgents.includes(agentId)
    setConfig({
      enabledAgents: enabled
        ? config.enabledAgents.filter((id) => id !== agentId)
        : [...config.enabledAgents, agentId],
    })
  }

  const handleSubmit = async () => {
    if (!newsText.trim() || submitting) return
    setSubmitting(true)
    reset()
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newsText,
          url: newsUrl || undefined,
          options: {
            enabledAgents: config.enabledAgents,
            depth: config.depth,
          },
        }),
      })
      const data = await res.json()
      if (data.success && data.data?.taskId) {
        navigate(`/roundtable/${data.data.taskId}`)
      }
    } catch (_e) {
      console.error('提交分析失败', _e)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-gold-300/30 bg-gold-300/5 mb-4">
          <Shield className="w-8 h-8 text-gold-300" />
        </div>
        <h2 className="font-display text-3xl font-bold text-gold-300 mb-2">
          新闻分析
        </h2>
        <p className="text-gold-100/50 text-sm">
          提交新闻内容，圆桌智囊团将为您进行多维度深度分析
        </p>
      </div>

      <div className="card-gold p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 opacity-5">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <polygon
              points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5"
              fill="none"
              stroke="#d4a843"
              strokeWidth="0.5"
            />
            <polygon
              points="50,20 80,35 80,65 50,80 20,65 20,35"
              fill="none"
              stroke="#d4a843"
              strokeWidth="0.5"
            />
          </svg>
        </div>

        <div className="space-y-5 relative z-10">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gold-100 mb-2">
              <BookOpen className="w-4 h-4 text-gold-300" />
              新闻内容
            </label>
            <textarea
              value={newsText}
              onChange={(e) => setNewsText(e.target.value)}
              placeholder="请粘贴新闻全文内容..."
              rows={8}
              className="input-dark resize-none"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gold-100 mb-2">
              <LinkIcon className="w-4 h-4 text-gold-300" />
              来源链接（可选）
            </label>
            <input
              type="url"
              value={newsUrl}
              onChange={(e) => setNewsUrl(e.target.value)}
              placeholder="https://..."
              className="input-dark"
            />
          </div>

          <div>
            <button
              onClick={() => setParamsOpen(!paramsOpen)}
              className="flex items-center gap-2 text-sm text-gold-100/60 hover:text-gold-300 transition-colors"
            >
              {paramsOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              参数配置
            </button>

            {paramsOpen && (
              <div className="mt-4 space-y-4 p-4 rounded-lg bg-indigo-950/50 border border-gold-300/10 animate-fade-in">
                <div>
                  <label className="text-sm font-medium text-gold-100 mb-2 block">
                    选择智能体
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {AGENTS.map((agent) => {
                      const checked = config.enabledAgents.includes(agent.id)
                      return (
                        <button
                          key={agent.id}
                          onClick={() => handleToggleAgent(agent.id)}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all duration-300',
                            checked
                              ? 'border-gold-300/40 bg-gold-300/10 text-gold-300'
                              : 'border-gold-300/10 text-gold-100/40 hover:border-gold-300/20'
                          )}
                        >
                          <span>{agent.icon}</span>
                          <span className="truncate">{agent.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gold-100 mb-2 block">
                    分析深度
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {DEPTHS.map((d) => (
                      <button
                        key={d.value}
                        onClick={() => setConfig({ depth: d.value })}
                        className={cn(
                          'px-3 py-2 rounded-lg border text-sm transition-all duration-300',
                          config.depth === d.value
                            ? 'border-gold-300/60 bg-gold-300/15 text-gold-300'
                            : 'border-gold-300/15 text-gold-100/60 hover:border-gold-300/30'
                        )}
                      >
                        <div className="font-medium">{d.label}</div>
                        <div className="text-xs mt-0.5 opacity-60">{d.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!newsText.trim() || submitting}
            className={cn(
              'w-full btn-gold-primary flex items-center justify-center gap-2',
              (!newsText.trim() || submitting) &&
                'opacity-50 cursor-not-allowed hover:bg-gold-300 hover:shadow-none'
            )}
          >
            <Send className="w-5 h-5" />
            {submitting ? '正在启动...' : '启动圆桌分析'}
          </button>
        </div>
      </div>
    </div>
  )
}
