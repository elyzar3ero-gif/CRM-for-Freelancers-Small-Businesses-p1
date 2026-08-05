import { useCallback, useEffect, useState, type FormEvent } from 'react'
import * as leadsApi from '../api/leads'
import Table, { type Column } from '../components/Table'
import type { Lead } from '../types'

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  source: '',
  status: 'new',
  estimated_value: '',
  notes: '',
}

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Lead | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (query: string = '') => {
    setLoading(true)
    setError('')
    try {
      setLeads(await leadsApi.fetchLeads(query || undefined))
    } catch {
      setError('Failed to load leads')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const timer = setTimeout(() => load(search), 300)
    return () => clearTimeout(timer)
  }, [search, load])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (lead: Lead) => {
    setEditing(lead)
    setForm({
      name: lead.name,
      email: lead.email ?? '',
      phone: lead.phone ?? '',
      source: lead.source ?? '',
      status: lead.status,
      estimated_value: lead.estimated_value?.toString() ?? '',
      notes: lead.notes ?? '',
    })
    setShowForm(true)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        source: form.source || null,
        status: form.status || 'new',
        estimated_value: form.estimated_value
          ? Number(form.estimated_value)
          : null,
        notes: form.notes || null,
      }
      if (editing) {
        await leadsApi.updateLead(editing.id, payload)
      } else {
        await leadsApi.createLead(payload)
      }
      setShowForm(false)
      await load(search)
    } catch {
      setError('Failed to save lead')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (lead: Lead) => {
    if (!window.confirm(`Delete lead "${lead.name}"?`)) return
    try {
      await leadsApi.deleteLead(lead.id)
      await load(search)
    } catch {
      setError('Failed to delete lead')
    }
  }

  const columns: Column<Lead>[] = [
    { key: 'name', label: 'Name', render: (l) => l.name },
    { key: 'email', label: 'Email', render: (l) => l.email ?? '—' },
    { key: 'phone', label: 'Phone', render: (l) => l.phone ?? '—' },
    { key: 'source', label: 'Source', render: (l) => l.source ?? '—' },
    { key: 'status', label: 'Status', render: (l) => l.status },
    {
      key: 'value',
      label: 'Value',
      render: (l) =>
        l.estimated_value != null
          ? `$${Number(l.estimated_value).toFixed(2)}`
          : '—',
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (l) => (
        <div className="row-actions">
          <button type="button" onClick={() => openEdit(l)}>
            Edit
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => handleDelete(l)}
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
        <h1>Leads</h1>
        <button type="button" onClick={openCreate}>
          New lead
        </button>
      </div>

      <input
        className="search"
        placeholder="Search by name, email, source or status..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="empty">Loading...</p>
      ) : (
        <Table columns={columns} rows={leads} rowKey={(l) => l.id} />
      )}

      {showForm && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleSubmit}>
            <h2>{editing ? 'Edit lead' : 'New lead'}</h2>
            <label>
              Name
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label>
              Phone
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label>
              Source
              <input
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
              />
            </label>
            <label>
              Status
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="new">new</option>
                <option value="contacted">contacted</option>
                <option value="qualified">qualified</option>
                <option value="lost">lost</option>
              </select>
            </label>
            <label>
              Estimated value
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.estimated_value}
                onChange={(e) =>
                  setForm({ ...form, estimated_value: e.target.value })
                }
              />
            </label>
            <label>
              Notes
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
