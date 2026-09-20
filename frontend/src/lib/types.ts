export interface User {
  id: string
  email: string
  role: 'USER' | 'ADMIN'
  createdAt: string
}

export interface Dashboard {
  id: string
  userId: string
  name: string
  description: string | null
  isPublic: boolean
  createdAt: string
  updatedAt: string
  _count?: { dataPoints: number }
  dataPointsCount?: number
}

export interface DataPoint {
  id: string
  dashboardId: string
  label: string
  value: number
  timestamp: string
}

export interface ReportDashboardStats {
  dashboardId: string
  name: string
  dataPoints: number
  sum: number
  avg: number | null
  min: number | null
  max: number | null
}

export interface ReportData {
  period: { from: string | null; to: string | null }
  summary: { dashboards: number; dataPoints: number; totalValue: number }
  dashboards: ReportDashboardStats[]
}

export interface Report {
  id: string
  userId: string
  name: string
  generatedAt: string
  data?: ReportData
}

export interface PageMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface Envelope<T> {
  data: T
  meta?: PageMeta
}
