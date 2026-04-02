import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const MOBILE_QUERY = '(max-width: 991.98px)'
const AppUiContext = createContext(null)

export function AppUiProvider({ children }) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
  )
  const [mobileNavOpen, setMobileNavOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return !window.matchMedia(MOBILE_QUERY).matches
  })

  const [adminView, setAdminViewState] = useState(() => localStorage.getItem('adminView') !== 'false')

  const [currentWeek, setCurrentWeekState] = useState(() => {
    const saved = Number(localStorage.getItem('currentWeek'))
    return saved || null
  })

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const onChange = () => {
      const mobile = mq.matches
      setIsMobile(mobile)
      if (!mobile) setMobileNavOpen(true)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const setAdminView = useCallback((next) => {
    setAdminViewState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next
      localStorage.setItem('adminView', String(value))
      return value
    })
  }, [])

  const setCurrentWeek = useCallback((weekNum) => {
    setCurrentWeekState(weekNum)
    if (weekNum == null || Number.isNaN(weekNum)) localStorage.removeItem('currentWeek')
    else localStorage.setItem('currentWeek', String(weekNum))
  }, [])

  const toggleMobileNav = useCallback(() => {
    setMobileNavOpen((o) => !o)
  }, [])

  const value = useMemo(
    () => ({
      isMobile,
      mobileNavOpen,
      setMobileNavOpen,
      toggleMobileNav,
      adminView,
      setAdminView,
      currentWeek,
      setCurrentWeek
    }),
    [isMobile, mobileNavOpen, adminView, currentWeek, setAdminView, setCurrentWeek, toggleMobileNav]
  )

  return <AppUiContext.Provider value={value}>{children}</AppUiContext.Provider>
}

export function useAppUi() {
  const ctx = useContext(AppUiContext)
  if (!ctx) throw new Error('useAppUi must be used inside AppUiProvider')
  return ctx
}
