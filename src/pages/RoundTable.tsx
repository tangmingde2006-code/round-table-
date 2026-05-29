import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Shield, ArrowRight, MessageCircle, HelpCircle, Users, Crown, Filter } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

const AGENT_CONFIG = [
  { id: 'fact_checker', name: '事实核查员', icon: '🔍', color: '#4A90D9' },
  { id: 'stance_analyst', name: '立场分析师', icon: '⚖️', color: '#7B68EE' },
  { id: 'ethics_evaluator', name: '宗教伦理评估师', icon: '🙏', color: '#D4A843' },
  { id: 'intent_analyst', name: '传播意图分析师', icon: '📡', color: '#E67E22' },
  { id: 'sentiment_analyst', name: '深度舆情分析师', icon: '📊', color: '#2ECC71' },
  { id: 'sensitivity_reviewer', name: '宗教敏感度审查员', icon: '🛡️', color: '#E74C3C' },
  { id: 'arbitrator', name: '综合仲裁官', icon: '👑', color: '#F1C40F' },
]

const AGENT_MAP = Object.fromEntries(AGENT_CONFIG.map((a) => [a.id, a]))

type Phase = 'questioning' | 'question_eval' | 'answering' | 'arbitration' | null

interface DiscussionMessage {
  id: string
  phase: Phase
  agentId: string
  agentName: string
  content: string
  targetAgentId?: string
  targetAgentName?: string
  isQuestion?: boolean
  isStreaming?: boolean
  timestamp: number
}

const PHASE_INFO: Record<string, { label: string; icon: typeof HelpCircle; color: string }> = {
  questioning: { label: '阶段一：互相提问', icon: HelpCircle, color: '#4A90D9' },
  question_eval: { label: '阶段二：问题筛选', icon: Filter, color: '#D4A843' },
  answering: { label: '阶段三：回答与辩论', icon: MessageCircle, color: '#2ECC71' },
  arbitration: { label: '阶段四：仲裁与决策', icon: Crown, color: '#F1C40F' },
}

