import { useCallback, useEffect, useState, type FormEvent } from 'react'
import * as projectsApi from '../api/projects'
import * as clientsApi from '../api/clients'
import Table, { type Column } from '../components/Table'
import type { Client, Project, ProjectStatus } from '../types'

const PROJECT_STATUSES: ProjectStatus[] = [
  'planned',
  'in_progress',
  'completed',
  'cancelled',
]

const emptyForm = {
  name: '',
  client_id: '',
  status: 'planned' as ProjectStatus,
  description: '',
  start_date: '',
  estimated_end_date: '',
  actual_end_date: '',
  total_value: '',
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [filterClient, setFilterClient] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setProjects(
        await projectsApi.fetchProjects({
          client_id: filterClient || undefined,
          status: filterStatus || undefined,
        }),
      )
    } catch {
      setError('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [filterClient, filterStatus])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    clientsApi
      .fetchClients()
      .then(setClients)
      .catch(() => {
        setError('Failed to load clients')
      })
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (project: Project) => {
    setEditing(project)
    setForm({
      name: project.name,
      client_id: project.client_id,
      status: project.status,
      description: project.description ?? '',
      start_date: project.start_date ?? '',
      estimated_end_date: project.estimated_end_date ?? '',
      actual_end_date: project.actual_end_date ?? '',
      total_value: project.total_value?.toString() ?? '',
    })
    setShowForm(true)
  }

  const buildPayload = () => ({
    name: form.name,
    client_id: form.client_id,
    status: form.status,
    description: form.description || null,
    start_date: form.start_date || null,
    estimated_end_date: form.estimated_end_date || null,
    actual_end_date: form.actual_end_date || null,
    total_value: form.total_value ? Number(form.total_value) : null,
  })

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await projectsApi.updateProject(editing.id, buildPayload())
      } else {
        await projectsApi.createProject(buildPayload())
      }
      setShowForm(false)
      await load()
    } catch {
      setError('Failed to save project')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (
    project: Project,
    status: ProjectStatus,
  ) => {
    if (status === project.status) return
    setError('')
    try {
      await projectsApi.updateProject(project.id, { status })
      await load()
    } catch {
      setError('Failed to update project status')
    }
  }

  const handleDelete = async (project: Project) => {
    if (!window.confirm(`Delete project "${project.name}"?`)) return
    setError('')
    try {
      await projectsApi.deleteProject(project.id)
      await load()
    } catch {
      setError('Failed to delete project')
    }
  }

  const columns: Column<Project>[] = [
    { key: 'name', label: 'Name', render: (p) => p.name },
    {
      key: 'client',
      label: 'Client',
      render: (p) => p.client?.name ?? '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (p) => (
        <select
          className="status-select"
          value={p.status}
          onChange={(e) =>
            handleStatusChange(p, e.target.value as ProjectStatus)
          }
        >
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'value',
      label: 'Value',
      render: (p) =>
        p.total_value != null
          ? `$${Number(p.total_value).toFixed(2)}`
          : '—',
    },
    {
      key: 'dates',
      label: 'Dates',
      render: (p) =>
        [p.start_date, p.estimated_end_date ?? p.actual_end_date]
          .filter(Boolean)
          .join(' → ') || '—',
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (p) => (
        <div className="row-actions">
          <button type="button" onClick={() => openEdit(p)}>
            Edit
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => handleDelete(p)}
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
        <h1>Projects</h1>
        <button type="button" onClick={openCreate}>
          New project
        </button>
      </div>

      <div className="filters">
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
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="empty">Loading...</p>
      ) : (
        <Table columns={columns} rows={projects} rowKey={(p) => p.id} />
      )}

      {showForm && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleSubmit}>
            <h2>{editing ? 'Edit project' : 'New project'}</h2>
            <label>
              Name
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            <label>
              Client
              <select
                value={form.client_id}
                onChange={(e) =>
                  setForm({ ...form, client_id: e.target.value })
                }
                required
              >
                <option value="" disabled>
                  Select a client
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as ProjectStatus })
                }
              >
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
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
            <label>
              Start date
              <input
                type="date"
                value={form.start_date}
                onChange={(e) =>
                  setForm({ ...form, start_date: e.target.value })
                }
              />
            </label>
            <label>
              Estimated end date
              <input
                type="date"
                value={form.estimated_end_date}
                onChange={(e) =>
                  setForm({ ...form, estimated_end_date: e.target.value })
                }
              />
            </label>
            <label>
              Actual end date
              <input
                type="date"
                value={form.actual_end_date}
                onChange={(e) =>
                  setForm({ ...form, actual_end_date: e.target.value })
                }
              />
            </label>
            <label>
              Total value
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.total_value}
                onChange={(e) =>
                  setForm({ ...form, total_value: e.target.value })
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
