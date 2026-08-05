import api from './axios'
import type { Invoice, InvoicePayload } from '../types'

export async function fetchInvoices(): Promise<Invoice[]> {
  const { data } = await api.get<Invoice[]>('/invoices')
  return data
}

export async function fetchInvoice(id: string): Promise<Invoice> {
  const { data } = await api.get<Invoice>(`/invoices/${id}`)
  return data
}

export async function createInvoice(
  payload: InvoicePayload,
): Promise<Invoice> {
  const { data } = await api.post<Invoice>('/invoices', payload)
  return data
}

export async function updateInvoice(
  id: string,
  payload: Partial<InvoicePayload>,
): Promise<Invoice> {
  const { data } = await api.put<Invoice>(`/invoices/${id}`, payload)
  return data
}

export async function deleteInvoice(id: string): Promise<void> {
  await api.delete(`/invoices/${id}`)
}

export async function downloadInvoicePdf(id: string, filename: string): Promise<void> {
  const response = await api.get(`/invoices/${id}/pdf`, {
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
