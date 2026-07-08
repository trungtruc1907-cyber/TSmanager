export type { Equipment } from '../../types';

export interface WarehouseTab {
  id: string;
  label: string;
  icon?: string;
  closable?: boolean;
  isCloseable?: boolean;
  type?: 'static' | 'dynamic';
  docType?: 'pn' | 'px' | 'dexuat' | 'muahang';
  documentType?: 'pn' | 'px' | 'dexuat' | 'muahang';
  docId?: string;
}

export interface MaterialRequest {
  id: string;
  projectId: string;
  projectName: string;
  technicianId: string;
  technicianName: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  items: Array<{
    equipmentId: string;
    brand: string;
    model: string;
    type: string;
    quantity: number;
    unit: string;
  }>;
  adminNote?: string;
}

export interface PurchaseProposal {
  id: string;
  items: Array<{
    equipmentId: string;
    brand: string;
    model: string;
    type: string;
    quantity: number;
    unitPrice: number;
    unit: string;
  }>;
  supplierId: string;
  supplierName: string;
  totalCost: number;
  status: 'pending' | 'approved' | 'ordering' | 'completed' | 'cancelled';
  createdAt: any;
  reason: string;
  adminNote?: string;
}

export interface InventoryTransaction {
  id: string; // e.g. PN000235, PX000124
  type: 'import' | 'export';
  date: string;
  createdAt: any;
  partnerId: string; // Supplier ID or Project ID
  partnerName: string; // Supplier name or Project/Client name
  items: Array<{
    equipmentId: string;
    brand: string;
    model: string;
    type: string;
    quantity: number;
    unitPrice: number;
    unit: string;
  }>;
  totalValue: number;
  paidAmount?: number;
  debtAmount?: number;
  note?: string;
  createdBy: string;
  createdByName: string;
}

export interface WarehouseSupplier {
  id: string;
  name: string;
  contactName?: string;
  phone: string;
  email?: string;
  address?: string;
  debt: number;
  createdAt: any;
}
