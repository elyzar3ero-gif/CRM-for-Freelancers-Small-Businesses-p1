import api from './axios'
import type { Lead, LeadPayload } from '../types'

export async function fetchLeads(search?: string): Promise<Lead[]> {
  const { data } = await api.get<Lead[]>('/leads', {
    params: search ? { search } : undefined,
  })
  return data
}

export async function createLead(payload: LeadPayload): Promise<Lead> {
  const { data } = await api.post<Lead>('/leads', payload)
  return data
}

export async function updateLead(
  id: string,
  payload: LeadPayload,
): Promise<Lead> {
  const { data } = await api.put<Lead>(`/leads/${id}`, payload)
  return data
}

export async function deleteLead(id: string): Promise<void> {
  await api.delete(`/leads/${id}`)
}

export async function moveLead(leadId: string, stageId: string): Promise<Lead> {
  const { data } = await api.put<Lead>(`/leads/${leadId}/move`, {
    stage_id: stageId,
  })
  return data
}

export async function convertLead(leadId: string): Promise<Lead> {
  const { data } = await api.post<Lead>(`/leads/${leadId}/convert`)
  return data
}
