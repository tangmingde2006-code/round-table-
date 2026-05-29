import { cn } from '@/lib/utils'

interface AgentAvatarProps {
  icon: string
  name: string
  color: string
  isActive?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: { ring: 'w-10 h-10', text: 'text-lg', label: 'text-xs' },
  md: { ring: 'w-14 h-14', text: 'text-2xl', label: 'text-sm' },
  lg: { ring: 'w-20 h-20', text: 'text-3xl', label: 'text-base' },
}

export default function AgentAvatar({
  icon,
  name,
  color,
  isActive = false,
  size = 'md',
}: AgentAvatarProps) {
  const s = sizeMap[size]

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        {isActive && (
          <div
            className="absolute inset-0 rounded-full animate-pulse-gold"
            style={{ boxShadow: `0 0 0 3px ${color}40` }}
          />
        )}
        <div
          className={cn(
            s.ring,
            'rounded-full flex items-center justify-center border-2 transition-all duration-500',
            isActive
              ? 'border-gold-300 shadow-[0_0_20px_rgba(212,168,67,0.3)]'
              : 'border-current/30'
          )}
          style={{
            borderColor: isActive ? '#d4a843' : `${color}40`,
            backgroundColor: `${color}15`,
          }}
        >
          <span className={s.text}>{icon}</span>
        </div>
      </div>
      <span
        className={cn(
          s.label,
          'font-medium transition-colors duration-300',
          isActive ? 'text-gold-300' : 'text-gold-100/60'
        )}
      >
        {name}
      </span>
    </div>
  )
}
