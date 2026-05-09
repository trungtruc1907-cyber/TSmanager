import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { Project, Customer, SalesPerson } from '../types';
import { 
  Sun, 
  ArrowUpRight, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  TrendingUp,
  Wallet,
  UserCheck
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';

interface Props {
  onOpenProject: (id: string) => void;
  showAll?: boolean;
}

export default function ProjectDashboard({ onOpenProject, showAll }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [salesStaff, setSalesStaff] = useState<SalesPerson[]>([]);

  useEffect(() => {
    const q = showAll 
      ? query(collection(db, 'projects'), orderBy('updatedAt', 'desc'))
      : query(collection(db, 'projects'), orderBy('updatedAt', 'desc'), limit(5));
      
    return onSnapshot(q, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
    });
  }, [showAll]);

  useEffect(() => {
    onSnapshot(collection(db, 'sales'), (s) => setSalesStaff(s.docs.map(d => ({ id: d.id, ...d.data() } as SalesPerson))));
    return onSnapshot(collection(db, 'customers'), (snapshot) => {
      const data: Record<string, Customer> = {};
      snapshot.docs.forEach(doc => {
        data[doc.id] = { id: doc.id, ...doc.data() } as Customer;
      });
      setCustomers(data);
    });
  }, []);

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'lead': return { label: 'Tiềm năng', color: 'bg-slate-100 text-slate-600', icon: Clock };
      case 'survey': return { label: 'Khảo sát', color: 'bg-blue-100 text-blue-600', icon: Sun };
      case 'proposal': return { label: 'Báo giá', color: 'bg-amber-100 text-amber-600', icon: Sun };
      case 'contract': return { label: 'Hợp đồng', color: 'bg-indigo-100 text-indigo-600', icon: CheckCircle2 };
      case 'installation': return { label: 'Thi công', color: 'bg-purple-100 text-purple-600', icon: Sun };
      case 'completed': return { label: 'Hoàn tất', color: 'bg-green-100 text-green-600', icon: CheckCircle2 };
      default: return { label: status, color: 'bg-slate-100 text-slate-600', icon: Clock };
    }
  };

  const totalCapacity = projects.reduce((acc, p) => acc + (p.systemSizeKWp || 0), 0);
  const totalValue = projects.reduce((acc, p) => acc + (p.totalCost || 0), 0);

  return (
    <div className="space-y-8">
      {/* Stats Overview */}
      {!showAll && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            label="Tổng công suất" 
            value={`${totalCapacity.toFixed(1)} kWp`} 
            icon={<Sun className="h-5 w-5" />}
            color="bg-slate-900 border-slate-800"
            textColor="text-amber-400"
          />
          <StatCard 
            label="Giá trị dự án" 
            value={formatCurrency(totalValue)} 
            icon={<TrendingUp className="h-5 w-5" />}
            color="bg-white border-slate-200"
            textColor="text-slate-900"
          />
          <StatCard 
            label="Hoàn vốn trung bình" 
            value="4.5 năm" 
            icon={<Wallet className="h-5 w-5" />}
            color="bg-white border-slate-200"
            textColor="text-slate-900"
          />
          <StatCard 
            label="Dự án đang chạy" 
            value={projects.length.toString()} 
            icon={<Clock className="h-5 w-5" />}
            color="bg-white border-slate-200"
            textColor="text-slate-900"
          />
        </div>
      )}

      {/* Projects List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-xs uppercase tracking-widest text-slate-400">
            {showAll ? 'Danh sách Toàn bộ Dự án' : 'Dự án Gần đây'}
          </h3>
          <button className="text-blue-600 text-[10px] uppercase font-bold tracking-wider hover:underline">
            Tất cả báo cáo
          </button>
        </div>
        
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-[10px] uppercase tracking-widest font-bold">
                <th className="px-6 py-3">Khách hàng / Địa điểm</th>
                <th className="px-6 py-3">Sale phụ trách</th>
                <th className="px-6 py-3">Trạng thái</th>
                <th className="px-6 py-3">Hệ thống</th>
                <th className="px-6 py-3">Giá trị</th>
                <th className="px-6 py-3 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.map((project) => {
                const customer = customers[project.customerId];
                const status = getStatusInfo(project.status);
                const salesRep = salesStaff.find(s => s.id === project.assignedSalesId || s.id === customer?.assignedSalesId);
                return (
                  <tr key={project.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-bold text-sm text-slate-800">{customer?.name || 'Ẩn danh'}</div>
                        <div className="text-[11px] text-slate-400 font-medium">{customer?.address || 'Chưa có địa chỉ'}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {salesRep ? (
                        <div className="flex items-center gap-2 text-blue-600">
                          <UserCheck className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-bold uppercase">{salesRep.name}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider italic">Chưa bàn giao</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider", status.color)}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-xs text-slate-700">{project.systemSizeKWp} kWp</div>
                      <div className="text-[10px] text-slate-400 uppercase font-medium">{project.panels?.count || 0} PV Panels</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-sm text-slate-900">{formatCurrency(project.totalCost || 0)}</div>
                      <div className="text-[10px] text-green-600 font-bold uppercase">ROI: 22.4%</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => onOpenProject(project.id)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-600 text-[10px] font-bold uppercase rounded transition-all"
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                );
              })}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-xs font-medium italic">
                    Chưa có dự án nào được tạo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-slate-100">
          {projects.map((project) => {
            const customer = customers[project.customerId];
            const status = getStatusInfo(project.status);
            return (
              <div key={project.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-sm text-slate-800">{customer?.name || 'Ẩn danh'}</div>
                    <div className="text-[10px] text-slate-400 font-medium">{customer?.address || 'Chưa địa chỉ'}</div>
                  </div>
                  <span className={cn("px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider", status.color)}>
                    {status.label}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-slate-50 p-2 rounded">
                    <p className="text-slate-400 font-bold uppercase text-[8px] mb-1">Hệ thống</p>
                    <p className="font-bold text-slate-800">{project.systemSizeKWp} kWp</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded">
                    <p className="text-slate-400 font-bold uppercase text-[8px] mb-1">Giá trị</p>
                    <p className="font-bold text-slate-800">{formatCurrency(project.totalCost || 0)}</p>
                  </div>
                </div>

                <button 
                  onClick={() => onOpenProject(project.id)}
                  className="w-full py-2 bg-slate-900 text-white text-[10px] font-bold uppercase rounded-lg shadow-sm"
                >
                  Xem chi tiết Dự án
                </button>
              </div>
            );
          })}
          {projects.length === 0 && (
            <div className="px-6 py-12 text-center text-slate-400 text-xs font-medium italic uppercase tracking-widest">
              Không tìm thấy dự án
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, textColor }: { label: string, value: string, icon: React.ReactNode, color: string, textColor: string }) {
  return (
    <div className={cn("p-5 rounded-xl border shadow-sm", color)}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">{label}</span>
        <div className={cn("opacity-40", textColor)}>{icon}</div>
      </div>
      <div className={cn("text-xl font-black tracking-tight", textColor)}>{value}</div>
    </div>
  );
}

function ClipboardList({ className }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>
}
