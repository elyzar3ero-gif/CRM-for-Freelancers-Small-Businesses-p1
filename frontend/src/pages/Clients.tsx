import { useCallback, useEffect, useState, type FormEvent } from 'react'
import * as clientsApi from '../api/clients'
import Table, { type Column } from '../components/Table'
import type { Client } from '../types'

const emptyForm = { name: '', email: '', phone: '', company: '', notes: '' }

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (query: string = '') => {
    setLoading(true)
    setError('')
    try {
      setClients(await clientsApi.fetchClients(query || undefined))
    } catch {
      setError('Failed to load clients')
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

  const openEdit = (client: Client) => {
    setEditing(client)
    setForm({
      name: client.name,
      email: client.email ?? '',
      phone: client.phone ?? '',
      company: client.company ?? '',
      notes: client.notes ?? '',
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
        company: form.company || null,
        notes: form.notes || null,
      }
      if (editing) {
        await clientsApi.updateClient(editing.id, payload)
      } else {
        await clientsApi.createClient(payload)
      }
      setShowForm(false)
      await load(search)
    } catch {
      setError('Failed to save client')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (client: Client) => {
    if (!window.confirm(`Delete client "${client.name}"?`)) return
    try {
      await clientsApi.deleteClient(client.id)
      await load(search)
    } catch {
      setError('Failed to delete client')
    }
  }

  const columns: Column<Client>[] = [
    { key: 'name', label: 'Name', render: (c) => c.name },
    { key: 'email', label: 'Email', render: (c) => c.email ?? '—' },
    { key: 'phone', label: 'Phone', render: (c) => c.phone ?? '—' },
    { key: 'company', label: 'Company', render: (c) => c.company ?? '—' },
    { key: 'notes', label: 'Notes', render: (c) => c.notes ?? '—' },
    {
      key: 'actions',
      label: 'Actions',
      render: (c) => (
        <div className="row-actions">
          <button type="button" onClick={() => openEdit(c)}>
            Edit
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => handleDelete(c)}
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
        <h1>Clients</h1>
        <button type="button" onClick={openCreate}>
          New client
        </button>
      </div>

      <input
        className="search"
        placeholder="Search by name, email or company..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="empty">Loading...</p>
      ) : (
        <Table columns={columns} rows={clients} rowKey={(c) => c.id} />
      )}

      {showForm && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleSubmit}>
            <h2>{editing ? 'Edit client' : 'New client'}</h2>
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
              Company
              <input
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
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
