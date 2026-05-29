import { useEffect, useState, useRef } from 'react'
import { Upload, BookOpen, Trash2, Search, FileText, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KnowledgeItem {
  id: string
  filename: string
  title: string
  category: string
  content_length: number
  created_at: string
}

interface SearchResult {
  id: string
  filename: string
  title: string
  content: string
  category: string
  created_at: string
}

const CATEGORIES = ['宗教知识', '伦理学', '教义参考', '时事背景', '其他']

export default function KnowledgeBase() {
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('宗教知识')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const fetchItems = () => {
    setLoading(true)
    fetch('/api/knowledge')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setItems(json.data || [])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchItems()
  }, [])

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', selectedFile)
    formData.append('title', title || selectedFile.name.replace('.pdf', ''))
    formData.append('category', category)

    try {
      const res = await fetch('/api/knowledge/upload', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (json.success) {
        setTitle('')
        setSelectedFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        fetchItems()
      } else {
        alert(json.error || '上传失败')
      }
    } catch (err: any) {
      alert('上传失败: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此知识条目吗？')) return

    try {
      const res = await fetch(`/api/knowledge/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        fetchItems()
      }
    } catch {}
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setSearching(true)
    try {
      const res = await fetch(`/api/knowledge/search?q=${encodeURIComponent(searchQuery)}`)
      const json = await res.json()
      if (json.success) {
        setSearchResults(json.data || [])
      }
    } catch {} finally {
      setSearching(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="font-display text-2xl font-bold text-gold-300 mb-6">
        知识库管理
      </h2>

      <div className="card-gold p-6 mb-6 animate-fade-in">
        <h3 className="text-gold-100 font-medium mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4 text-gold-300" />
          上传PDF文档
        </h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="btn-gold cursor-pointer flex items-center gap-2 text-sm shrink-0">
              <FileText className="w-4 h-4" />
              选择文件
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
            {selectedFile && (
              <span className="text-sm text-gold-100/60 truncate">
                {selectedFile.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="文档标题（留空则使用文件名）"
              className="input-dark flex-1 min-w-[200px]"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input-dark min-w-[140px]"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className={cn(
                'btn-gold-primary flex items-center gap-2 text-sm',
                (!selectedFile || uploading) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {uploading ? '上传中...' : '上传'}
            </button>
          </div>
        </div>
      </div>

      <div className="card-gold p-6 mb-6 animate-slide-up">
        <h3 className="text-gold-100 font-medium mb-4 flex items-center gap-2">
          <Search className="w-4 h-4 text-gold-300" />
          知识搜索
        </h3>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="输入关键词搜索知识库..."
            className="input-dark flex-1"
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="btn-gold flex items-center gap-2 text-sm"
          >
            {searching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            搜索
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-4 space-y-3">
            {searchResults.map((result) => (
              <div key={result.id} className="p-3 rounded-lg border border-gold-300/10 bg-indigo-950/50">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-3 h-3 text-gold-300" />
                  <span className="text-sm font-medium text-gold-100">{result.title}</span>
                  <span className="text-xs text-gold-100/40 px-2 py-0.5 rounded-full border border-gold-300/10">
                    {result.category}
                  </span>
                </div>
                <p className="text-xs text-gold-100/50 line-clamp-3">{result.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="animate-slide-up">
        <h3 className="text-gold-100 font-medium mb-4 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-gold-300" />
          已上传文档
        </h3>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-pulse text-gold-300 text-2xl">●</div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-gold-100/40">
            暂无知识库文档，请上传PDF文件
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="card-gold-hover p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg border border-gold-300/20 bg-gold-300/5 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-gold-300/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gold-100/80 text-sm font-medium truncate">
                    {item.title}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gold-100/30 px-2 py-0.5 rounded-full border border-gold-300/10">
                      {item.category}
                    </span>
                    <span className="text-xs text-gold-100/30">
                      {Math.round(item.content_length / 1024)}KB
                    </span>
                    <span className="text-xs text-gold-100/30">
                      {new Date(item.created_at).toLocaleString('zh-CN')}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-2 rounded-lg text-gold-100/30 hover:text-red-400 hover:bg-red-400/10 transition-all duration-300"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
