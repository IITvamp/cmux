'use client'

import { LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

interface ClientIconProps {
  icon: LucideIcon
  className?: string
  'aria-hidden'?: boolean | 'true' | 'false'
}

export function ClientIcon({ icon: Icon, className, 'aria-hidden': ariaHidden = true }: ClientIconProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className={className} aria-hidden={ariaHidden} />
  }

  return <Icon className={className} aria-hidden={ariaHidden} />
}