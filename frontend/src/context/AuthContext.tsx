import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import * as authApi from '../api/auth'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, fullName: string) => Promise<void>
  logout: () => void
}

const TOKEN_KEY = 'token'
const USER_KEY = 'user'

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function readStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    localStorage.removeItem(USER_KEY)
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readStoredUser)
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  )

  useEffect(() => {
    if (token && !user) {
      authApi
        .fetchMe()
        .then((me) => {
          setUser(me)
          localStorage.setItem(USER_KEY, JSON.stringify(me))
        })
        .catch(() => {
          localStorage.removeItem(TOKEN_KEY)
          localStorage.removeItem(USER_KEY)
          setToken(null)
        })
    }
  }, [token, user])

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password })
    localStorage.setItem(TOKEN_KEY, res.access_token)
    setToken(res.access_token)
    const me = await authApi.fetchMe()
    localStorage.setItem(USER_KEY, JSON.stringify(me))
    setUser(me)
  }, [])

  const register = useCallback(
    async (email: string, password: string, fullName: string) => {
      await authApi.register({ email, password, full_name: fullName })
      await login(email, password)
    },
    [login],
  )

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
