type ProgressRingProps = {
  // 0–1; values >1 render a full ring in the over-limit color
  progress: number
  size: number
  strokeWidth: number
  color: string
  trackColor?: string
  overColor?: string
  children?: React.ReactNode
}

export function ProgressRing({
  progress,
  size,
  strokeWidth,
  color,
  trackColor = 'rgba(29, 42, 35, 0.08)',
  overColor = '#e5484d',
  children,
}: ProgressRingProps) {
  const radius        = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped       = Math.min(1, Math.max(0, progress))
  const isOver        = progress > 1
  const dashOffset    = circumference * (1 - clamped)

  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={trackColor} strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={isOver ? overColor : color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 500ms cubic-bezier(0.16, 1, 0.3, 1), stroke 300ms ease' }}
        />
      </svg>
      {children && <div className="progress-ring-content">{children}</div>}
    </div>
  )
}
