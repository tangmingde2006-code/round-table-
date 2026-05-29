import { create } from 'zustand'

interface AgentMessage {
  agentId: string
  agentName: string
  content: string
  timestamp: number
}

interface AppConfig {
  deepseekModel: string
  enabledAgents: string[]
  depth: string
}

type AgentResult = Record<string, any>

interface AppState {
  currentTaskId: string | null
  taskStatus: 'idle' | 'analyzing' | 'completed' | 'failed'
  agentResults: Record<string, AgentResult>
  arbitrationResult: AgentResult | null
  progress: number
  activeAgentId: string | null
  agentMessages: AgentMessage[]
  config: AppConfig
  setCurrentTask: (taskId: string) => void
  setTaskStatus: (status: AppState['taskStatus']) => void
  addAgentResult: (agentId: string, result: AgentResult) => void
  setArbitrationResult: (result: AgentResult) => void
  setProgress: (progress: number) => void
  setActiveAgent: (agentId: string | null) => void
  addAgentMessage: (message: AgentMessage) => void
  setConfig: (config: Partial<AppConfig>) => void
  reset: () => void
}

const initialState = {
  currentTaskId: null as string | null,
  taskStatus: 'idle' as const,
  agentResults: {} as Record<string, AgentResult>,
  arbitrationResult: null as AgentResult | null,
  progress: 0,
  activeAgentId: null as string | null,
  agentMessages: [] as AgentMessage[],
  config: {
    deepseekModel: 'deepseek-chat',
    enabledAgents: [
      'fact_checker',
      'stance_analyst',
      'ethics_evaluator',
      'intent_analyst',
      'sentiment_analyst',
      'sensitivity_reviewer',
    ],
    depth: 'standard',
  } as AppConfig,
}

export const useStore = create<AppState>((set) => ({
  ...initialState,
  setCurrentTask: (taskId) => set({ currentTaskId: taskId }),
  setTaskStatus: (status) => set({ taskStatus: status }),
  addAgentResult: (agentId, result) =>
    set((state) => ({
      agentResults: { ...state.agentResults, [agentId]: result },
    })),
  setArbitrationResult: (result) => set({ arbitrationResult: result }),
  setProgress: (progress) => set({ progress }),
  setActiveAgent: (agentId) => set({ activeAgentId: agentId }),
  addAgentMessage: (message) =>
    set((state) => ({
      agentMessages: [...state.agentMessages, message],
    })),
  setConfig: (config) =>
    set((state) => ({
      config: { ...state.config, ...config },
    })),
  reset: () => set(initialState),
}))
