import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import * as invoicesApi from '../api/invoices'
import * as clientsApi from '../api/clients'
import * as projectsApi from '../api/projects'
import Table, { type Column } from '../components/Table'
import type {
  Client,
  Invoice,
  InvoiceItemInput,
  InvoiceStatus,
  Project,
} from '../types'

const today = new Date().toISOString().slice(0, 10)

interface ItemRow {
  description: string
  quantity: string
  unit_price: string
}

const emptyItem: ItemRow = { description: '', quantity: '1', unit_price: '' }

function emptyForm() {
  return {
    client_id: '',
    project_id: '',
    issue_date: today,
    due_date: '',
    tax_rate: '0',
    items: [{ ...emptyItem }] as ItemRow[],
  }
}

function parseItem(item: ItemRow): InvoiceItemInput | null {
  const description = item.description.trim()
  const quantity = Number(item.quantity)
  const unitPrice = Number(item.unit_price)
  if (!description || !Number.isFinite(quantity) || !Number.isFinite(unitPrice)) {
    return null
  }
  return { description, quantity, unit_price: unitPrice }
}

function itemTotal(item: ItemRow): number {
  const quantity = Number(item.quantity) || 0
  const unitPrice = Number(item.unit_price) || 0
  return quantity * unitPrice
}

function formatMoney(value: number): string {
  return `$${Number(value).toFixed(2)}`
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Invoice | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setInvoices(await invoicesApi.fetchInvoices())
    } catch {
      setError('Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }, [])

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
    const subtotal = form.items.reduce((sum, item) => sum + itemTotal(item), 0)
    const taxRate = Number(form.tax_rate) || 0
    const tax = (subtotal * taxRate) / 100
    return { subtotal, tax, total: subtotal + tax }
  }, [form.items, form.tax_rate])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setShowForm(true)
  }

  const openEdit = (invoice: Invoice) => {
    setEditing(invoice)
    setForm({
      client_id: invoice.client_id,
      project_id: invoice.project_id ?? '',
      issue_date: invoice.issue_date,
      due_date: invoice.due_date ?? '',
      tax_rate: invoice.tax_rate.toString(),
      items: invoice.items.map((item) => ({
        description: item.description,
        quantity: item.quantity.toString(),
        unit_price: item.unit_price.toString(),
      })),
    })
    setShowForm(true)
  }

  const updateItem = (index: number, patch: Partial<ItemRow>) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }))
  }

  const addItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, { ...emptyItem }] }))
  }

  const removeItem = (index: number) => {
    setForm((prev) => ({
      ...prev,
      items:
        prev.items.length > 1
          ? prev.items.filter((_, i) => i !== index)
          : [{ ...emptyItem }],
    }))
  }

  const buildPayload = () => {
    const items = form.items
      .map(parseItem)
      .filter((item): item is InvoiceItemInput => item !== null)
    return {
      client_id: form.client_id,
      project_id: form.project_id || null,
      issue_date: form.issue_date || null,
      due_date: form.due_date || null,
      tax_rate: Number(form.tax_rate) || 0,
      status: editing?.status ?? ('draft' as InvoiceStatus),
      items,
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = buildPayload()
      if (editing) {
        await invoicesApi.updateInvoice(editing.id, payload)
      } else {
        await invoicesApi.createInvoice(payload)
      }
      setShowForm(false)
      await load()
    } catch {
      setError('Failed to save invoice')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (invoice: Invoice) => {
    if (!window.confirm(`Delete invoice ${invoice.invoice_number}?`)) return
    setError('')
    try {
      await invoicesApi.deleteInvoice(invoice.id)
      await load()
    } catch {
      setError('Failed to delete invoice')
    }
  }

  const handleDownload = async (invoice: Invoice) => {
    setError('')
    setNotice('')
    setDownloadingId(invoice.id)
    try {
      await invoicesApi.downloadInvoicePdf(
        invoice.id,
        `${invoice.invoice_number}.pdf`,
      )
    } catch {
      setError('Failed to download invoice PDF')
    } finally {
      setDownloadingId(null)
    }
  }

  const columns: Column<Invoice>[] = [
    {
      key: 'invoice_number',
      label: 'Invoice',
      render: (i) => i.invoice_number,
    },
    { key: 'client', label: 'Client', render: (i) => i.client?.name ?? '—' },
    {
      key: 'issue_date',
      label: 'Date',
      render: (i) => i.issue_date,
    },
    {
      key: 'status',
      label: 'Status',
      render: (i) => i.status,
    },
    {
      key: 'total',
      label: 'Total',
      render: (i) => formatMoney(i.total),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (i) => (
        <div className="row-actions">
          <button
            type="button"
            disabled={downloadingId === i.id}
            onClick={() => handleDownload(i)}
          >
            {downloadingId === i.id ? '...' : 'Download PDF'}
          </button>
          <button type="button" onClick={() => openEdit(i)}>
            Edit
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => handleDelete(i)}
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
        <h1>Invoices</h1>
        <button type="button" onClick={openCreate}>
          New invoice
        </button>
      </div>

      {notice && <p className="notice">{notice}</p>}
      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="empty">Loading...</p>
      ) : (
        <Table columns={columns} rows={invoices} rowKey={(i) => i.id} />
      )}

      {showForm && (
        <div className="modal-backdrop">
          <form className="modal modal-lg" onSubmit={handleSubmit}>
            <h2>{editing ? 'Edit invoice' : 'New invoice'}</h2>

            <div className="form-grid">
              <label>
                Client
                <select
                  value={form.client_id}
                  onChange={(e) =>
                    setForm({ ...form, client_id: e.target.value })
                  }
                  required
                >
                  <option value="">Select a client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
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
                Issue date
                <input
                  type="date"
                  value={form.issue_date}
                  onChange={(e) =>
                    setForm({ ...form, issue_date: e.target.value })
                  }
                  required
                />
              </label>
              <label>
                Due date
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) =>
                    setForm({ ...form, due_date: e.target.value })
                  }
                />
              </label>
              <label>
                Tax rate (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.tax_rate}
                  onChange={(e) =>
                    setForm({ ...form, tax_rate: e.target.value })
                  }
                />
              </label>
            </div>

            <div className="invoice-items">
              <div className="invoice-items-header">
                <span>Description</span>
                <span>Qty</span>
                <span>Unit price</span>
                <span>Total</span>
                <span />
              </div>
              {form.items.map((item, index) => (
                <div className="invoice-item-row" key={index}>
                  <input
                    value={item.description}
                    onChange={(e) =>
                      updateItem(index, { description: e.target.value })
                    }
                    placeholder="Description"
                    required
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(index, { quantity: e.target.value })
                    }
                    required
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) =>
                      updateItem(index, { unit_price: e.target.value })
                    }
                    required
                  />
                  <span className="invoice-item-line-total">
                    {formatMoney(itemTotal(item))}
                  </span>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => removeItem(index)}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" onClick={addItem}>
                + Add item
              </button>
            </div>

            <div className="invoice-totals">
              <div className="invoice-total-row">
                <span>Subtotal</span>
                <strong>{formatMoney(totals.subtotal)}</strong>
              </div>
              <div className="invoice-total-row">
                <span>Tax</span>
                <strong>{formatMoney(totals.tax)}</strong>
              </div>
              <div className="invoice-total-row invoice-total-grand">
                <span>Total</span>
                <strong>{formatMoney(totals.total)}</strong>
              </div>
            </div>

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
