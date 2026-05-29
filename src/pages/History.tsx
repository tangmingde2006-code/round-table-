import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Filter, ChevronLeft, ChevronRight, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HistoryItem {
  id: string
  content: string
  url: string | null
  status: string
  created_at: string
  completed_at: string | null
  final_score: number | null
  risk_level: string | null
  priority: string | null
  summary: string | null
  recommendation: string | null
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

function getScoreColor(score: number | null) {
  if (!score) return 'text-gold-100/40'
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-yellow-400'
  if (score >= 40) return 'text-orange-400'
  return 'text-red-400'
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    analyzing: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    completed: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    failed: 'text-red-400 bg-red-400/10 border-red-400/20',
  }
  const labels: Record<string, string> = {
    analyzing: '分析中',
    completed: '已完成',
    failed: '失败',
  }
  return { className: map[status] || '', label: labels[status] || status }
}

export default function History() {
  const navigate = useNavigate()
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [riskFilter, setRiskFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      pageSize: '10',
    })
    if (keyword) params.set('keyword', keyword)
    if (riskFilter) params.set('riskLevel', riskFilter)

    fetch(`/api/history?${params}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setItems(json.data?.items || [])
          setTotalPages(json.data?.pagination?.totalPages || 1)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, keyword, riskFilter])

  const handleSearch = () => {
    setPage(1)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="font-display text-2xl font-bold text-gold-300 mb-6">
        历史记录
      </h2>

      <div className="card-gold p-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gold-100/40" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="搜索关键词..."
              className="input-dark pl-10"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gold-100/40" />
            <select
              value={riskFilter}
              onChange={(e) => {
                setRiskFilter(e.target.value)
                setPage(1)
              }}
              className="input-dark pl-10 pr-8 min-w-[140px]"
            >
              <option value="">全部风险</option>
              <option value="低">低风险</option>
              <option value="中">中风险</option>
              <option value="高">高风险</option>
              <option value="极高">极高风险</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-pulse text-gold-300 text-2xl">●</div>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-gold-100/40">
          暂无分析记录
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const statusInfo = getStatusBadge(item.status)
            return (
              <div
                key={item.id}
                className="card-gold-hover p-4 flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-gold-100/80 text-sm line-clamp-2 mb-2">
                    {item.summary || item.content.slice(0, 100)}
                  </p>
                  <div className="flex items-center gap-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', statusInfo.className)}>
                      {statusInfo.label}
                    </span>
                    {item.risk_level && (
                      <span className={getRiskBadge(item.risk_level)}>
                        {item.risk_level}
                      </span>
                    )}
                    <span className="text-xs text-gold-100/30">
                      {new Date(item.created_at).toLocaleString('zh-CN')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  {item.final_score !== null && (
                    <div className="text-center">
                      <div
                        className={cn(
                          'font-display text-2xl font-bold',
                          getScoreColor(item.final_score)
                        )}
                      >
                        {item.final_score}
                      </div>
                      <div className="text-xs text-gold-100/30">评分</div>
                    </div>
                  )}
                  <button
                    onClick={() => navigate(`/report/${item.id}`)}
                    className="btn-gold flex items-center gap-1.5 text-sm"
                  >
                    <Eye className="w-4 h-4" />
                    查看报告
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className={cn(
              'p-2 rounded-lg border border-gold-300/20 transition-all',
              page <= 1
                ? 'opacity-30 cursor-not-allowed'
                : 'hover:border-gold-300/40 hover:bg-gold-300/10 text-gold-100/60'
            )}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gold-100/60 px-3">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className={cn(
              'p-2 rounded-lg border border-gold-300/20 transition-all',
              page >= totalPages
                ? 'opacity-30 cursor-not-allowed'
                : 'hover:border-gold-300/40 hover:bg-gold-300/10 text-gold-100/60'
            )}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
