import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { Project, SalesTask, Customer, SalesPerson } from '../types';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Plus, 
  Search,
  Calendar,
  MoreVertical,
  ChevronRight,
  UserPlus,
  Users,
  LayoutDashboard,
  Trash2,
  Phone,
  Mail,
  UserCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '../lib/utils';

export default function SalesManagement() {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'team' | 'tasks'>('pipeline');
  const [tasks, setTasks] = useState<SalesTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [salesStaff, setSalesStaff] = useState<SalesPerson[]>([]);
  
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTask, setNewTask] = useState({ projectId: '', title: '', description: '', assignedSalesId: '' });
  
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', email: '', phone: '', role: 'sales_rep' as any });

  useEffect(() => {
    onSnapshot(collection(db, 'salesTasks'), (s) => setTasks(s.docs.map(d => ({ id: d.id, ...d.data() } as SalesTask))));
    onSnapshot(collection(db, 'projects'), (s) => setProjects(s.docs.map(d => ({ id: d.id, ...d.data() } as Project))));
    onSnapshot(collection(db, 'sales'), (s) => setSalesStaff(s.docs.map(d => ({ id: d.id, ...d.data() } as SalesPerson))));
    onSnapshot(collection(db, 'customers'), (s) => {
      const data: Record<string, Customer> = {};
      s.docs.forEach(doc => data[doc.id] = { id: doc.id, ...doc.data() } as Customer);
      setCustomers(data);
    });
  }, []);

  const toggleTask = async (task: SalesTask) => {
    await updateDoc(doc(db, 'salesTasks', task.id), {
      status: task.status === 'completed' ? 'pending' : 'completed'
    });
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.projectId || !newTask.title) return;
    await addDoc(collection(db, 'salesTasks'), {
      ...newTask,
      status: 'pending',
      dueDate: new Date(),
      createdAt: serverTimestamp()
    });
    setNewTask({ projectId: '', title: '', description: '', assignedSalesId: '' });
    setIsAddingTask(false);
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaff.name || !newStaff.email) return;
    await addDoc(collection(db, 'sales'), {
      ...newStaff,
      createdAt: serverTimestamp()
    });
    setNewStaff({ name: '', email: '', phone: '', role: 'sales_rep' });
    setIsAddingStaff(false);
  };

  const deleteStaff = async (id: string) => {
    if (confirm('Xác nhận xóa nhân viên sale này?')) {
      await deleteDoc(doc(db, 'sales', id));
    }
  };

  const stages = [
    { id: 'lead', name: 'Tiềm năng', icon: Circle },
    { id: 'survey', name: 'Khảo sát', icon: Clock },
    { id: 'proposal', name: 'Báo giá', icon: ChevronRight },
    { id: 'contract', name: 'Hợp đồng', icon: CheckCircle2 },
    { id: 'installation', name: 'Thi công', icon: Circle },
    { id: 'completed', name: 'Hoàn tất', icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight">Điều hành Kinh doanh & Công trình</h2>
          <p className="text-xs text-slate-500 font-medium">Quản lý đội ngũ sale, phân bổ nhiệm vụ và theo dõi pipeline.</p>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={() => setActiveTab('team')}
             className={cn(
               "px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all",
               activeTab === 'team' ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
             )}
           >
             Đội ngũ Sale
           </button>
           <button 
             onClick={() => setActiveTab('pipeline')}
             className={cn(
               "px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all",
               activeTab === 'pipeline' ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
             )}
           >
             Dự án & Pipeline
           </button>
        </div>
      </div>

      {activeTab === 'team' && (
        <div className="space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {salesStaff.map(staff => (
                <div key={staff.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative group overflow-hidden">
                   <button 
                     onClick={() => deleteStaff(staff.id)}
                     className="absolute top-3 right-3 p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                   >
                     <Trash2 className="h-4 w-4" />
                   </button>
                   <div className="flex items-center gap-4 mb-4">
                      <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg">
                        {staff.name.substring(0,1)}
                      </div>
                      <div>
                         <h3 className="font-bold text-slate-800 leading-tight">{staff.name}</h3>
                         <span className={cn(
                           "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded",
                           staff.role === 'sales_manager' ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"
                         )}>
                           {staff.role === 'sales_manager' ? 'Manager' : 'Rep'}
                         </span>
                      </div>
                   </div>
                   <div className="space-y-1.5 mb-4">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                         <Phone className="h-3.5 w-3.5" /> {staff.phone || 'N/A'}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                         <Mail className="h-3.5 w-3.5" /> {staff.email}
                      </div>
                   </div>
                   <div className="pt-4 border-t border-slate-50 flex flex-col gap-2">
                       <div className="flex justify-between items-center text-[10px] font-bold uppercase text-slate-400">
                          <span>Dự án đảm nhiệm:</span>
                          <span className="text-blue-600">{projects.filter(p => p.assignedSalesId === staff.id || customers[p.customerId]?.assignedSalesId === staff.id).length}</span>
                       </div>
                       <div className="flex justify-between items-center text-[10px] font-bold uppercase text-slate-400">
                          <span>Nhiệm vụ mở:</span>
                          <span className="text-orange-600">{tasks.filter(t => t.assignedSalesId === staff.id && t.status === 'pending').length}</span>
                       </div>
                   </div>
                </div>
              ))}
              <button 
                onClick={() => setIsAddingStaff(true)}
                className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-white transition-all gap-2"
              >
                 <UserPlus className="h-8 w-8" />
                 <span className="text-xs font-bold uppercase tracking-widest">Thêm nhân viên</span>
              </button>
           </div>
        </div>
      )}

      {activeTab === 'pipeline' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
            <div className="flex gap-4 min-w-[1000px]">
              {stages.map(stage => {
                const stageProjects = projects.filter(p => p.status === stage.id);
                return (
                  <div key={stage.id} className="flex-1 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b-2 border-slate-50">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stage.name}</span>
                      <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded font-bold">
                        {stageProjects.length}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {stageProjects.map(p => {
                        const customer = customers[p.customerId];
                        const salesRep = salesStaff.find(s => s.id === p.assignedSalesId || s.id === customer?.assignedSalesId);
                        return (
                          <div key={p.id} className="p-4 bg-white rounded-lg border border-slate-200 hover:border-blue-400 transition-all cursor-pointer group shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                               <p className="text-xs font-bold text-slate-800 uppercase truncate">{customer?.name}</p>
                               <div className="h-5 w-5 bg-blue-50 text-blue-600 rounded flex items-center justify-center text-[8px] font-bold" title={salesRep?.name}>
                                  {salesRep?.name.substring(0,1) || '?'}
                               </div>
                            </div>
                            <p className="text-[10px] font-medium text-slate-400 mb-2">{p.systemSizeKWp} kWp • {format(p.updatedAt?.seconds * 1000 || Date.now(), 'dd/MM/yyyy')}</p>
                            
                            {salesRep && (
                              <div className="flex items-center gap-1.5 mt-2 bg-slate-50 px-2 py-1 rounded">
                                 <UserCheck className="h-2.5 w-2.5 text-blue-500" />
                                 <span className="text-[9px] font-bold text-slate-500 uppercase truncate">{salesRep.name}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {isAddingStaff && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-6 border-b pb-4">Thêm nhân viên Sales</h3>
            <form onSubmit={handleAddStaff} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Họ và tên</label>
                <input 
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none focus:border-blue-500"
                  value={newStaff.name}
                  onChange={e => setNewStaff({...newStaff, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email</label>
                    <input 
                      type="email"
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none focus:border-blue-500"
                      value={newStaff.email}
                      onChange={e => setNewStaff({...newStaff, email: e.target.value})}
                    />
                 </div>
                 <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Số điện thoại</label>
                    <input 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none focus:border-blue-500"
                      value={newStaff.phone}
                      onChange={e => setNewStaff({...newStaff, phone: e.target.value})}
                    />
                 </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Vai trò</label>
                <select 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none focus:border-blue-500"
                  value={newStaff.role}
                  onChange={e => setNewStaff({...newStaff, role: e.target.value as any})}
                >
                  <option value="sales_rep">Sale Representative</option>
                  <option value="sales_manager">Sales Manager</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                 <button onClick={() => setIsAddingStaff(false)} type="button" className="flex-1 py-2 bg-slate-100 text-slate-600 rounded text-xs font-bold uppercase tracking-widest">Hủy</button>
                 <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded text-xs font-bold uppercase tracking-widest shadow-md">Lưu nhân viên</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

