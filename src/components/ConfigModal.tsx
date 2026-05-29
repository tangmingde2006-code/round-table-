import { useState, useEffect } from 'react'
import { X, Key, Cpu, Layers, CheckSquare } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

const AGENTS = [
  { id: 'fact_checker', name: '事实核查员' },
  { id: 'stance_analyst', name: '立场分析师' },
  { id: 'ethics_evaluator', name: '宗教伦理评估师' },
  { id: 'intent_analyst', name: '传播意图分析师' },
  { id: 'sentiment_analyst', name: '深度舆情分析师' },
  { id: 'sensitivity_reviewer', name: '宗教敏感度审查员' },
]

const MODELS = [
  { value: 'deepseek-chat', label: 'DeepSeek Chat' },
  { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
]

const DEPTHS = [
  { value: 'quick', label: '快速', desc: '简要分析' },
  { value: 'standard', label: '标准', desc: '全面分析' },
  { value: 'deep', label: '深度', desc: '深度挖掘' },
]

export default function ConfigModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { config, setConfig } = useStore()
  const [apiKey, setApiKey] = useState('')
  const [tavilyApiKey, setTavilyApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (open) {
      setSaved(false)
      fetch('/api/config')
        .then((res) => res.json())
        .then((json) => {
          if (json.success && json.data) {
            const d = json.data
            if (d.deepseek_model?.value) setConfig({ deepseekModel: d.deepseek_model.value })
            if (d.enabled_agents?.value) setConfig({ enabledAgents: d.enabled_agents.value })
            if (d.depth?.value) setConfig({ depth: d.depth.value })
          }
        })
        .catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const handleToggleAgent = (agentId: string) => {
    const enabled = config.enabledAgents.includes(agentId)
    setConfig({
      enabledAgents: enabled
        ? config.enabledAgents.filter((id) => id !== agentId)
        : [...config.enabledAgents, agentId],
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const body: Record<string, any> = {
        deepseek_model: config.deepseekModel,
        enabled_agents: config.enabledAgents,
        depth: config.depth,
      }
      if (apiKey.trim()) {
        body.deepseek_api_key = apiKey.trim()
      }
      if (tavilyApiKey.trim()) {
        body.tavily_api_key = tavilyApiKey.trim()
      }

      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        setSaved(true)
        setApiKey('')
        setTavilyApiKey('')
        setTimeout(() => {
          setSaved(false)
          onClose()
        }, 1500)
      }
    } catch (_e) {
      console.error('保存配置失败', _e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 card-gold p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-lg font-bold text-gold-300">平台配置</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gold-100/60 hover:text-gold-300 hover:bg-gold-300/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gold-100 mb-2">
              <Key className="w-4 h-4 text-gold-300" />
              DeepSeek API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-... 输入后保存，留空则保留已有配置"
              className="input-dark"
            />
            <p className="text-xs text-gold-100/30 mt-1">
              也可通过环境变量 DEEPSEEK_API_KEY 设置
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gold-100 mb-2">
              <Key className="w-4 h-4 text-gold-300" />
              Tavily API Key
            </label>
            <input
              type="password"
              value={tavilyApiKey}
              onChange={(e) => setTavilyApiKey(e.target.value)}
              placeholder="tvly-... 输入后保存，留空则保留已有配置"
              className="input-dark"
            />
            <p className="text-xs text-gold-100/30 mt-1">
              联网搜索服务密钥，用于事实核查与舆情分析
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gold-100 mb-2">
              <Cpu className="w-4 h-4 text-gold-300" />
              模型选择
            </label>
            <select
              value={config.deepseekModel}
              onChange={(e) => setConfig({ deepseekModel: e.target.value })}
              className="input-dark"
            >
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gold-100 mb-2">
              <Layers className="w-4 h-4 text-gold-300" />
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
                      : 'border-gold-300/15 text-gold-100/60 hover:border-gold-300/30 hover:text-gold-100'
                  )}
                >
                  <div className="font-medium">{d.label}</div>
                  <div className="text-xs mt-0.5 opacity-60">{d.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gold-100 mb-2">
              <CheckSquare className="w-4 h-4 text-gold-300" />
              启用智能体
            </label>
            <div className="grid grid-cols-2 gap-2">
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
                    <div
                      className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center text-xs',
                        checked
                          ? 'border-gold-300 bg-gold-300/20'
                          : 'border-gold-300/20'
                      )}
                    >
                      {checked && '✓'}
                    </div>
                    {agent.name}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gold-300/10">
          <button onClick={onClose} className="btn-gold">
            取消
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-gold-primary">
            {saved ? '✓ 已保存' : saving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>
    </div>
  )
}
