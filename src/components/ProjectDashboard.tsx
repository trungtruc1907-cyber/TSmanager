import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, deleteDoc, doc, where } from 'firebase/firestore';
import { Project, Customer, AppUser, UserRole } from '../types';
import { 
  Sun, 
  ArrowUpRight, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  TrendingUp,
  Wallet,
  UserCheck,
  Trash2
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { motion } from 'motion/react';

interface Props {
  onOpenProject: (id: string) => void;
  onOpenTracker: (id: string) => void;
  showAll?: boolean;
  userRole?: UserRole;
  userId?: string;
}

export default function ProjectDashboard({ onOpenProject, onOpenTracker, showAll, userRole, userId }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [salesStaff, setSalesStaff] = useState<AppUser[]>([]);

  useEffect(() => {
    if (!userId) return;
    let q;
    if (userRole === 'sales_rep' && userId) {
      q = query(
        collection(db, 'projects'), 
        where('assignedSalesId', '==', userId),
        orderBy('updatedAt', 'desc')
      );
    } else {
      q = query(collection(db, 'projects'), orderBy('updatedAt', 'desc'));
    }
    
    if (!showAll) {
      q = query(q, limit(5));
    }
      
    return onSnapshot(q, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'projects');
    });
  }, [showAll, userRole, userId]);

  useEffect(() => {
    if (!userId) return;
    const unsubSales = onSnapshot(collection(db, 'users'), (s) => {
      setSalesStaff(s.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    const unsubCust = onSnapshot(collection(db, 'customers'), (snapshot) => {
      const data: Record<string, Customer> = {};
      snapshot.docs.forEach(doc => {
        data[doc.id] = { id: doc.id, ...doc.data() } as Customer;
      });
      setCustomers(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'customers');
    });

    return () => {
      unsubSales();
      unsubCust();
    };
  }, [userId]);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (deletingId === id) {
      try {
        await deleteDoc(doc(db, 'projects', id));
        setDeletingId(null);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `projects/${id}`);
      }
    } else {
      setDeletingId(id);
      setTimeout(() => setDeletingId(null), 3000);
    }
  };

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
    <div className="space-y-8 pb-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight uppercase leading-none">Bảng Điều Khiển</h2>
          <p className="text-[10px] md:text-sm text-slate-500 font-bold uppercase tracking-[0.2em] mt-2">Hệ thống phân tích dữ liệu Solar</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
           <Clock className="h-3.5 w-3.5" />
           Cập nhật: {new Date().toLocaleTimeString('vi-VN')}
        </div>
      </div>

      {/* Stats Overview - Premium Bento Design */}
      {!showAll && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <StatCard 
            label="Tổng công suất" 
            value={`${totalCapacity.toFixed(1)} kWp`} 
            icon={<Sun className="h-5 w-5" />}
            color="bg-slate-900 border-slate-800"
            textColor="text-white"
            iconColor="text-amber-400"
            trend="+12% tháng này"
          />
          <StatCard 
            label="Giá trị dự án" 
            value={formatCurrency(totalValue)} 
            icon={<TrendingUp className="h-5 w-5" />}
            color="bg-white border-slate-200"
            textColor="text-slate-900"
            iconColor="text-blue-600"
            trend="Đã chốt {projects.filter(p => p.status === 'contract').length} HĐ"
          />
          <StatCard 
            label="Thời gian hoàn vốn" 
            value="~ 4.5 Năm" 
            icon={<Wallet className="h-5 w-5" />}
            color="bg-white border-slate-200"
            textColor="text-slate-900"
            iconColor="text-green-600"
            trend="Hiệu suất cao"
          />
          <StatCard 
            label="Dự án thực hiện" 
            value={projects.length.toString()} 
            icon={<CheckCircle2 className="h-5 w-5" />}
            color="bg-white border-slate-200"
            textColor="text-slate-900"
            iconColor="text-indigo-600"
            trend="Đang triển khai"
          />
        </div>
      )}

      {/* Projects Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-red-600 rounded-full" />
              <h3 className="font-black text-xs uppercase tracking-widest text-slate-900">
                {showAll ? 'Tất cả dự án hiện có' : 'Dự án mới cập nhật'}
              </h3>
            </div>
            <button className="text-blue-600 text-[10px] uppercase font-black tracking-widest border-b-2 border-transparent hover:border-blue-600 transition-all">
              Xuất báo cáo PDF
            </button>
        </div>
        
        {/* Desktop Table View */}
        <div className="hidden md:block bg-white rounded-3xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[10px] uppercase tracking-[0.2em] font-black border-b border-slate-100">
                <th className="px-8 py-5">Chủ đầu tư / Khu vực</th>
                <th className="px-8 py-5">Tư vấn viên</th>
                <th className="px-8 py-5">Quy trình</th>
                <th className="px-8 py-5">Cấu hình</th>
                <th className="px-8 py-5">Vốn đầu tư</th>
                <th className="px-8 py-5 text-right">Tác vụ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {projects.map((project) => {
                const customer = customers[project.customerId];
                const status = getStatusInfo(project.status);
                const salesRep = salesStaff.find(s => s.id === project.assignedSalesId || s.id === customer?.assignedSalesId);
                const StatusIcon = status.icon;
                return (
                  <tr key={project.id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-8 py-6">
                      <div>
                        <div className="font-black text-sm text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{customer?.name || 'KH VÃNG LAI'}</div>
                        <div className="text-[11px] text-slate-400 font-bold uppercase tracking-tighter flex items-center gap-1 mt-0.5">
                           <ArrowUpRight className="h-3 w-3" />
                           {customer?.address || 'Khu vực chưa xác định'}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      {salesRep ? (
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-[10px] font-black text-blue-600 border border-blue-100">
                            {salesRep.displayName?.[0] || salesRep.username?.[0]}
                          </div>
                          <span className="text-[11px] font-black text-slate-700 uppercase">{salesRep.displayName || salesRep.username}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-300 font-black uppercase italic tracking-widest bg-slate-50 px-2 py-1 rounded-md">Pending</span>
                      )}
                    </td>
                    <td className="px-8 py-6">
                      <div className={cn("inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm border", status.color, status.color.replace('bg-', 'border-').replace('100', '200'))}>
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-black text-xs text-slate-900">{project.systemSizeKWp} kWp</div>
                        <span className="text-[9px] font-black text-blue-600">{project.progress || 0}%</span>
                      </div>
                      <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 rounded-full" style={{ width: `${project.progress || 0}%` }} />
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase font-black tracking-tighter mt-1">{project.panels?.count || 0} Tấm Pin</div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="font-black text-sm text-slate-900">{formatCurrency(project.totalCost || 0)}</div>
                      <div className="text-[9px] text-green-600 font-black uppercase tracking-tighter">NPV Dương • 22.4%</div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => onOpenTracker(project.id)}
                          className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95 border border-blue-100"
                          title="Theo dõi tiến độ"
                        >
                          <TrendingUp className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => onOpenProject(project.id)}
                          className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-blue-600 transition-all shadow-lg active:scale-95"
                          title="Xem chi tiết"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={(e) => handleDeleteProject(e, project.id)}
                          className={cn(
                            "p-2.5 rounded-xl transition-all active:scale-95 border shadow-lg",
                            deletingId === project.id 
                              ? "bg-red-600 text-white border-red-700 animate-pulse" 
                              : "bg-white text-slate-400 border-slate-200 hover:text-red-600 hover:border-red-100 hover:bg-red-50"
                          )}
                          title={deletingId === project.id ? "Nhấn lại để xóa" : "Xóa dự án"}
                        >
                          {deletingId === project.id ? <AlertCircle className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                       <Clock className="h-10 w-10 text-slate-200" />
                       <p className="text-slate-400 text-xs font-black uppercase tracking-[0.3em]">Hệ thống đang trống</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Professional Mobile Project Cards */}
        <div className="md:hidden space-y-4">
          {projects.map((project) => {
            const customer = customers[project.customerId];
            const status = getStatusInfo(project.status);
            const StatusIcon = status.icon;
            return (
              <motion.div 
                whileTap={{ scale: 0.98 }}
                key={project.id} 
                onClick={() => onOpenProject(project.id)}
                className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm active:shadow-inner transition-all space-y-4 relative overflow-hidden group"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="font-black text-sm text-slate-900 uppercase tracking-tight leading-tight">{customer?.name || 'KHÁCH VÃNG LAI'}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter flex items-center gap-1">
                      <ArrowUpRight className="h-2.5 w-2.5" />
                      {customer?.address || 'Khu vực chưa định vị'}
                    </div>
                  </div>
                  <div className={cn("px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm", status.color)}>
                    <StatusIcon className="h-2.5 w-2.5" />
                    {status.label}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-sm">
                      <Sun className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-slate-400 font-black uppercase text-[8px] tracking-tighter">Công suất</p>
                      <p className="font-black text-xs text-slate-800 leading-none mt-0.5">{project.systemSizeKWp} kWp</p>
                    </div>
                  </div>
                  <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-sm">
                      <Wallet className="h-4 w-4 text-green-500" />
                    </div>
                    <div>
                      <p className="text-slate-400 font-black uppercase text-[8px] tracking-tighter">Đầu tư</p>
                      <p className="font-black text-xs text-slate-800 leading-none mt-0.5">{formatCurrency(project.totalCost || 0)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100 space-y-2">
                   <div className="flex items-center justify-between">
                      <p className="text-slate-400 font-black uppercase text-[8px] tracking-tighter">Tiến độ</p>
                      <p className="font-black text-[9px] text-blue-600 leading-none">{project.progress || 0}%</p>
                   </div>
                   <div className="w-full h-1 bg-white rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${project.progress || 0}%` }} />
                   </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                   <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenTracker(project.id);
                        }}
                        className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100"
                      >
                         <TrendingUp className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={(e) => handleDeleteProject(e, project.id)}
                        className={cn(
                          "p-2 rounded-xl transition-all active:scale-95",
                          deletingId === project.id 
                            ? "bg-red-600 text-white shadow-lg animate-pulse" 
                            : "text-slate-400 hover:text-red-600"
                        )}
                      >
                        {deletingId === project.id ? <AlertCircle className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                   </div>
                   <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1">
                      Chi tiết <ArrowUpRight className="h-3 w-3" />
                   </span>
                </div>
              </motion.div>
            );
          })}
          {projects.length === 0 && (
            <div className="py-20 text-center space-y-2">
               <Clock className="mx-auto h-8 w-8 text-slate-200" />
               <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">Hệ thống rỗng</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, textColor, iconColor, trend }: { label: string, value: string, icon: React.ReactNode, color: string, textColor: string, iconColor?: string, trend?: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn("p-6 rounded-[2rem] border shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group", color)}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-3 rounded-2xl bg-slate-50/10 backdrop-blur-md shadow-sm border border-white/5 transition-transform group-hover:scale-110", iconColor || textColor)}>
           {icon}
        </div>
        {trend && (
           <span className="text-[8px] font-black uppercase tracking-widest opacity-40 px-2 py-0.5 bg-slate-500/10 rounded-full">{trend}</span>
        )}
      </div>
      <div className="space-y-1">
        <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] opacity-40">{label}</span>
        <div className={cn("text-2xl md:text-3xl font-black tracking-tight", textColor)}>{value}</div>
      </div>
      
      {/* Abstract Design Element */}
      <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors" />
    </motion.div>
  );
}

function ClipboardList({ className }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>
}
