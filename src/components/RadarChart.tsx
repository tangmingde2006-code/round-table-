interface RadarDataPoint {
  label: string
  value: number
  maxValue: number
}

interface RadarChartProps {
  data: RadarDataPoint[]
  size?: number
  color?: string
}

export default function RadarChart({
  data,
  size = 300,
  color = '#d4a843',
}: RadarChartProps) {
  const center = size / 2
  const maxRadius = size / 2 - 50
  const levels = 4
  const count = data.length

  const getPoint = (index: number, value: number, maxVal: number) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2
    const ratio = value / maxVal
    const r = maxRadius * ratio
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    }
  }

  const gridPaths = Array.from({ length: levels }, (_, level) => {
    const r = maxRadius * ((level + 1) / levels)
    return Array.from({ length: count }, (_, i) => {
      const angle = (Math.PI * 2 * i) / count - Math.PI / 2
      const x = center + r * Math.cos(angle)
      const y = center + r * Math.sin(angle)
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    }).join(' ') + ' Z'
  })

  const axisLines = Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2
    const x = center + maxRadius * Math.cos(angle)
    const y = center + maxRadius * Math.sin(angle)
    return `M ${center} ${center} L ${x} ${y}`
  })

  const dataPoints = data.map((d, i) => getPoint(i, d.value, d.maxValue))
  const dataPath =
    dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'

  const labelPositions = data.map((d, i) => {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2
    const r = maxRadius + 28
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
      label: d.label,
    }
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {gridPaths.map((path, i) => (
        <path
          key={`grid-${i}`}
          d={path}
          fill="none"
          stroke="#e8e0d015"
          strokeWidth={1}
        />
      ))}

      {axisLines.map((d, i) => (
        <path
          key={`axis-${i}`}
          d={d}
          fill="none"
          stroke="#e8e0d010"
          strokeWidth={1}
        />
      ))}

      <path
        d={dataPath}
        fill={`${color}20`}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {dataPoints.map((p, i) => (
        <circle
          key={`point-${i}`}
          cx={p.x}
          cy={p.y}
          r={4}
          fill={color}
          stroke="#1a1a2e"
          strokeWidth={2}
        />
      ))}

      {labelPositions.map((lp, i) => (
        <text
          key={`label-${i}`}
          x={lp.x}
          y={lp.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#e8e0d0"
          fontSize={12}
          fontFamily="'Noto Sans SC', sans-serif"
        >
          {lp.label}
        </text>
      ))}
    </svg>
  )
}
