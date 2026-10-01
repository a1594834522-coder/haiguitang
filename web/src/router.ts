import { useEffect, useState } from 'react'

export function navigate(to: string) {
  if (to === location.pathname) return
  history.pushState(null, '', to)
  dispatchEvent(new PopStateEvent('popstate'))
}

export function usePath() {
  const [path, setPath] = useState(location.pathname)
  useEffect(() => {
    const f = () => setPath(location.pathname)
    addEventListener('popstate', f)
    return () => removeEventListener('popstate', f)
  }, [])
  return path
}
