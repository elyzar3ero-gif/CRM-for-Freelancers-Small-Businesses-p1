import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import * as dashboardApi from '../api/dashboard'
import type { DashboardData } from '../types'

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

function formatMonth(month: string): string {
  const [year, monthNum] = month.split('-').map(Number)
  if (!year || !monthNum) return month
  return new Date(year, monthNum - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    dashboardApi
      .fetchDashboard()
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load dashboard')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="page">
        <h1>Dashboard</h1>
        <p className="empty">Loading...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="page">
        <h1>Dashboard</h1>
        <p className="error">{error || 'Failed to load dashboard'}</p>
      </div>
    )
  }

  const chartData = data.monthly_income.map((entry) => ({
    name: formatMonth(entry.month),
    income: entry.total,
  }))

  const maxStageCount = Math.max(
    ...data.leads_by_stage.map((stage) => stage.count),
    1,
  )

  return (
    <div className="page">
      <h1>Dashboard</h1>

      <div className="kpi-grid">
        <div className="kpi-card">
          <span>Monthly Income</span>
          <strong className="income">{currency.format(data.income_this_month)}</strong>
        </div>
        <div className="kpi-card">
          <span>Monthly Expenses</span>
          <strong className="expense">{currency.format(data.expenses_this_month)}</strong>
        </div>
        <div className="kpi-card">
          <span>Active Projects</span>
          <strong>{data.active_projects}</strong>
        </div>
        <div className="kpi-card">
          <span>Conversion Rate</span>
          <strong>{data.conversion_rate.toFixed(1)}%</strong>
        </div>
      </div>

      <section className="panel">
        <h2>Monthly Income (last 12 months)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(value: number) => `$${value}`}
            />
            <Tooltip formatter={(value) => currency.format(Number(value))} />
            <Bar dataKey="income" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="panel">
        <h2>Leads by Pipeline Stage</h2>
        {data.leads_by_stage.length === 0 ? (
          <p className="empty">No pipeline stages yet.</p>
        ) : (
          <ul className="stage-summary">
            {data.leads_by_stage.map((stage) => (
              <li key={stage.stage_id}>
                <div className="stage-summary-row">
                  <span className="stage-summary-name">{stage.name}</span>
                  <span className="stage-summary-count">{stage.count}</span>
                </div>
                <div className="stage-summary-bar">
                  <div
                    className="stage-summary-fill"
                    style={{
                      width: `${(stage.count / maxStageCount) * 100}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
