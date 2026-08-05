import api from './axios'
import type { DashboardData } from '../types'

export async function fetchDashboard(): Promise<DashboardData> {
  const { data } = await api.get<DashboardData>('/dashboard')
  return data
}
