import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import * as transactionsApi from '../api/transactions'
import * as clientsApi from '../api/clients'
import * as projectsApi from '../api/projects'
import Table, { type Column } from '../components/Table'
import type { Client, Project, Transaction, TransactionType } from '../types'

const today = new Date().toISOString().slice(0, 10)

const emptyForm = {
  type: 'income' as TransactionType,
  category: '',
  amount: '',
  date: today,
  project_id: '',
  client_id: '',
  description: '',
}

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [filterType, setFilterType] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setTransactions(
        await transactionsApi.fetchTransactions({
          type: filterType || undefined,
          project_id: filterProject || undefined,
          client_id: filterClient || undefined,
          date_from: filterFrom || undefined,
          date_to: filterTo || undefined,
        }),
      )
    } catch {
      setError('Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }, [filterType, filterProject, filterClient, filterFrom, filterTo])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    Promise.all([clientsApi.fetchClients(), projectsApi.fetchProjects()])
      .then(([clientData, projectData]) => {
        setClients(clientData)
        setProjects(projectData)
      })
      .catch(() => {
        setError('Failed to load related data')
      })
  }, [])

  const totals = useMemo(() => {
    let income = 0
    let expense = 0
    for (const t of transactions) {
      const amount = Number(t.amount) || 0
      if (t.type === 'income') income += amount
      else expense += amount
    }
    return { income, expense, net: income - expense }
  }, [transactions])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (transaction: Transaction) => {
    setEditing(transaction)
    setForm({
      type: transaction.type,
      category: transaction.category ?? '',
      amount: transaction.amount.toString(),
      date: transaction.date,
      project_id: transaction.project_id ?? '',
      client_id: transaction.client_id ?? '',
      description: transaction.description ?? '',
    })
    setShowForm(true)
  }

  const buildPayload = () => ({
    type: form.type,
    category: form.category || null,
    amount: Number(form.amount),
    date: form.date,
    project_id: form.project_id || null,
    client_id: form.client_id || null,
    description: form.description || null,
  })

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await transactionsApi.updateTransaction(editing.id, buildPayload())
      } else {
        await transactionsApi.createTransaction(buildPayload())
      }
      setShowForm(false)
      await load()
    } catch {
      setError('Failed to save transaction')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (transaction: Transaction) => {
    if (!window.confirm('Delete this transaction?')) return
    setError('')
    try {
      await transactionsApi.deleteTransaction(transaction.id)
      await load()
    } catch {
      setError('Failed to delete transaction')
    }
  }

  const columns: Column<Transaction>[] = [
    { key: 'date', label: 'Date', render: (t) => t.date },
    { key: 'type', label: 'Type', render: (t) => t.type },
    {
      key: 'category',
      label: 'Category',
      render: (t) => t.category ?? '—',
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (t) =>
        `${t.type === 'income' ? '+' : '−'}$${Number(t.amount).toFixed(2)}`,
    },
    {
      key: 'project',
      label: 'Project',
      render: (t) => t.project?.name ?? '—',
    },
    {
      key: 'client',
      label: 'Client',
      render: (t) => t.client?.name ?? '—',
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (t) => (
        <div className="row-actions">
          <button type="button" onClick={() => openEdit(t)}>
            Edit
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => handleDelete(t)}
          >
            Delete
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <h1>Transactions</h1>
        <button type="button" onClick={openCreate}>
          New transaction
        </button>
      </div>

      <div className="filters">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={filterFrom}
          onChange={(e) => setFilterFrom(e.target.value)}
        />
        <input
          type="date"
          value={filterTo}
          onChange={(e) => setFilterTo(e.target.value)}
        />
      </div>

      <div className="totals">
        <div className="total-card income">
          <span>Income</span>
          <strong>+${totals.income.toFixed(2)}</strong>
        </div>
        <div className="total-card expense">
          <span>Expenses</span>
          <strong>−${totals.expense.toFixed(2)}</strong>
        </div>
        <div className="total-card net">
          <span>Net</span>
          <strong>${totals.net.toFixed(2)}</strong>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="empty">Loading...</p>
      ) : (
        <Table columns={columns} rows={transactions} rowKey={(t) => t.id} />
      )}

      {showForm && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleSubmit}>
            <h2>{editing ? 'Edit transaction' : 'New transaction'}</h2>
            <label>
              Type
              <select
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as TransactionType })
                }
              >
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </label>
            <label>
              Category
              <input
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value })
                }
                placeholder="e.g. Freelance, Software, Office"
              />
            </label>
            <label>
              Amount
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) =>
                  setForm({ ...form, amount: e.target.value })
                }
                required
              />
            </label>
            <label>
              Date
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </label>
            <label>
              Project
              <select
                value={form.project_id}
                onChange={(e) =>
                  setForm({ ...form, project_id: e.target.value })
                }
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Client
              <select
                value={form.client_id}
                onChange={(e) =>
                  setForm({ ...form, client_id: e.target.value })
                }
              >
                <option value="">None</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Description
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>
            <div className="modal-actions">
              <button type="button" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
