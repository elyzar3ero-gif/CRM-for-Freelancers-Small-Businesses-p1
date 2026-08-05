import api from './axios'
import type { Client, ClientPayload } from '../types'

export async function fetchClients(search?: string): Promise<Client[]> {
  const { data } = await api.get<Client[]>('/clients', {
    params: search ? { search } : undefined,
  })
  return data
}

export async function createClient(payload: ClientPayload): Promise<Client> {
  const { data } = await api.post<Client>('/clients', payload)
  return data
}

export async function updateClient(
  id: string,
  payload: ClientPayload,
): Promise<Client> {
  const { data } = await api.put<Client>(`/clients/${id}`, payload)
  return data
}

export async function deleteClient(id: string): Promise<void> {
  await api.delete(`/clients/${id}`)
}
