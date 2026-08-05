import api from './axios'
import type { Project, ProjectPayload } from '../types'

export interface ProjectFilters {
  client_id?: string
  status?: string
}

export async function fetchProjects(filters?: ProjectFilters): Promise<Project[]> {
  const { data } = await api.get<Project[]>('/projects', { params: filters })
  return data
}

export async function createProject(payload: ProjectPayload): Promise<Project> {
  const { data } = await api.post<Project>('/projects', payload)
  return data
}

export async function updateProject(
  id: string,
  payload: Partial<ProjectPayload>,
): Promise<Project> {
  const { data } = await api.put<Project>(`/projects/${id}`, payload)
  return data
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(`/projects/${id}`)
}
