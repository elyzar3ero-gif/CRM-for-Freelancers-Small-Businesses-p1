import api from './axios'
import type { Transaction, TransactionPayload } from '../types'

export interface TransactionFilters {
  project_id?: string
  client_id?: string
  type?: string
  date_from?: string
  date_to?: string
}

export async function fetchTransactions(
  filters?: TransactionFilters,
): Promise<Transaction[]> {
  const { data } = await api.get<Transaction[]>('/transactions', {
    params: filters,
  })
  return data
}

export async function createTransaction(
  payload: TransactionPayload,
): Promise<Transaction> {
  const { data } = await api.post<Transaction>('/transactions', payload)
  return data
}

export async function updateTransaction(
  id: string,
  payload: Partial<TransactionPayload>,
): Promise<Transaction> {
  const { data } = await api.put<Transaction>(`/transactions/${id}`, payload)
  return data
}

export async function deleteTransaction(id: string): Promise<void> {
  await api.delete(`/transactions/${id}`)
}
