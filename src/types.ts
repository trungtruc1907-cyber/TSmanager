export type ProjectStatus = 'lead' | 'survey' | 'proposal' | 'contract' | 'installation' | 'completed';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type UsageType = 'residential' | 'commercial' | 'industrial';
export type PhaseType = '1phase' | '3phase';

export interface ProjectPhase {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed';
  progress: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  usageType?: UsageType;
  phaseType?: PhaseType;
  assignedSalesId?: string;
  createdAt: any;
}

export interface Equipment {
  id: string;
  type: 'panel' | 'inverter' | 'battery' | 'mounting' | 'accessory' | 'other';
  brand: string;
  model: string;
  capacity: number;
  unitPrice: number;
}

export interface SalesPerson {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'sales_rep' | 'sales_manager';
  createdAt: any;
}

export interface Project {
  id: string;
  customerId: string;
  status: ProjectStatus;
  currentPhase?: string;
  progress: number;
  monthlyBill: number;
  systemSizeKWp: number;
  assignedSalesId?: string;
  assignedOperatorId?: string;
  panels: {
    equipmentId: string;
    count: number;
  };
  inverters: {
    equipmentId: string;
    count: number;
  };
  batteries?: {
    equipmentId: string;
    count: number;
  };
  totalCost: number;
  annualProduction: number;
  paybackYears: number;
  updatedAt: any;
}

export type UserRole = 'admin' | 'manager' | 'sales_rep' | 'operator';

export interface AppUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  displayName: string;
  phone?: string;
  region?: string;
  createdAt: any;
  lastLogin?: any;
  status: 'active' | 'inactive' | 'pending';
}

export interface ProjectTask {
  id: string;
  projectId: string;
  assignedToId?: string;
  creatorId: string;
  title: string;
  description: string;
  phase?: string;
  dueDate: any;
  status: TaskStatus;
  createdAt: any;
  updatedAt: any;
}

export interface ProjectActivity {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  type: 'status_change' | 'task_update' | 'comment' | 'file_upload';
  description: string;
  createdAt: any;
}

export interface SalesTask {
  id: string;
  projectId: string;
  assignedSalesId?: string;
  title: string;
  description: string;
  dueDate: any;
  status: 'pending' | 'completed';
}
