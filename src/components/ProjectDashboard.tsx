import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, deleteDoc, doc, where, collectionGroup } from 'firebase/firestore';
import { Project, Customer, AppUser, UserRole, ProjectTask, TaskStatus } from '../types';
import { 
  Sun, 
  ArrowUpRight, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  TrendingUp,
  Wallet,
  UserCheck,
  Trash2,
  Users,
  Target,
  Percent,
  Award,
  Sparkles,
  Megaphone,
  Activity,
  ChevronRight,
  Layers,
  Calendar,
  CheckSquare,
  AlertTriangle,
  ListTodo
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
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [crmReminders, setCrmReminders] = useState<any[]>([]);

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

    const qCust = userRole === 'sales_rep'
      ? query(collection(db, 'customers'), where('assignedSalesId', '==', userId))
      : collection(db, 'customers');

    const unsubCust = onSnapshot(qCust, (snapshot) => {
      const data: Record<string, Customer> = {};
      snapshot.docs.forEach(doc => {
        data[doc.id] = { id: doc.id, ...doc.data() } as Customer;
      });
      setCustomers(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'customers');
    });

    const qTasks = userRole === 'sales_rep'
      ? query(collection(db, 'projectTasks'), where('assignedToId', '==', userId))
      : collection(db, 'projectTasks');

    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjectTask)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'projectTasks');
    });

    const unsubReminders = onSnapshot(
      collectionGroup(db, 'reminders'),
      (snapshot) => {
        setCrmReminders(snapshot.docs.map(d => {
          const parentPath = d.ref.parent.parent?.path || '';
          const customerId = parentPath ? parentPath.split('/')[1] : '';
          return { id: d.id, customerId, ...d.data() };
        }));
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'reminders_collection_group');
      }
    );

    return () => {
      unsubSales();
      unsubCust();
      unsubTasks();
      unsubReminders();
    };
  }, [userId, userRole]);

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

  // Scheduler & Task Aggregations
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const pendingTasks = totalTasks - completedTasks;
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
  const reviewTasks = tasks.filter(t => t.status === 'review').length;
  const todoTasks = tasks.filter(t => t.status === 'todo').length;

  const totalReminders = crmReminders.length;
  const pendingReminders = crmReminders.filter(r => r.status === 'pending' || r.status !== 'completed').length;
  const completedReminders = totalReminders - pendingReminders;

  const isOverdueItem = (item: any) => {
    if (item.status === 'done' || item.status === 'completed' || !item.dueDate) return false;
    try {
      const dDate = new Date(item.dueDate.seconds ? item.dueDate.seconds * 1000 : item.dueDate);
      const now = new Date();
      return dDate < now && dDate.toDateString() !== now.toDateString();
    } catch {
      return false;
    }
  };

  const isDueSoonItem = (item: any) => {
    if (item.status === 'done' || item.status === 'completed' || !item.dueDate) return false;
    try {
      const dDate = new Date(item.dueDate.seconds ? item.dueDate.seconds * 1000 : item.dueDate);
      const now = new Date();
      const diff = dDate.getTime() - now.getTime();
      return diff > 0 && diff < 48 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  };

  const overdueTasksCount = tasks.filter(t => isOverdueItem(t)).length;
  const overdueRemindersCount = crmReminders.filter(r => isOverdueItem(r)).length;
  const dueSoonTasksCount = tasks.filter(t => isDueSoonItem(t)).length;
  const dueSoonRemindersCount = crmReminders.filter(r => isDueSoonItem(r)).length;

  const totalUrgentCount = overdueTasksCount + overdueRemindersCount + dueSoonTasksCount + dueSoonRemindersCount;

  // CRM Real-time Aggregations
  const customersList = Object.values(customers) as Customer[];
  const totalLeads = customersList.length;

  const leadsByStatus = {
    new: customersList.filter(c => (c.status || 'new') === 'new'),
    contacted: customersList.filter(c => c.status === 'contacted'),
    survey: customersList.filter(c => c.status === 'survey'),
    negotiating: customersList.filter(c => c.status === 'negotiating'),
    won: customersList.filter(c => c.status === 'won'),
    lost: customersList.filter(c => c.status === 'lost'),
  };

  const wonLeadsCount = leadsByStatus.won.length;
  const lostLeadsCount = leadsByStatus.lost.length;
  const activeLeadsCount = totalLeads - wonLeadsCount - lostLeadsCount;
  const conversionRate = totalLeads > 0 ? ((wonLeadsCount / totalLeads) * 100).toFixed(1) : '0';

  const totalPipelineValue = customersList.reduce((sum, c) => sum + (c.leadValue || 0), 0);
  const activePipelineValue = customersList
    .filter(c => !['won', 'lost'].includes(c.status || ''))
    .reduce((sum, c) => sum + (c.leadValue || 0), 0);
  const wonPipelineValue = customersList
    .filter(c => c.status === 'won')
    .reduce((sum, c) => sum + (c.leadValue || 0), 0);

  const sourceCounts = {
    facebook: customersList.filter(c => c.source === 'facebook').length,
    google: customersList.filter(c => c.source === 'google').length,
    referral: customersList.filter(c => c.source === 'referral').length,
    hotline: customersList.filter(c => c.source === 'hotline').length,
    other: customersList.filter(c => c.source === 'other').length,
  };

  // Find top customer channel
  let topSourceLabel = 'Khách Giới Thiệu';
  let maxSourceCount = 0;
  const channels = [
    { key: 'facebook', label: 'Facebook Ads' },
    { key: 'google', label: 'Google Search' },
    { key: 'referral', label: 'Khách Giới Thiệu' },
    { key: 'hotline', label: 'Hotline Trực Tiếp' },
    { key: 'other', label: 'Kênh Khác' },
  ];
  channels.forEach(ch => {
    const count = sourceCounts[ch.key as keyof typeof sourceCounts] || 0;
    if (count > maxSourceCount) {
      maxSourceCount = count;
      topSourceLabel = ch.label;
    }
  });

  // Calculate team sales leaderboard
  const salesLeaderboard = salesStaff.map(s => {
    const repsCustomers = customersList.filter(c => c.assignedSalesId === s.id);
    const activeCount = repsCustomers.filter(c => !['won', 'lost'].includes(c.status || '')).length;
    const wonCount = repsCustomers.filter(c => c.status === 'won').length;
    const totalVal = repsCustomers.reduce((sum, c) => sum + (c.leadValue || 0), 0);
    return {
      name: s.displayName || s.username || 'Ủy thác',
      activeCount,
      wonCount,
      totalVal
    };
  }).filter(item => item.activeCount > 0 || item.wonCount > 0 || item.totalVal > 0)
    .sort((a, b) => b.totalVal - a.totalVal)
    .slice(0, 3);

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

      {/* Stats Overview - Premium Bento Design for Schedules & Tasks */}
      {!showAll && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 px-2 pt-2">
            <div className="w-1 h-4 bg-amber-500 rounded-full" />
            <h3 className="font-black text-xs uppercase tracking-widest text-slate-900 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-500" />
              Thống Kê Tiến Độ Công Việc & Lịch Hẹn CRM
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <StatCard 
              label="Tổng số công việc" 
              value={`${totalTasks} Công việc`} 
              icon={<ListTodo className="h-5 w-5" />}
              color="bg-slate-950 border-slate-800"
              textColor="text-white"
              iconColor="text-amber-400"
              trend={`Hoàn tất: ${completedTasks}`}
            >
              <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Cần triển khai:</div>
                {tasks.filter(t => t.status !== 'done').slice(0, 2).map(task => (
                  <div key={task.id} className="flex items-center gap-1.5 text-[10px] text-slate-300">
                    <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                    <span className="truncate flex-1 font-semibold">{task.title}</span>
                  </div>
                ))}
                {tasks.filter(t => t.status !== 'done').length === 0 && (
                  <div className="text-[9px] text-slate-500 italic">Mọi công việc đã hoàn tất!</div>
                )}
              </div>
            </StatCard>
            <StatCard 
              label="Hẹn chăm sóc khách hàng" 
              value={`${totalReminders} Lịch hẹn`} 
              icon={<Calendar className="h-5 w-5" />}
              color="bg-white border-slate-200"
              textColor="text-slate-900"
              iconColor="text-blue-600"
              trend={`Còn lại: ${pendingReminders}`}
            >
              <div className="mt-2 pt-2 border-t border-slate-100/80 space-y-1">
                <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Lịch tiếp khách:</div>
                {crmReminders.filter(r => r.status !== 'completed' && r.status !== 'done').slice(0, 2).map(r => (
                  <div key={r.id} className="flex items-center gap-1.5 text-[10px] text-slate-600">
                    <span className="w-1 h-1 rounded-full bg-blue-500 shrink-0" />
                    <span className="truncate flex-1 font-semibold">{r.title}</span>
                  </div>
                ))}
                {crmReminders.filter(r => r.status !== 'completed' && r.status !== 'done').length === 0 && (
                  <div className="text-[9px] text-slate-400 italic">Chưa có lịch hẹn chờ</div>
                )}
              </div>
            </StatCard>
            <StatCard 
              label="Công việc đang làm" 
              value={`${inProgressTasks} Đang làm`} 
              icon={<Activity className="h-5 w-5" />}
              color="bg-white border-slate-200"
              textColor="text-slate-900"
              iconColor="text-indigo-600"
              trend={`Đã duyệt: ${reviewTasks}`}
            >
              <div className="mt-2 pt-2 border-t border-slate-100/80 space-y-1">
                <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Đang xem xét:</div>
                {tasks.filter(t => t.status === 'in_progress').slice(0, 2).map(t => (
                  <div key={t.id} className="flex items-center gap-1.5 text-[10px] text-slate-600">
                    <span className="w-1 h-1 rounded-full bg-indigo-500 shrink-0" />
                    <span className="truncate flex-1 font-semibold">{t.title}</span>
                  </div>
                ))}
                {tasks.filter(t => t.status === 'in_progress').length === 0 && (
                  <div className="text-[9px] text-slate-400 italic font-medium">Không có việc đang làm</div>
                )}
              </div>
            </StatCard>
            <StatCard 
              label="Sự vụ khẩn cấp / Trễ hạn" 
              value={`${totalUrgentCount} Sự vụ`} 
              icon={<AlertTriangle className="h-5 w-5" />}
              color="bg-white border-slate-200"
              textColor="text-slate-900"
              iconColor="text-rose-600"
              trend={`Quá hạn: ${overdueTasksCount + overdueRemindersCount}`}
            >
              <div className="mt-2 pt-2 border-t border-slate-100/80 space-y-1">
                <div className="text-[9px] uppercase font-bold text-rose-500 tracking-wider">Cần xử lý khẩn:</div>
                {[
                  ...tasks.map(t => ({ ...t, isCrm: false, typeLabel: 'CÔNG VIỆC' })),
                  ...crmReminders.map(r => ({ ...r, isCrm: true, typeLabel: 'LỊCH HẸN CRM', status: r.status === 'completed' ? 'done' : 'todo' }))
                ]
                  .filter(item => item.status !== 'done' && (isOverdueItem(item) || isDueSoonItem(item)))
                  .slice(0, 2).map((item, idx) => {
                    const isOverdue = isOverdueItem(item);
                    return (
                      <div key={`${item.id || 'item'}-${item.isCrm ? 'crm' : 'task'}-${idx}`} className="flex items-center gap-1.5 text-[10px] text-rose-700 font-semibold">
                        <span className={cn("w-1 h-1 rounded-full shrink-0", isOverdue ? "bg-rose-600 animate-pulse" : "bg-amber-500")} />
                        <span className="truncate flex-1">{item.title}</span>
                      </div>
                    );
                  })}
                {[
                  ...tasks.map(t => ({ ...t, isCrm: false, typeLabel: 'CÔNG VIỆC' })),
                  ...crmReminders.map(r => ({ ...r, isCrm: true, typeLabel: 'LỊCH HẸN CRM', status: r.status === 'completed' ? 'done' : 'todo' }))
                ]
                  .filter(item => item.status !== 'done' && (isOverdueItem(item) || isDueSoonItem(item))).length === 0 && (
                  <div className="text-[9px] text-emerald-600 font-extrabold uppercase flex items-center gap-1">
                     ✓ An toàn
                  </div>
                )}
              </div>
            </StatCard>
          </div>

          {/* Graphical Schedules & Task Breakdowns */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* 1. Workflow / Task status (7 cols) */}
            <div className="lg:col-span-7 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-emerald-500" />
                  Quy trình công việc hành chính & kỹ thuật
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  Trạng thái hiện tại
                </span>
              </div>

              <div className="space-y-4">
                {[
                  { label: 'Cần làm (Todo)', count: todoTasks, percent: totalTasks > 0 ? (todoTasks / totalTasks) * 100 : 0, color: 'bg-slate-400', desc: 'Chưa khởi chạy triển khai' },
                  { label: 'Đang làm (In Progress)', count: inProgressTasks, percent: totalTasks > 0 ? (inProgressTasks / totalTasks) * 100 : 0, color: 'bg-blue-600', desc: 'Đang xử lý kỹ thuật thực địa' },
                  { label: 'Kiểm tra (Review/Test)', count: reviewTasks, percent: totalTasks > 0 ? (reviewTasks / totalTasks) * 100 : 0, color: 'bg-amber-400', desc: 'Đang đối soát thiết bị và hồ sơ' },
                  { label: 'Hoàn tất (Done)', count: completedTasks, percent: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0, color: 'bg-emerald-500', desc: 'Đã ký tống nghiệm thu hoàn công' },
                ].map((item) => (
                  <div key={item.label} className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50 hover:bg-slate-50 transition-colors space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-extrabold text-slate-700 tracking-tight flex items-center gap-2">
                        <span className={cn("w-2.5 h-2.5 rounded-full", item.color)} />
                        {item.label}
                      </span>
                      <span className="font-black text-slate-900">{item.count} Nhiệm vụ ({Math.round(item.percent)}%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden bg-slate-100">
                      <div className={cn("h-full rounded-full transition-all duration-500", item.color)} style={{ width: `${item.percent}%` }} />
                    </div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Priority Alerts & Overdue schedules (5 cols) */}
            <div className="lg:col-span-12 lg:xl:col-span-5 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-500" />
                  Lịch Hẹn & Công Việc Ưu Tiên Cao
                </span>
                <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1 uppercase tracking-widest font-black">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                  Khẩn cấp
                </span>
              </div>

              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {[
                  ...tasks.map(t => ({ ...t, isCrm: false, typeLabel: 'CÔNG VIỆC' })),
                  ...crmReminders.map(r => ({ ...r, isCrm: true, typeLabel: 'LỊCH HẸN CRM', status: r.status === 'completed' ? 'done' : 'todo' }))
                ]
                  .filter(item => item.status !== 'done' && (isOverdueItem(item) || isDueSoonItem(item) || item.status === 'todo' || item.status === 'in_progress'))
                  .sort((a, b) => {
                    // Overdue first
                    const aOverdue = isOverdueItem(a) ? 1 : 0;
                    const bOverdue = isOverdueItem(b) ? 1 : 0;
                    if (aOverdue !== bOverdue) return bOverdue - aOverdue;

                    // Earliest due date
                    const ad = a.dueDate?.seconds ? a.dueDate.seconds * 1000 : new Date(a.dueDate).getTime() || 9999999999999;
                    const bd = b.dueDate?.seconds ? b.dueDate.seconds * 1000 : new Date(b.dueDate).getTime() || 9999999999999;
                    return ad - bd;
                  })
                  .slice(0, 5)
                  .map((item, index) => {
                    const isOverdue = isOverdueItem(item);
                    const isDueSoon = isDueSoonItem(item);
                    let dateStr = 'Chưa thiết lập hạn';
                    if (item.dueDate) {
                      try {
                        const d = item.dueDate.seconds ? new Date(item.dueDate.seconds * 1000) : new Date(item.dueDate);
                        dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                      } catch {}
                    }
                    
                    return (
                      <div key={`${item.id || 'item'}-${item.isCrm ? 'crm' : 'task'}-${index}`} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-2 hover:bg-slate-100/50 transition-colors">
                        <div className="flex justify-between items-start gap-2">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                            item.isCrm ? "bg-blue-100 text-blue-700 border border-blue-200" : "bg-purple-100 text-purple-700 border border-purple-200"
                          )}>
                            {item.typeLabel}
                          </span>
                          
                          {isOverdue ? (
                            <span className="bg-rose-100 text-rose-700 border border-rose-200 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded">Trễ hạn</span>
                          ) : isDueSoon ? (
                            <span className="bg-amber-100 text-amber-700 border border-amber-200 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded">Gấp (48h)</span>
                          ) : null}
                        </div>

                        <div>
                          <h4 className="font-extrabold text-xs text-slate-800 line-clamp-1">{item.title}</h4>
                          {item.description && (
                            <p className="text-[10px] text-slate-400 font-medium line-clamp-1 mt-0.5">{item.description}</p>
                          )}
                        </div>

                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold border-t border-slate-100 pt-1.5 mt-0.5">
                          <span className="flex items-center gap-1 font-black">
                            <Clock className="h-3 w-3 text-slate-400" />
                            {dateStr}
                          </span>
                          {item.assignedToId && (
                            <span className="text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 text-[9px] font-black uppercase">
                              {salesStaff.find(s => s.id === item.assignedToId)?.displayName || 'Nhân viên'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  
                {tasks.length === 0 && crmReminders.length === 0 && (
                  <div className="py-12 text-center text-slate-400 text-xs font-black uppercase tracking-wider">
                     Không có lịch hẹn & công việc cần xử lý
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* CRM Statistics Section */}
      {!showAll && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 px-2 pt-2">
            <div className="w-1 h-4 bg-blue-600 rounded-full" />
            <h3 className="font-black text-xs uppercase tracking-widest text-slate-900 flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-600" />
              Chăm Sóc Khách Hàng & Thống Kê CRM
            </h3>
          </div>

          {/* CRM KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <StatCard 
              label="Tỉ lệ chốt hợp đồng" 
              value={`${conversionRate}%`} 
              icon={<Award className="h-5 w-5" />}
              color="bg-white border-slate-200"
              textColor="text-slate-900"
              iconColor="text-emerald-600"
              trend={`${wonLeadsCount} hợp đồng đã ký`}
            />
            <StatCard 
              label="Trị giá phễu CRM" 
              value={formatCurrency(totalPipelineValue)} 
              icon={<TrendingUp className="h-5 w-5" />}
              color="bg-white border-slate-200"
              textColor="text-slate-900"
              iconColor="text-blue-600"
              trend={`Đang chăm sóc: ${formatCurrency(activePipelineValue)}`}
            />
            <StatCard 
              label="Khách đang chăm sóc" 
              value={`${activeLeadsCount} Leads`} 
              icon={<Users className="h-5 w-5" />}
              color="bg-white border-slate-200"
              textColor="text-slate-900"
              iconColor="text-orange-600"
              trend={`Tổng lead: ${totalLeads}`}
            />
            <StatCard 
              label="Kênh tiếp xúc chính" 
              value={topSourceLabel} 
              icon={<Megaphone className="h-5 w-5" />}
              color="bg-white border-slate-200"
              textColor="text-slate-900"
              iconColor="text-indigo-600"
              trend={`Đạt ${maxSourceCount} cơ hội`}
            />
          </div>

          {/* Graphical Pipeline and Channels break downs */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* 1. Pipeline Funnel (7 cols) */}
            <div className="lg:col-span-7 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-5">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-500" />
                  Đường Ống Bán Hàng & Chuyển Đổi (Pipeline Stage)
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  Phân phối Leads
                </span>
              </div>

              <div className="space-y-4">
                {[
                  { key: 'new', label: 'Bắt đầu / Mới nhận', count: leadsByStatus.new.length, color: 'bg-blue-600', val: leadsByStatus.new.reduce((s, c) => s + (c.leadValue || 0), 0) },
                  { key: 'contacted', label: 'Đã liên hệ cuộc gọi', count: leadsByStatus.contacted.length, color: 'bg-indigo-600', val: leadsByStatus.contacted.reduce((s, c) => s + (c.leadValue || 0), 0) },
                  { key: 'survey', label: 'Khảo sát / Lên phương án', count: leadsByStatus.survey.length, color: 'bg-amber-500', val: leadsByStatus.survey.reduce((s, c) => s + (c.leadValue || 0), 0) },
                  { key: 'negotiating', label: 'Thương thảo / Thỏa thuận', count: leadsByStatus.negotiating.length, color: 'bg-teal-600', val: leadsByStatus.negotiating.reduce((s, c) => s + (c.leadValue || 0), 0) },
                  { key: 'won', label: 'Đã ký hợp đồng 🏆', count: leadsByStatus.won.length, color: 'bg-emerald-600', val: leadsByStatus.won.reduce((s, c) => s + (c.leadValue || 0), 0) },
                  { key: 'lost', label: 'Thất bại (Trượt thầu)', count: leadsByStatus.lost.length, color: 'bg-rose-600', val: leadsByStatus.lost.reduce((s, c) => s + (c.leadValue || 0), 0) },
                ].map((item) => {
                  const percent = totalLeads > 0 ? (item.count / totalLeads) * 100 : 0;
                  return (
                    <div key={item.key} className="space-y-1 bg-slate-50/50 p-3 rounded-2xl border border-slate-100/50 hover:bg-slate-50 transition-all">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-extrabold text-slate-700 uppercase tracking-tight flex items-center gap-2">
                          <span className={cn("w-2 h-2 rounded-full", item.color)} />
                          {item.label}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="font-black text-slate-900">{item.count} Leads</span>
                          <span className="text-[10px] font-bold text-slate-400">({percent.toFixed(0)}%)</span>
                        </div>
                      </div>
                      
                      {/* Costom progress level background and foreground */}
                      <div className="w-full h-2 rounded-full overflow-hidden mt-1 bg-slate-100">
                        <div className={cn("h-full rounded-full transition-all duration-500", item.color)} style={{ width: `${percent}%` }} />
                      </div>
                      
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold mt-1">
                        <span>Giá trị giai đoạn:</span>
                        <span className="text-slate-700 font-black">{formatCurrency(item.val)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Lead Acquisition Channels & Top Consultant leaderboard (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              
              {/* Traffic Sources block */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4 flex-1">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Target className="h-4 w-4 text-indigo-500" />
                    Kênh Khách Hàng Tiếp Cận
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">Traffic Source</span>
                </div>

                <div className="space-y-4 pt-1">
                  {[
                    { key: 'facebook', label: 'Facebook Ads', count: sourceCounts.facebook, color: 'bg-sky-500' },
                    { key: 'google', label: 'Google Search/SEO', count: sourceCounts.google, color: 'bg-violet-500' },
                    { key: 'referral', label: 'Khách hàng giới thiệu', count: sourceCounts.referral, color: 'bg-emerald-500' },
                    { key: 'hotline', label: 'Hotline công ty', count: sourceCounts.hotline, color: 'bg-rose-500' },
                    { key: 'other', label: 'Kênh tiếp cận khác', count: sourceCounts.other, color: 'bg-slate-500' },
                  ].map((item) => {
                    const percent = totalLeads > 0 ? (item.count / totalLeads) * 100 : 0;
                    return (
                      <div key={item.key} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-extrabold text-slate-600">{item.label}</span>
                          <span className="font-black text-slate-800">{item.count} leads ({percent.toFixed(0)}%)</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full animate-pulse", item.color)} style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sales Representative Performance rankings */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4 flex-1">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Award className="h-4 w-4 text-amber-500" />
                    Tư Vấn CRM Xuất Sắc
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">Top Sales</span>
                </div>

                <div className="space-y-3.5 pt-1">
                  {salesLeaderboard.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/50 hover:bg-slate-50 border border-slate-100/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 bg-amber-500 text-white font-black text-xs rounded-lg flex items-center justify-center border border-amber-600 shadow-sm">
                          #{index + 1}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{item.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold">
                            Chăm sóc <strong className="text-slate-600">{item.activeCount} leads</strong> | Chốt <strong className="text-emerald-600">{item.wonCount} HĐ</strong>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-slate-800">{formatCurrency(item.totalVal)}</p>
                        <p className="text-[9px] text-blue-600 font-black uppercase tracking-widest">Doanh Số</p>
                      </div>
                    </div>
                  ))}

                  {salesLeaderboard.length === 0 && (
                    <div className="text-center py-6 text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                      Chưa ghi nhận doanh số tư vấn viên
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* Projects Section */}
      {showAll && (
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
      )}
    </div>
  );
}

function StatCard({ 
  label, 
  value, 
  icon, 
  color, 
  textColor, 
  iconColor, 
  trend,
  children 
}: { 
  label: string, 
  value: string, 
  icon: React.ReactNode, 
  color: string, 
  textColor: string, 
  iconColor?: string, 
  trend?: string,
  children?: React.ReactNode 
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn("p-4 md:p-5 rounded-3xl border shadow-[0_8px_30px_rgb(0,0,0,0.02)] relative overflow-hidden group flex flex-col justify-between min-h-[170px]", color)}
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className={cn("p-2 rounded-xl bg-slate-50/10 backdrop-blur-md shadow-sm border border-white/5 transition-transform group-hover:scale-105", iconColor || textColor)}>
             {React.cloneElement(icon as React.ReactElement, { className: 'h-4 w-4' })}
          </div>
          {trend && (
             <span className="text-[8px] font-black uppercase tracking-widest opacity-65 px-2 py-0.5 bg-slate-500/10 rounded-full">{trend}</span>
          )}
        </div>
        <div className="space-y-0.5">
          <span className="text-[9px] md:text-[10px] font-extrabold uppercase tracking-widest opacity-50 block truncate">{label}</span>
          <div className={cn("text-lg md:text-xl font-black tracking-tight", textColor)}>{value}</div>
        </div>
      </div>
      
      {children && (
        <div className="mt-2 w-full z-10">
          {children}
        </div>
      )}
      
      {/* Abstract Design Element */}
      <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors" />
    </motion.div>
  );
}

function ClipboardList({ className }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>
}
