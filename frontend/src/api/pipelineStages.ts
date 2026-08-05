import api from './axios'
import type { PipelineStage, PipelineStagePayload } from '../types'

export async function fetchPipelineStages(): Promise<PipelineStage[]> {
  const { data } = await api.get<PipelineStage[]>('/pipeline-stages')
  return data
}

export async function createPipelineStage(
  payload: PipelineStagePayload,
): Promise<PipelineStage> {
  const { data } = await api.post<PipelineStage>('/pipeline-stages', payload)
  return data
}

export async function updatePipelineStage(
  id: string,
  payload: PipelineStagePayload,
): Promise<PipelineStage> {
  const { data } = await api.put<PipelineStage>(`/pipeline-stages/${id}`, payload)
  return data
}

export async function deletePipelineStage(id: string): Promise<void> {
  await api.delete(`/pipeline-stages/${id}`)
}
