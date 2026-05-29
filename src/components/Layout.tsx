import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Settings, ScrollText, BookOpen, Shield, Sliders } from 'lucide-react'
import { cn } from '@/lib/utils'
import ConfigModal from './ConfigModal'

const navItems = [
  { path: '/', label: '提交分析', icon: BookOpen },
  { path: '/history', label: '历史记录', icon: ScrollText },
  { path: '/prompt-studio', label: '提示词工作室', icon: Sliders },
  { path: '/knowledge-base', label: '知识库', icon: BookOpen },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [configOpen, setConfigOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b border-gold-300/10 bg-indigo-950/90 backdrop-blur-md">
        <div className="container flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-full border border-gold-300/60 bg-gold-300/10 flex items-center justify-center group-hover:border-gold-300 transition-all duration-300">
              <Shield className="w-5 h-5 text-gold-300" />
            </div>
            <h1 className="font-display text-xl font-bold text-gold-300 tracking-wide">
              Round Table AI
            </h1>
          </Link>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300',
                    isActive
                      ? 'text-gold-300 bg-gold-300/10 border border-gold-300/20'
                      : 'text-gold-100/60 hover:text-gold-100 hover:bg-gold-300/5'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              )
            })}
            <button
              onClick={() => setConfigOpen(true)}
              className="ml-2 p-2 rounded-lg text-gold-100/60 hover:text-gold-300 hover:bg-gold-300/10 transition-all duration-300"
            >
              <Settings className="w-5 h-5" />
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 container px-4 py-6">
        {children}
      </main>

      <footer className="border-t border-gold-300/10 py-4">
        <div className="container px-4 text-center text-xs text-gold-100/30">
          Round Table AI · 宗教智库新闻筛选平台
        </div>
      </footer>

      <ConfigModal open={configOpen} onClose={() => setConfigOpen(false)} />
    </div>
  )
}
