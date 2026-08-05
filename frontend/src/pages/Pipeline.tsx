import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from '@hello-pangea/dnd'
import * as stagesApi from '../api/pipelineStages'
import * as leadsApi from '../api/leads'
import type { Lead, PipelineStage } from '../types'

function formatValue(value: number | null): string {
  return value != null ? `$${Number(value).toFixed(2)}` : '—'
}

function isFinalStage(stage: PipelineStage, stages: PipelineStage[]): boolean {
  const highestOrder = Math.max(...stages.map((s) => s.order))
  return stage.order === highestOrder || /^(won|ganado)$/i.test(stage.name.trim())
}

export default function Pipeline() {
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [stageNames, setStageNames] = useState<Record<string, string>>({})
  const [newStageName, setNewStageName] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingStage, setSavingStage] = useState<string | null>(null)
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [stageData, leadData] = await Promise.all([
        stagesApi.fetchPipelineStages(),
        leadsApi.fetchLeads(),
      ])
      setStages(stageData)
      setLeads(leadData)
      setStageNames(Object.fromEntries(stageData.map((s) => [s.id, s.name])))
    } catch {
      setError('Failed to load pipeline')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.order - b.order),
    [stages],
  )

  const leadsByStage = useMemo(() => {
    const map: Record<string, Lead[]> = {}
    for (const stage of sortedStages) map[stage.id] = []
    for (const lead of leads) {
      if (lead.current_stage_id && map[lead.current_stage_id]) {
        map[lead.current_stage_id].push(lead)
      }
    }
    return map
  }, [sortedStages, leads])

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination || destination.droppableId === source.droppableId) return

    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === draggableId
          ? { ...lead, current_stage_id: destination.droppableId }
          : lead,
      ),
    )
    try {
      await leadsApi.moveLead(draggableId, destination.droppableId)
    } catch {
      setError('Failed to move lead')
      await load()
    }
  }

  const handleConvert = async (lead: Lead) => {
    setError('')
    setNotice('')
    setConvertingId(lead.id)
    try {
      const converted = await leadsApi.convertLead(lead.id)
      setLeads((prev) =>
        prev.map((l) => (l.id === converted.id ? converted : l)),
      )
      setNotice(`"${lead.name}" converted to client`)
    } catch {
      setError('Failed to convert lead to client')
    } finally {
      setConvertingId(null)
    }
  }

  const handleAddStage = async (event: FormEvent) => {    event.preventDefault()
    const name = newStageName.trim()
    if (!name) return
    setError('')
    try {
      await stagesApi.createPipelineStage({ name })
      setNewStageName('')
      await load()
    } catch {
      setError('Failed to add stage')
    }
  }

  const handleRenameStage = async (stage: PipelineStage, next: string) => {
    const name = next.trim()
    if (!name || name === stage.name) return
    setError('')
    setSavingStage(stage.id)
    try {
      await stagesApi.updatePipelineStage(stage.id, { name })
      await load()
    } catch {
      setError('Failed to rename stage')
    } finally {
      setSavingStage(null)
    }
  }

  const handleReorderStage = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= sortedStages.length) return
    const updated = [...sortedStages]
    ;[updated[index], updated[target]] = [updated[target], updated[index]]
    const reordered = updated.map((stage, i) => ({ ...stage, order: i }))
    setStages(reordered)
    setStageNames(Object.fromEntries(reordered.map((s) => [s.id, s.name])))
    try {
      for (const stage of reordered) {
        await stagesApi.updatePipelineStage(stage.id, { order: stage.order })
      }
    } catch {
      setError('Failed to reorder stages')
      await load()
    }
  }

  const handleDeleteStage = async (stage: PipelineStage) => {
    if (
      !window.confirm(
        `Delete stage "${stage.name}"? Leads in this stage will be unassigned.`,
      )
    )
      return
    setError('')
    try {
      await stagesApi.deletePipelineStage(stage.id)
      await load()
    } catch {
      setError('Failed to delete stage')
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Pipeline</h1>
      </div>

      {notice && <p className="notice">{notice}</p>}
      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="empty">Loading...</p>
      ) : sortedStages.length === 0 ? (
        <p className="empty">
          No pipeline stages yet. Create stages below to get started.
        </p>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="board">
            {sortedStages.map((stage) => (
              <Droppable droppableId={stage.id} key={stage.id}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="board-column"
                  >
                    <div className="board-column-header">
                      <span>{stage.name}</span>
                      <span className="board-column-count">
                        {leadsByStage[stage.id].length}
                      </span>
                    </div>
                    <div className="board-column-body">
                      {leadsByStage[stage.id].map((lead, index) => (
                        <Draggable
                          draggableId={lead.id}
                          index={index}
                          key={lead.id}
                        >
                          {(dragProvided) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className="lead-card"
                            >
                              <div className="lead-card-name">{lead.name}</div>
                              <div className="lead-card-value">
                                {formatValue(lead.estimated_value)}
                              </div>
                              {isFinalStage(stage, sortedStages) &&
                                (lead.client_converted_id ? (
                                  <div className="lead-card-converted">
                                    Converted to client
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    className="lead-card-convert"
                                    disabled={convertingId === lead.id}
                                    onClick={() => handleConvert(lead)}
                                  >
                                    {convertingId === lead.id
                                      ? 'Converting...'
                                      : 'Convert to Client'}
                                  </button>
                                ))}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      )}

      <section className="stage-manager">
        <h2>Manage stages</h2>
        {sortedStages.length === 0 && <p className="empty">No stages yet.</p>}
        <ul className="stage-list">
          {sortedStages.map((stage, index) => (
            <li className="stage-row" key={stage.id}>
              <div className="stage-actions">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => handleReorderStage(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === sortedStages.length - 1}
                  onClick={() => handleReorderStage(index, 1)}
                >
                  ↓
                </button>
              </div>
              <input
                value={stageNames[stage.id] ?? stage.name}
                disabled={savingStage === stage.id}
                onChange={(e) =>
                  setStageNames((prev) => ({
                    ...prev,
                    [stage.id]: e.target.value,
                  }))
                }
                onBlur={(e) => handleRenameStage(stage, e.target.value)}
              />
              <button
                type="button"
                className="danger"
                onClick={() => handleDeleteStage(stage)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
        <form className="stage-add" onSubmit={handleAddStage}>
          <input
            placeholder="New stage name"
            value={newStageName}
            onChange={(e) => setNewStageName(e.target.value)}
          />
          <button type="submit" disabled={!newStageName.trim()}>
            Add stage
          </button>
        </form>
      </section>
    </div>
  )
}
