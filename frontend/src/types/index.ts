export interface User {
  id: string
  email: string
  full_name: string
  created_at: string
}

export interface Client {
  id: string
  user_id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  notes: string | null
  created_at: string
}

export interface ClientPayload {
  name: string
  email?: string | null
  phone?: string | null
  company?: string | null
  notes?: string | null
}

export interface PipelineStage {
  id: string
  user_id: string
  name: string
  order: number
}

export interface PipelineStagePayload {
  name?: string
  order?: number
}

export interface Lead {
  id: string
  user_id: string
  name: string
  email: string | null
  phone: string | null
  source: string | null
  status: string
  estimated_value: number | null
  notes: string | null
  client_converted_id: string | null
  current_stage_id: string | null
  status_changed_at: string | null
  current_stage: PipelineStage | null
  created_at: string
}

export interface LeadPayload {
  name: string
  email?: string | null
  phone?: string | null
  source?: string | null
  status?: string
  estimated_value?: number | null
  notes?: string | null
}

export type ProjectStatus =
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export interface Project {
  id: string
  user_id: string
  client_id: string
  client: Client | null
  name: string
  description: string | null
  status: ProjectStatus
  start_date: string | null
  estimated_end_date: string | null
  actual_end_date: string | null
  total_value: number | null
  created_at: string
}

export interface ProjectPayload {
  name: string
  client_id: string
  description?: string | null
  status?: ProjectStatus
  start_date?: string | null
  estimated_end_date?: string | null
  actual_end_date?: string | null
  total_value?: number | null
}

export type TransactionType = 'income' | 'expense'

export interface Transaction {
  id: string
  user_id: string
  project_id: string | null
  client_id: string | null
  type: TransactionType
  category: string | null
  amount: number
  date: string
  description: string | null
  project: Project | null
  client: Client | null
  created_at: string
}

export interface TransactionPayload {
  project_id?: string | null
  client_id?: string | null
  type: TransactionType
  category?: string | null
  amount: number
  date: string
  description?: string | null
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid'

export interface InvoiceItem {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit_price: number
  total: number
}

export interface Invoice {
  id: string
  user_id: string
  client_id: string
  project_id: string | null
  invoice_number: string
  issue_date: string
  due_date: string | null
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  status: InvoiceStatus
  pdf_file_path: string | null
  client: Client | null
  project: Project | null
  items: InvoiceItem[]
  created_at: string
}

export interface InvoiceItemInput {
  description: string
  quantity: number
  unit_price: number
}

export interface InvoicePayload {
  client_id: string
  project_id?: string | null
  invoice_number?: string | null
  issue_date?: string | null
  due_date?: string | null
  tax_rate?: number
  status?: InvoiceStatus
  items: InvoiceItemInput[]
}

export interface MonthlyIncomeItem {
  month: string
  total: number
}

export interface StageCount {
  stage_id: string
  name: string
  count: number
}

export interface DashboardData {
  income_this_month: number
  expenses_this_month: number
  active_projects: number
  leads_by_stage: StageCount[]
  monthly_income: MonthlyIncomeItem[]
  conversion_rate: number
}
