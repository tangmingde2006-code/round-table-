import { useState, useEffect, useCallback } from 'react'
import {
  Sparkles,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Globe,
  Loader2,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AgentPrompt {
  agentId: string
  agentName: string
  icon: string
  color: string
  defaultPrompt: string
  customPrompt: string | null
  activePrompt: string
}

interface PromptsData {
  agents: AgentPrompt[]
  globalCriteria: string | null
}

interface AgentState {
  editText: string
  nlInput: string
  expanded: boolean
  adjusting: boolean
  saving: boolean
  useCustom: boolean
}

const DEFAULT_AGENT_STATES: Record<string, Partial<AgentState>> = {}

export default function PromptStudio() {
  const [data, setData] = useState<PromptsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [globalCriteria, setGlobalCriteria] = useState('')
  const [globalNlInput, setGlobalNlInput] = useState('')
  const [globalAdjusting, setGlobalAdjusting] = useState(false)
  const [globalSaving, setGlobalSaving] = useState(false)
  const [agentStates, setAgentStates] = useState<Record<string, AgentState>>({})
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({
    message: '',
    visible: false,
  })

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true })
    setTimeout(() => setToast({ message: '', visible: false }), 2500)
  }, [])

  const fetchPrompts = useCallback(async () => {
    try {
      const res = await fetch('/api/prompts')
      const json = await res.json()
      if (json.success) {
        setData(json.data)
        setGlobalCriteria(json.data.global_criteria || '')
        const states: Record<string, AgentState> = {}
        json.data.agents.forEach((agent: AgentPrompt) => {
          const existing = DEFAULT_AGENT_STATES[agent.agentId]
          states[agent.agentId] = {
            editText: agent.customPrompt || agent.defaultPrompt,
            nlInput: existing?.nlInput || '',
            expanded: existing?.expanded || false,
            adjusting: false,
            saving: false,
            useCustom: !!agent.customPrompt,
          }
        })
        setAgentStates(states)
      }
    } catch (e) {
      console.error('获取提示词失败', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPrompts()
  }, [fetchPrompts])

  const updateAgentState = useCallback(
    (agentId: string, patch: Partial<AgentState>) => {
      setAgentStates((prev) => ({
        ...prev,
        [agentId]: { ...prev[agentId], ...patch },
      }))
    },
    []
  )

  const handleGlobalAdjust = async () => {
    if (!globalNlInput.trim() || globalAdjusting) return
    setGlobalAdjusting(true)
    try {
      const res = await fetch('/api/prompts/adjust-global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: globalNlInput }),
      })
      const json = await res.json()
      if (json.success) {
        setGlobalCriteria(json.data.global_criteria)
        setGlobalNlInput('')
      }
    } catch (e) {
      console.error('全局调整失败', e)
    } finally {
      setGlobalAdjusting(false)
    }
  }

  const handleGlobalSave = async () => {
    if (globalSaving) return
    setGlobalSaving(true)
    try {
      const res = await fetch('/api/prompts/global-criteria', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criteria: globalCriteria }),
      })
      const json = await res.json()
      if (json.success) {
        showToast('全局标准已保存')
      }
    } catch (e) {
      console.error('保存全局标准失败', e)
    } finally {
      setGlobalSaving(false)
    }
  }

  const handleAgentAdjust = async (agentId: string) => {
    const state = agentStates[agentId]
    if (!state?.nlInput.trim() || state.adjusting) return
    updateAgentState(agentId, { adjusting: true })
    try {
      const res = await fetch('/api/prompts/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          instruction: state.nlInput,
        }),
      })
      const json = await res.json()
      if (json.success) {
        updateAgentState(agentId, {
          editText: json.data.customPrompt,
          nlInput: '',
          useCustom: true,
        })
      }
    } catch (e) {
      console.error('调整提示词失败', e)
    } finally {
      updateAgentState(agentId, { adjusting: false })
    }
  }

  const handleAgentSave = async (agentId: string) => {
    const state = agentStates[agentId]
    if (state?.saving) return
    updateAgentState(agentId, { saving: true })
    try {
      const res = await fetch(`/api/prompts/${agentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPrompt: state.editText }),
      })
      const json = await res.json()
      if (json.success) {
        updateAgentState(agentId, { useCustom: true })
        showToast('提示词已保存')
        await fetchPrompts()
      }
    } catch (e) {
      console.error('保存提示词失败', e)
    } finally {
      updateAgentState(agentId, { saving: false })
    }
  }

  const handleAgentReset = async (agentId: string) => {
    try {
      const res = await fetch(`/api/prompts/${agentId}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json.success) {
        const agent = data?.agents.find((a) => a.agentId === agentId)
        updateAgentState(agentId, {
          editText: agent?.defaultPrompt || '',
          useCustom: false,
        })
        showToast('已重置为默认提示词')
        await fetchPrompts()
      }
    } catch (e) {
      console.error('重置提示词失败', e)
    }
  }

  const handleToggleCustom = (agentId: string, useCustom: boolean) => {
    const agent = data?.agents.find((a) => a.agentId === agentId)
    if (!agent) return
    if (useCustom) {
      updateAgentState(agentId, {
        useCustom: true,
        editText: agent.customPrompt || agent.defaultPrompt,
      })
    } else {
      updateAgentState(agentId, {
        useCustom: false,
        editText: agent.defaultPrompt,
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-gold-300 animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gold-100/50">加载失败，请刷新重试</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      {toast.visible && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm animate-slide-up">
          <Check className="w-4 h-4" />
          {toast.message}
        </div>
      )}

      <div className="text-center mb-2">
        <h2 className="font-display text-3xl font-bold text-gold-300 mb-2">
          提示词工作室
        </h2>
        <p className="text-gold-100/50 text-sm">
          自定义每个智能体的提示词，或使用自然语言让 AI 帮你调整
        </p>
      </div>

      <div className="card-gold p-6 animate-slide-up">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full border border-gold-300/40 bg-gold-300/10 flex items-center justify-center">
            <Globe className="w-5 h-5 text-gold-300" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-gold-300">
              全局标准
            </h3>
            <p className="text-gold-100/40 text-xs">
              此标准将附加到所有智能体的提示词中
            </p>
          </div>
        </div>

        <textarea
          value={globalCriteria}
          onChange={(e) => setGlobalCriteria(e.target.value)}
          rows={4}
          className="input-dark resize-none mb-4"
          placeholder="输入全局标准..."
        />

        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-gold-300/60 shrink-0" />
          <input
            type="text"
            value={globalNlInput}
            onChange={(e) => setGlobalNlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGlobalAdjust()}
            placeholder="例如：入库标准要更严格，只有事实核查评分8分以上才可入库"
            className="input-dark flex-1 text-sm"
          />
          <button
            onClick={handleGlobalAdjust}
            disabled={!globalNlInput.trim() || globalAdjusting}
            className={cn(
              'btn-gold flex items-center gap-2 text-sm whitespace-nowrap',
              (!globalNlInput.trim() || globalAdjusting) &&
                'opacity-50 cursor-not-allowed'
            )}
          >
            {globalAdjusting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            AI 调整
          </button>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleGlobalSave}
            disabled={globalSaving}
            className="btn-gold-primary flex items-center gap-2 text-sm"
          >
            {globalSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            保存全局标准
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {data.agents.map((agent, index) => {
          const state = agentStates[agent.agentId]
          if (!state) return null

          return (
            <div
              key={agent.agentId}
              className="card-gold p-6 animate-slide-up"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-lg border"
                    style={{
                      borderColor: `${agent.color}40`,
                      backgroundColor: `${agent.color}15`,
                    }}
                  >
                    {agent.icon}
                  </div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg font-semibold text-gold-100">
                      {agent.agentName}
                    </h3>
                    {state.useCustom && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gold-300/20 text-gold-300 border border-gold-300/30">
                        已自定义
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      handleToggleCustom(agent.agentId, !state.useCustom)
                    }
                    className={cn(
                      'relative w-12 h-6 rounded-full transition-all duration-300',
                      state.useCustom
                        ? 'bg-gold-300/30 border border-gold-300/50'
                        : 'bg-indigo-950/80 border border-gold-300/20'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 w-5 h-5 rounded-full transition-all duration-300',
                        state.useCustom
                          ? 'left-6.5 bg-gold-300'
                          : 'left-0.5 bg-gold-100/40'
                      )}
                    />
                  </button>
                  <span className="text-xs text-gold-100/50 min-w-[5rem]">
                    {state.useCustom ? '自定义提示词' : '默认提示词'}
                  </span>
                </div>
              </div>

              {state.useCustom ? (
                <textarea
                  value={state.editText}
                  onChange={(e) =>
                    updateAgentState(agent.agentId, {
                      editText: e.target.value,
                    })
                  }
                  rows={8}
                  className="input-dark resize-none mb-4 text-sm leading-relaxed"
                />
              ) : (
                <div className="mb-4">
                  <button
                    onClick={() =>
                      updateAgentState(agent.agentId, {
                        expanded: !state.expanded,
                      })
                    }
                    className="flex items-center gap-2 text-sm text-gold-100/50 hover:text-gold-300 transition-colors mb-2"
                  >
                    {state.expanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                    {state.expanded ? '收起默认提示词' : '展开默认提示词'}
                  </button>
                  {state.expanded && (
                    <div className="p-4 rounded-lg bg-indigo-950/60 border border-gold-300/10 text-sm text-gold-100/60 leading-relaxed whitespace-pre-wrap animate-fade-in">
                      {agent.defaultPrompt}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-gold-300/60 shrink-0" />
                <input
                  type="text"
                  value={state.nlInput}
                  onChange={(e) =>
                    updateAgentState(agent.agentId, {
                      nlInput: e.target.value,
                    })
                  }
                  onKeyDown={(e) =>
                    e.key === 'Enter' && handleAgentAdjust(agent.agentId)
                  }
                  placeholder="用自然语言描述你想调整的方向..."
                  className="input-dark flex-1 text-sm"
                />
                <button
                  onClick={() => handleAgentAdjust(agent.agentId)}
                  disabled={!state.nlInput.trim() || state.adjusting}
                  className={cn(
                    'btn-gold flex items-center gap-2 text-sm whitespace-nowrap',
                    (!state.nlInput.trim() || state.adjusting) &&
                      'opacity-50 cursor-not-allowed'
                  )}
                >
                  {state.adjusting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  AI 调整
                </button>
              </div>

              <div className="flex items-center justify-end gap-2">
                {state.useCustom && (
                  <button
                    onClick={() => handleAgentReset(agent.agentId)}
                    className="btn-gold flex items-center gap-2 text-sm"
                  >
                    <RotateCcw className="w-4 h-4" />
                    重置为默认
                  </button>
                )}
                <button
                  onClick={() => handleAgentSave(agent.agentId)}
                  disabled={state.saving}
                  className="btn-gold-primary flex items-center gap-2 text-sm"
                >
                  {state.saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  保存
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
