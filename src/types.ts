export type ProjectStatus = 'lead' | 'survey' | 'proposal' | 'contract' | 'installation' | 'completed';
export type UsageType = 'residential' | 'commercial' | 'industrial';
export type PhaseType = '1phase' | '3phase';

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
  monthlyBill: number;
  systemSizeKWp: number;
  assignedSalesId?: string;
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

export interface SalesTask {
  id: string;
  projectId: string;
  assignedSalesId?: string;
  title: string;
  description: string;
  dueDate: any;
  status: 'pending' | 'completed';
}