export default function RoundTable() {
  const { id: taskId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [completed, setCompleted] = useState(false)
  const [currentPhase, setCurrentPhase] = useState<Phase>(null)
  const currentPhaseRef = useRef<Phase>(null)
  const [phaseAnnouncements, setPhaseAnnouncements] = useState<Array<{ phase: Phase; content: string }>>([])
  const [messages, setMessages] = useState<DiscussionMessage[]>([])
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  const {
    setTaskStatus,
    addAgentResult,
    setArbitrationResult,
    setCurrentTask,
  } = useStore()

  useEffect(() => {
    if (taskId) setCurrentTask(taskId)
  }, [taskId, setCurrentTask])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!taskId) return
    setTaskStatus('analyzing')

    let aborted = false
    let msgCounter = 0
    let streamingMsgId: string | null = null
    let completedRef = false

    const handleEvent = (data: any) => {
      switch (data.type) {
        case 'phase_start':
          currentPhaseRef.current = data.phase
          setCurrentPhase(data.phase)
          setPhaseAnnouncements((prev) => [...prev, { phase: data.phase, content: data.content }])
          setMessages((prev) => [...prev, {
            id: `phase-${data.phase}-${++msgCounter}`,
            phase: data.phase,
            agentId: 'system',
            agentName: '系统',
            content: data.content,
            timestamp: Date.now(),
          }])
          break

        case 'agent_start':
          setActiveAgentId(data.agentId)
          streamingMsgId = `msg-${++msgCounter}`
          setMessages((prev) => [...prev, {
            id: streamingMsgId!,
            phase: currentPhaseRef.current,
            agentId: data.agentId,
            agentName: data.agentName || AGENT_MAP[data.agentId]?.name || data.agentId,
            content: '',
            isStreaming: true,
            timestamp: Date.now(),
          }])
          break

        case 'agent_chunk': {
          if (streamingMsgId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamingMsgId
                  ? { ...m, content: m.content + (data.chunk || '') }
                  : m
              )
            )
          }
          break
        }

        case 'question_extracted': {
          setMessages((prev) => [...prev, {
            id: `q-${++msgCounter}`,
            phase: currentPhaseRef.current,
            agentId: data.agentId,
            agentName: data.agentName || AGENT_MAP[data.agentId]?.name || data.agentId,
            content: data.content,
            targetAgentId: data.targetAgentId,
            targetAgentName: data.targetAgentName,
            isQuestion: true,
            timestamp: Date.now(),
          }])
          break
        }

        case 'agent_message': {
          const isQuestion = !!data.targetAgentId
          if (streamingMsgId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamingMsgId
                  ? {
                      ...m,
                      content: data.content,
                      isStreaming: false,
                      isQuestion,
                      targetAgentId: data.targetAgentId,
                      targetAgentName: data.targetAgentName,
                    }
                  : m
              )
            )
            streamingMsgId = null
          } else if (data.content) {
            setMessages((prev) => [...prev, {
              id: `msg-${++msgCounter}`,
              phase: currentPhaseRef.current,
              agentId: data.agentId,
              agentName: data.agentName || AGENT_MAP[data.agentId]?.name || data.agentId,
              content: data.content,
              targetAgentId: data.targetAgentId,
              targetAgentName: data.targetAgentName,
              isQuestion,
              timestamp: Date.now(),
            }])
          }
          break
        }

        case 'agent_complete':
          if (data.result) {
            addAgentResult(data.agentId, data.result)
          }
          if (streamingMsgId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamingMsgId
                  ? { ...m, isStreaming: false }
                  : m
              )
            )
            streamingMsgId = null
          }
          setActiveAgentId(null)
          if (data.progress !== undefined) setProgress(data.progress)
          break

        case 'phase_complete':
          setPhaseAnnouncements((prev) => [...prev, { phase: data.phase, content: data.content }])
          setMessages((prev) => [...prev, {
            id: `phase-end-${data.phase}-${++msgCounter}`,
            phase: data.phase,
            agentId: 'system',
            agentName: '系统',
            content: data.content,
            timestamp: Date.now(),
          }])
          if (data.progress !== undefined) setProgress(data.progress)
          break

        case 'arbitration_start':
          setActiveAgentId('arbitrator')
          currentPhaseRef.current = 'arbitration'
          setCurrentPhase('arbitration')
          break

        case 'arbitration_complete':
          setArbitrationResult(data.result)
          setActiveAgentId(null)
          setTaskStatus('completed')
          setProgress(100)
          setCompleted(true)
          completedRef = true
          break

        case 'complete':
          if (!completedRef) {
            setTaskStatus('completed')
            setActiveAgentId(null)
            setProgress(100)
            setCompleted(true)
            completedRef = true
          }
          break

        case 'error':
          setMessages((prev) => [...prev, {
            id: `err-${++msgCounter}`,
            phase: currentPhaseRef.current,
            agentId: data.agentId || 'system',
            agentName: data.agentName || '系统',
            content: `❌ ${data.content || '分析过程中出现错误'}`,
            timestamp: Date.now(),
          }])
          if (!data.agentId) {
            setTaskStatus('failed')
            setActiveAgentId(null)
          }
          break
      }
    }

    const connect = async () => {
      try {
        const response = await fetch(`/api/analyze/${taskId}/stream`)
        if (!response.ok || !response.body) {
          setTaskStatus('failed')
          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (!aborted) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed.startsWith('data: ')) {
              try {
                const data = JSON.parse(trimmed.slice(6))
                handleEvent(data)
              } catch (err) {
                console.error('SSE parse error:', err)
              }
            }
          }
        }
      } catch (err) {
        if (!aborted) {
          console.error('SSE connection error:', err)
          setTaskStatus('failed')
          setActiveAgentId(null)
        }
      }
    }

    connect()

    return () => {
      aborted = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId])

  const currentPhaseInfo = currentPhase ? PHASE_INFO[currentPhase] : null

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Phase indicator bar */}
      <div className="card-gold p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-gold-300" />
            <span className="font-display text-lg font-bold text-gold-300">圆桌会议</span>
          </div>
          {currentPhaseInfo && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border"
              style={{
                borderColor: `${currentPhaseInfo.color}40`,
                backgroundColor: `${currentPhaseInfo.color}15`,
                color: currentPhaseInfo.color,
              }}
            >
              <currentPhaseInfo.icon className="w-4 h-4" />
              {currentPhaseInfo.label}
            </div>
          )}
        </div>

        {/* Phase progress steps */}
        <div className="flex items-center gap-1 mb-3">
          {(['questioning', 'question_eval', 'answering', 'arbitration'] as Phase[]).map((phase, i) => {
            const info = PHASE_INFO[phase!]
            const isActive = currentPhase === phase
            const isDone = phaseAnnouncements.some((p) => p.phase === phase && messages.some(m => m.phase === phase && m.agentId !== 'system'))
            return (
              <div key={phase} className="flex-1 flex items-center gap-1">
                <div
                  className={cn(
                    'flex-1 h-1.5 rounded-full transition-all duration-500',
                    isActive ? 'animate-pulse' : ''
                  )}
                  style={{
                    backgroundColor: isDone
                      ? info.color
                      : isActive
                        ? `${info.color}60`
                        : '#d4a84315',
                  }}
                />
                {i < 3 && (
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: isDone ? info.color : '#d4a84320',
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Active agent indicator */}
        {activeAgentId && (
          <div className="flex items-center gap-2 text-sm">
            <div className="flex items-center gap-1.5">
              {AGENT_CONFIG.filter((a) => a.id === activeAgentId).map((agent) => (
                <span key={agent.id} className="flex items-center gap-1.5">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center border-2 animate-pulse-gold"
                    style={{ borderColor: agent.color, backgroundColor: `${agent.color}15` }}
                  >
                    <span className="text-xs">{agent.icon}</span>
                  </span>
                  <span style={{ color: agent.color }}>{agent.name}</span>
                </span>
              ))}
              <span className="text-gold-100/40">正在发言...</span>
            </div>
          </div>
        )}
      </div>

      {/* Discussion messages */}
      <div className="card-gold p-4">
        <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2 custom-scrollbar">
          {messages.map((msg) => {
            if (msg.agentId === 'system') {
              return (
                <div
                  key={msg.id}
                  className="text-center py-3 animate-fade-in"
                >
                  <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium bg-gold-300/10 text-gold-300 border border-gold-300/20">
                    <Users className="w-3.5 h-3.5" />
                    {msg.content}
                  </span>
                </div>
              )
            }

            const agent = AGENT_MAP[msg.agentId] || { icon: '🤖', color: '#d4a843', name: msg.agentName }

            return (
              <div
                key={msg.id}
                className="animate-slide-up"
              >
                <div className="flex gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center border-2 shrink-0 mt-0.5"
                    style={{
                      borderColor: `${agent.color}50`,
                      backgroundColor: `${agent.color}10`,
                    }}
                  >
                    <span className="text-base">{agent.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: agent.color }}
                      >
                        {msg.agentName}
                      </span>
                      {msg.isQuestion && msg.targetAgentName && (
                        <>
                          <span className="text-gold-100/30 text-xs">→</span>
                          <span className="text-xs text-gold-100/50">
                            @{msg.targetAgentName}
                          </span>
                        </>
                      )}
                      {msg.phase && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${PHASE_INFO[msg.phase!]?.color}15`,
                            color: `${PHASE_INFO[msg.phase!]?.color}80`,
                          }}
                        >
                          {msg.phase === 'questioning' ? '提问' : msg.phase === 'question_eval' ? '筛选' : msg.phase === 'answering' ? '回答' : '仲裁'}
                        </span>
                      )}
                      <span className="text-[10px] text-gold-100/20">
                        {new Date(msg.timestamp).toLocaleTimeString('zh-CN')}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'text-sm leading-relaxed whitespace-pre-wrap rounded-lg p-3',
                        msg.isQuestion
                          ? 'bg-indigo-950/60 border border-gold-300/10'
                          : 'bg-indigo-950/40',
                        msg.content.startsWith('❌') && 'text-red-400'
                      )}
                    >
                      {msg.content}
                      {msg.isStreaming && (
                        <span className="inline-block w-0.5 h-4 bg-gold-300 animate-pulse ml-0.5 align-text-bottom" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Progress bar and action */}
      <div className="card-gold p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gold-100/60">会议进度</span>
              <span className="text-sm font-medium text-gold-300">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-2 bg-indigo-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-gold-600 to-gold-300 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          {completed && (
            <button
              onClick={() => navigate(`/report/${taskId}`)}
              className="btn-gold-primary flex items-center gap-2 shrink-0"
            >
              查看报告
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
