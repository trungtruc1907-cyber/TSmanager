import React, { useState, useEffect, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  serverTimestamp,
  orderBy,
  collectionGroup,
  where
} from 'firebase/firestore';
import { ProjectTask, AppUser, Project, Customer, TaskStatus } from '../types';
import { 
  CalendarDays, 
  ListTodo, 
  Users, 
  BarChart3, 
  Bell, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  Edit2, 
  Briefcase, 
  ArrowUpRight, 
  CheckSquare, 
  Bookmark, 
  Info,
  Calendar,
  Sparkles,
  Phone,
  Mail,
  UserCheck
} from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  userId: string;
  userRole: string;
}

export default function WorkSchedulerHub({ userId, userRole }: Props) {
  const [activeTab, setActiveTab] = useState<'calendar' | 'tasks' | 'staff' | 'reports' | 'alerts'>('calendar');
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [crmReminders, setCrmReminders] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [taskSearch, setTaskSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');

  // Task Form State
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    projectId: '',
    assignedToId: '',
    status: 'todo' as TaskStatus,
    dueDate: new Date().toISOString().split('T')[0],
  });

  // Calendar Date State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Real-time Listeners
  useEffect(() => {
    setLoading(true);
    
    const qTasks = userRole === 'sales_rep'
      ? query(collection(db, 'projectTasks'), where('assignedToId', '==', userId), orderBy('createdAt', 'desc'))
      : query(collection(db, 'projectTasks'), orderBy('createdAt', 'desc'));

    const unsubTasks = onSnapshot(
      qTasks,
      (s) => {
        setTasks(s.docs.map(d => ({ id: d.id, ...d.data() } as ProjectTask)));
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'projectTasks');
        setLoading(false);
      }
    );

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (s) => {
        setUsers(s.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'users')
    );

    const qProjects = userRole === 'sales_rep'
      ? query(collection(db, 'projects'), where('assignedSalesId', '==', userId))
      : collection(db, 'projects');

    const unsubProjects = onSnapshot(
      qProjects,
      (s) => {
        setProjects(s.docs.map(d => ({ id: d.id, ...d.data() } as Project)));
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'projects')
    );

    const qCustomers = userRole === 'sales_rep'
      ? query(collection(db, 'customers'), where('assignedSalesId', '==', userId))
      : collection(db, 'customers');

    const unsubCustomers = onSnapshot(
      qCustomers,
      (s) => {
        setCustomers(s.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'customers')
    );

    const unsubReminders = onSnapshot(
      collectionGroup(db, 'reminders'),
      (s) => {
        setCrmReminders(s.docs.map(d => {
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
      unsubTasks();
      unsubUsers();
      unsubProjects();
      unsubCustomers();
      unsubReminders();
    };
  }, [userId, userRole]);

  // Form Handlers
  const handleOpenAddForm = (initialDate?: string) => {
    setEditingTask(null);
    setTaskForm({
      title: '',
      description: '',
      projectId: projects[0]?.id || '',
      assignedToId: userId,
      status: 'todo',
      dueDate: initialDate || new Date().toISOString().split('T')[0],
    });
    setIsAddingTask(true);
  };

  const handleOpenEditForm = (t: ProjectTask) => {
    setEditingTask(t);
    let dVal = '';
    if (t.dueDate) {
      if (t.dueDate.seconds) {
        dVal = new Date(t.dueDate.seconds * 1000).toISOString().split('T')[0];
      } else {
        dVal = typeof t.dueDate === 'string' ? t.dueDate.split('T')[0] : new Date(t.dueDate).toISOString().split('T')[0];
      }
    } else {
      dVal = new Date().toISOString().split('T')[0];
    }

    setTaskForm({
      title: t.title,
      description: t.description || '',
      projectId: t.projectId || '',
      assignedToId: t.assignedToId || '',
      status: t.status,
      dueDate: dVal,
    });
    setIsAddingTask(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;

    try {
      if (editingTask && (editingTask as any).isCrmReminder && (editingTask as any).customerId) {
        // Update CRM reminder in subcollection
        await updateDoc(doc(db, 'customers', (editingTask as any).customerId, 'reminders', editingTask.id), {
          title: taskForm.title,
          status: taskForm.status === 'done' ? 'completed' : 'pending',
          assignedToId: taskForm.assignedToId,
          dueDate: taskForm.dueDate
        });
        setIsAddingTask(false);
        setEditingTask(null);
        return;
      }

      const dbDueDate = new Date(taskForm.dueDate);
      
      const payload: any = {
        title: taskForm.title,
        description: taskForm.description,
        projectId: taskForm.projectId,
        assignedToId: taskForm.assignedToId,
        status: taskForm.status,
        dueDate: dbDueDate,
        updatedAt: serverTimestamp()
      };

      if (editingTask) {
        await updateDoc(doc(db, 'projectTasks', editingTask.id), payload);
        // Log log activity
        await addDoc(collection(db, 'projectActivities'), {
          projectId: taskForm.projectId,
          userId,
          userName: users.find(u => u.id === userId)?.displayName || 'Hệ thống',
          type: 'task_update',
          description: `Đã cập nhật công việc: ${taskForm.title}`,
          createdAt: serverTimestamp()
        });
      } else {
        payload.creatorId = userId;
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, 'projectTasks'), payload);
        
        await addDoc(collection(db, 'projectActivities'), {
          projectId: taskForm.projectId,
          userId,
          userName: users.find(u => u.id === userId)?.displayName || 'Hệ thống',
          type: 'task_update',
          description: `Đã khởi tạo công việc mới: ${taskForm.title}`,
          createdAt: serverTimestamp()
        });
      }

      setIsAddingTask(false);
      setEditingTask(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'projectTasks');
    }
  };

  const handleDeleteTask = async (id: string, projId: string, title: string) => {
    const task = combinedTasks.find(t => t.id === id);
    if (task && (task as any).isCrmReminder && (task as any).customerId) {
      if (!window.confirm(`Bạn có chắc chắn muốn xóa lịch hẹn chăm sóc khách hàng "${title}"?`)) return;
      try {
        await deleteDoc(doc(db, 'customers', (task as any).customerId, 'reminders', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `customers/${(task as any).customerId}/reminders/${id}`);
      }
      return;
    }

    if (!window.confirm(`Bạn có chắc chắn muốn xóa công việc "${title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'projectTasks', id));
      await addDoc(collection(db, 'projectActivities'), {
        projectId: projId || 'global',
        userId,
        userName: users.find(u => u.id === userId)?.displayName || 'Hệ thống',
        type: 'task_update',
        description: `Đã xóa công việc: ${title}`,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `projectTasks/${id}`);
    }
  };

  const handleQuickStatusChange = async (taskId: string, newStatus: TaskStatus, projId: string, title: string) => {
    const task = combinedTasks.find(t => t.id === taskId);
    if (task && (task as any).isCrmReminder && (task as any).customerId) {
      try {
        await updateDoc(doc(db, 'customers', (task as any).customerId, 'reminders', taskId), {
          status: newStatus === 'done' ? 'completed' : 'pending'
        });
      } catch (err) {
        console.error("Failed to quick update status for CRM reminder", err);
      }
      return;
    }

    try {
      await updateDoc(doc(db, 'projectTasks', taskId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      await addDoc(collection(db, 'projectActivities'), {
        projectId: projId || 'global',
        userId,
        userName: users.find(u => u.id === userId)?.displayName || 'Hệ thống',
        type: 'task_update',
        description: `Thay đổi trạng thái công việc "${title}" sang ${newStatus.toUpperCase()}`,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Failed to quick update status", err);
    }
  };

  // Helper dynamic mappings
  const getCustomerForTask = (t: any) => {
    if (t.isCrmReminder && t.customerId) {
      return customers.find(c => c.id === t.customerId) || null;
    }
    const proj = projects.find(p => p.id === t.projectId);
    if (!proj) return null;
    return customers.find(c => c.id === proj.customerId) || null;
  };

  const getCustomerForProject = (projectId: string) => {
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return null;
    return customers.find(c => c.id === proj.customerId);
  };

  const combinedTasks = useMemo(() => {
    const formattedCrmTasks = crmReminders.map(rem => {
      const customer = customers.find(c => c.id === rem.customerId);
      const customerName = customer ? customer.name : 'Unknown';
      
      const proj = projects.find(p => p.customerId === rem.customerId);
      const projectId = proj ? proj.id : '';
      
      return {
        id: rem.id,
        projectId: projectId, 
        customerId: rem.customerId,
        assignedToId: rem.assignedToId || customer?.assignedSalesId || '',
        creatorId: 'system',
        title: `[CRM] ${rem.title}`,
        description: `Chăm sóc khách hàng: ${customerName}. ${rem.title}`,
        dueDate: rem.dueDate,
        status: rem.status === 'completed' ? 'done' as TaskStatus : 'todo' as TaskStatus,
        createdAt: rem.createdAt || null,
        updatedAt: null,
        isCrmReminder: true
      };
    });

    return [...tasks, ...formattedCrmTasks];
  }, [tasks, crmReminders, customers, projects]);

  const getDueDateString = (dueDate: any): string => {
    if (!dueDate) return 'Không có hạn';
    try {
      const date = dueDate.seconds ? new Date(dueDate.seconds * 1000) : new Date(dueDate);
      return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
      return 'N/A';
    }
  };

  const checkTaskOverdue = (task: any) => {
    if (task.status === 'done' || !task.dueDate) return false;
    try {
      const dDate = task.dueDate.seconds ? new Date(task.dueDate.seconds * 1000) : new Date(task.dueDate);
      const today = new Date();
      today.setHours(0,0,0,0);
      dDate.setHours(0,0,0,0);
      return dDate < today;
    } catch (e) {
      return false;
    }
  };

  const checkTaskDueSoon = (task: any) => {
    if (task.status === 'done' || !task.dueDate) return false;
    try {
      const dDate = task.dueDate.seconds ? new Date(task.dueDate.seconds * 1000) : new Date(task.dueDate);
      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(today.getDate() + 1);
      
      today.setHours(0, 0, 0, 0);
      tomorrow.setHours(23, 59, 59, 999);
      
      return dDate >= today && dDate <= tomorrow;
    } catch (e) {
      return false;
    }
  };

  // Task count aggregate warnings
  const overdueTasks = useMemo(() => combinedTasks.filter(t => checkTaskOverdue(t)), [combinedTasks]);
  const dueSoonTasks = useMemo(() => combinedTasks.filter(t => checkTaskDueSoon(t)), [combinedTasks]);
  const totalAlertsCount = overdueTasks.length + dueSoonTasks.length;

  // Calendar computation helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const getCalendarDays = () => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // Sunday starts at 0
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const totalDaysInPrevMonth = new Date(year, month, 0).getDate();
    
    const days = [];
    
    // Previous month filling padding
    const prevMonthOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1; // Align Mon as 1st col
    for (let i = prevMonthOffset; i > 0; i--) {
      const d = new Date(year, month - 1, totalDaysInPrevMonth - i + 1);
      days.push({ date: d, isCurrentMonth: false });
    }

    // Current month days
    for (let i = 1; i <= totalDaysInMonth; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, isCurrentMonth: true });
    }

    // Next month filling padding
    const remainingSlots = 42 - days.length;
    for (let i = 1; i <= remainingSlots; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false });
    }

    return days;
  };

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(year, month + offset, 1));
  };

  // Get tasks belonging to any specific date
  const getTasksForDate = (day: Date) => {
    const targetStr = day.toISOString().split('T')[0];
    return combinedTasks.filter(t => {
      if (!t.dueDate) return false;
      const tDate = t.dueDate.seconds ? new Date(t.dueDate.seconds * 1000) : new Date(t.dueDate);
      const tStr = tDate.toISOString().split('T')[0];
      return tStr === targetStr;
    });
  };

  // Filter Tasks List View
  const filteredTasks = useMemo(() => {
    return combinedTasks.filter(t => {
      const assignedUser = users.find(u => u.id === t.assignedToId);
      const assignedName = assignedUser ? (assignedUser.displayName || assignedUser.username).toLowerCase() : '';
      const creatorUser = users.find(u => u.id === t.creatorId);
      const creatorName = creatorUser ? (creatorUser.displayName || creatorUser.username).toLowerCase() : '';
      
      const searchTarget = `${t.title} ${t.description || ''} ${assignedName} ${creatorName}`.toLowerCase();
      
      const matchesSearch = taskSearch.trim() === '' || searchTarget.includes(taskSearch.toLowerCase());
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchesAssignee = assigneeFilter === 'all' || t.assignedToId === assigneeFilter;
      const matchesProject = projectFilter === 'all' || t.projectId === projectFilter;

      return matchesSearch && matchesStatus && matchesAssignee && matchesProject;
    });
  }, [combinedTasks, users, taskSearch, statusFilter, assigneeFilter, projectFilter]);

  const getStatusLabelText = (st: string) => {
    switch (st) {
      case 'todo': return 'Cần làm';
      case 'in_progress': return 'Đang xử lý';
      case 'review': return 'Kiểm tra';
      case 'done': return 'Hoàn tất';
      default: return st;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Info */}
      <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <CalendarDays className="h-5 w-5" />
            </span>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Điều hành & Lịch công việc</h2>
          </div>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Hệ thống phân công, báo cáo & cảnh báo trễ deadline thông minh</p>
        </div>

        <button
          onClick={() => handleOpenAddForm()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-lg shadow-blue-100"
        >
          <Plus className="h-4 w-4" /> Tạo công việc mới
        </button>
      </div>

      {/* Internal Navigation Grid */}
      <div className="flex flex-wrap gap-2 pb-1 border-b border-slate-200">
        {[
          { id: 'calendar', label: 'Lịch biểu', icon: CalendarDays },
          { id: 'tasks', label: 'Quản lý công việc', icon: ListTodo },
          { id: 'staff', label: 'Tải lượng nhân sự', icon: Users },
          { id: 'reports', label: 'Báo cáo & Thống kê', icon: BarChart3 },
          { 
            id: 'alerts', 
            label: 'Cảnh báo nhắc việc', 
            icon: Bell,
            count: totalAlertsCount > 0 ? totalAlertsCount : undefined 
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 rounded-t-2xl font-black text-xs uppercase tracking-wider transition-all border-b-2 border-transparent",
                isActive 
                  ? "bg-white text-blue-600 border-blue-600 shadow-sm font-black" 
                  : "text-slate-400 hover:text-slate-700 hover:bg-slate-50/50"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="ml-1 h-5 min-w-5 shrink-0 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center px-1">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="bg-white p-4 md:p-6 rounded-[2rem] border border-slate-200 shadow-sm min-h-[450px]">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 font-bold uppercase tracking-wider text-xs">
            <Clock className="h-8 w-8 animate-spin text-blue-600 mb-2" />
            Đang đồng bộ dữ liệu tiến trình...
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {/* 1. CALENDAR VIEW PANEL */}
            {activeTab === 'calendar' && (
              <motion.div
                key="calendar"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-6"
              >
                {/* Month Picker / Grid */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="flex items-center justify-between pb-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <button 
                      onClick={() => changeMonth(-1)}
                      className="p-2 hover:bg-white hover:shadow-sm rounded-xl border border-transparent hover:border-slate-200 transition-all text-slate-600"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-black uppercase tracking-widest text-slate-800">
                      Tháng {month + 1} / {year}
                    </span>
                    <button 
                      onClick={() => changeMonth(1)}
                      className="p-2 hover:bg-white hover:shadow-sm rounded-xl border border-transparent hover:border-slate-200 transition-all text-slate-600"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-black uppercase tracking-wider text-slate-400 py-1">
                    <div>T2</div>
                    <div>T3</div>
                    <div>T4</div>
                    <div>T5</div>
                    <div>T6</div>
                    <div>T7</div>
                    <div className="text-rose-500">CN</div>
                  </div>

                  <div className="grid grid-cols-7 gap-2">
                    {getCalendarDays().map(({ date, isCurrentMonth }, idx) => {
                      const dayStr = date.toISOString().split('T')[0];
                      const dateTasks = getTasksForDate(date);
                      const isSelected = selectedCalendarDate === dayStr;
                      const isToday = new Date().toISOString().split('T')[0] === dayStr;
                      
                      return (
                        <div 
                          key={idx}
                          onClick={() => setSelectedCalendarDate(dayStr)}
                          className={cn(
                            "min-h-[85px] p-2 rounded-2xl border flex flex-col justify-between transition-all cursor-pointer relative",
                            isCurrentMonth ? "bg-white" : "bg-slate-50/55 opacity-40",
                            isSelected 
                              ? "border-blue-600 ring-2 ring-blue-100" 
                              : isToday 
                                ? "border-amber-400 bg-amber-50/20" 
                                : "border-slate-100 hover:border-slate-300 hover:bg-slate-50/30"
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <span className={cn(
                              "text-xs font-black",
                              isToday ? "text-amber-600" : isCurrentMonth ? "text-slate-800" : "text-slate-400"
                            )}>
                              {date.getDate()}
                            </span>
                            {dateTasks.length > 0 && (
                              <span className="h-4 min-w-4 text-[9px] font-black text-white bg-blue-600 rounded-full flex items-center justify-center px-1">
                                {dateTasks.length}
                              </span>
                            )}
                          </div>

                          {/* Quick indicators */}
                          <div className="space-y-1 mt-1 overflow-hidden">
                            {dateTasks.slice(0, 2).map((t) => (
                              <div 
                                key={t.id} 
                                className={cn(
                                  "text-[8px] font-extrabold truncate px-1 rounded border",
                                  t.status === 'done' 
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-100 line-through" 
                                    : checkTaskOverdue(t) 
                                      ? "bg-rose-50 text-rose-700 border-rose-100"
                                      : "bg-blue-50 text-blue-700 border-blue-100"
                                )}
                              >
                                {t.title}
                              </div>
                            ))}
                            {dateTasks.length > 2 && (
                              <p className="text-[7px] text-slate-400 font-extrabold text-right">+{dateTasks.length - 2} việc khác</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Day Details Side Card */}
                <div className="lg:col-span-4 bg-slate-50 p-5 rounded-[2.5rem] border border-slate-100 flex flex-col justify-between h-full min-h-[400px]">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Chi tiết ngày</p>
                        <h3 className="text-sm font-black text-slate-800">
                          {new Date(selectedCalendarDate).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </h3>
                      </div>
                      <button
                        onClick={() => handleOpenAddForm(selectedCalendarDate)}
                        className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition-all border border-blue-100"
                        title="Thêm việc cho ngày này"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                      {getTasksForDate(new Date(selectedCalendarDate)).map((t) => {
                        const linkedCust = getCustomerForTask(t);
                        const assignedTo = users.find(u => u.id === t.assignedToId);
                        
                        return (
                          <div key={t.id} className="bg-white p-3 rounded-2xl border border-slate-100 hover:border-slate-200 shadow-sm space-y-2">
                            <div className="flex items-start justify-between">
                              <h4 className={cn("text-xs font-black text-slate-800 uppercase tracking-tight", t.status === 'done' && "line-through text-slate-400")}>
                                {t.title}
                              </h4>
                              <div className="flex gap-1 shrink-0">
                                <button 
                                  onClick={() => handleOpenEditForm(t)}
                                  className="text-slate-400 hover:text-blue-650 p-1 rounded-md"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteTask(t.id, t.projectId, t.title)}
                                  className="text-slate-400 hover:text-red-500 p-1 rounded-md"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>

                            <p className="text-[10px] text-slate-500 line-clamp-2">{t.description || 'Không mô tả.'}</p>
                            
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {linkedCust && (
                                <span className="text-[8px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                  🏢 {linkedCust.name}
                                </span>
                              )}
                              {assignedTo && (
                                <span className="text-[8px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                                  👤 {assignedTo.displayName || assignedTo.username}
                                </span>
                              )}
                            </div>

                            {/* Status Quick Toggle */}
                            <div className="flex justify-end pt-1 border-t border-slate-100 gap-1">
                              {t.status !== 'done' ? (
                                <button
                                  onClick={() => handleQuickStatusChange(t.id, 'done', t.projectId, t.title)}
                                  className="text-[8px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-100 transition-colors"
                                >
                                  ✓ Đã hoàn thành
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleQuickStatusChange(t.id, 'todo', t.projectId, t.title)}
                                  className="text-[8px] font-black uppercase tracking-wider text-slate-400 bg-slate-50 hover:bg-slate-100 px-2 py-1 rounded-lg border border-slate-100 transition-colors"
                                >
                                  Làm lại (Todo)
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {getTasksForDate(new Date(selectedCalendarDate)).length === 0 && (
                        <div className="text-center py-10 text-slate-400 text-[10px] font-bold uppercase tracking-wider whitespace-normal">
                          Không ghi nhận công việc nào cho ngày này
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200/60 bg-white/50 p-4 rounded-2xl border border-slate-100 mt-4">
                    <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">Mẹo lịch trình</p>
                    <p className="text-[10px] text-slate-500 font-bold leading-relaxed">Chọn ngày trên ô lưới để thêm mới cuộc gọi, họp khảo sát, hoặc phân chia thi công dự án tùy biến.</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 2. TASKS LIST COMPONENT PANEL */}
            {activeTab === 'tasks' && (
              <motion.div
                key="tasks"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Search / Filters Bar */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  {/* Search input */}
                  <div className="relative">
                    <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm việc, người phụ trách..."
                      className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-xs outline-none focus:border-blue-500"
                      value={taskSearch}
                      onChange={(e) => setTaskSearch(e.target.value)}
                    />
                  </div>

                  {/* Status filter */}
                  <div className="flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <select
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-xs outline-none"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="all">Mọi trạng thái</option>
                      <option value="todo">Cần làm (Todo)</option>
                      <option value="in_progress">Đang làm</option>
                      <option value="review">Kiểm định / Thử nghiệm</option>
                      <option value="done">Hoàn thành</option>
                    </select>
                  </div>

                  {/* Staff filter */}
                  <select
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-xs outline-none"
                    value={assigneeFilter}
                    onChange={(e) => setAssigneeFilter(e.target.value)}
                  >
                    <option value="all">Tất cả phụ trách</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.displayName || u.username} ({u.role})</option>
                    ))}
                  </select>

                  {/* Project filter */}
                  <select
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-xs outline-none"
                    value={projectFilter}
                    onChange={(e) => setProjectFilter(e.target.value)}
                  >
                    <option value="all">Theo dự án Solar</option>
                    {projects.map(p => {
                      const cust = customers.find(c => c.id === p.customerId);
                      return (
                        <option key={p.id} value={p.id}>
                          {cust ? cust.name : `Dự án Solar #${p.id.substring(0,6)}`}
                        </option>
                      )
                    })}
                  </select>
                </div>

                {/* Main list breakdown */}
                <div className="space-y-3">
                  {filteredTasks.map((t) => {
                    const assignedUser = users.find(u => u.id === t.assignedToId);
                    const creatorUser = users.find(u => u.id === t.creatorId);
                    const isOverdue = checkTaskOverdue(t);
                    const isDueSoon = checkTaskDueSoon(t);
                    
                    return (
                      <div 
                        key={t.id} 
                        className={cn(
                          "p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:bg-slate-50/50",
                          t.status === 'done' 
                            ? "border-slate-100 bg-slate-50/20" 
                            : isOverdue 
                              ? "border-rose-100 bg-rose-50/10" 
                              : "border-slate-200 bg-white"
                        )}
                      >
                        <div className="flex items-start gap-3.5 min-w-0 flex-1">
                          {/* Checkbox trigger state */}
                          <button
                            onClick={() => handleQuickStatusChange(t.id, t.status === 'done' ? 'todo' : 'done', t.projectId, t.title)}
                            className="mt-1 shrink-0"
                          >
                            <div className={cn(
                              "w-5 h-5 rounded-md border flex items-center justify-center transition-colors",
                              t.status === 'done' 
                                ? "bg-emerald-500 border-emerald-600 text-white" 
                                : isOverdue 
                                  ? "border-rose-400 hover:bg-rose-50" 
                                  : "border-slate-300 hover:bg-blue-50"
                            )}>
                              {t.status === 'done' && <CheckSquare className="h-3.5 w-3.5" />}
                            </div>
                          </button>

                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className={cn(
                                "text-sm font-black text-slate-800 uppercase tracking-tight truncate max-w-[300px]",
                                t.status === 'done' && "line-through text-slate-400"
                              )}>
                                {t.title}
                              </h3>
                              
                              {/* Status Badge */}
                              <span className={cn(
                                "text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded",
                                t.status === 'done' 
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                                  : t.status === 'in_progress' 
                                    ? "bg-blue-50 text-blue-700 border border-blue-100"
                                    : t.status === 'review'
                                      ? "bg-amber-50 text-amber-700 border border-amber-100"
                                      : "bg-slate-100 text-slate-600 border border-slate-200"
                              )}>
                                {getStatusLabelText(t.status)}
                              </span>

                              {isOverdue && (
                                <span className="bg-rose-500 text-white text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded flex items-center gap-1 animate-pulse">
                                  <AlertTriangle className="h-2.5 w-2.5" /> Quá hạn
                                </span>
                              )}
                              
                              {isDueSoon && (
                                <span className="bg-amber-400 text-slate-900 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded">
                                  Hạn Hôm Nay/Mai
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-500 max-w-xl md:truncate">{t.description || 'Không có ghi chú mô tả thêm.'}</p>
                            
                            {/* Metadata labels */}
                            <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] text-slate-400 font-bold">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5 text-slate-300" />
                                Hạn: <strong className={cn(isOverdue && "text-rose-500")}>{getDueDateString(t.dueDate)}</strong>
                              </span>

                              <span className="flex items-center gap-1">
                                <UserCheck className="h-3.5 w-3.5 text-slate-300" />
                                Phân công: <strong className="text-slate-600 uppercase">{assignedUser ? (assignedUser.displayName || assignedUser.username) : 'Ủy thác'}</strong>
                              </span>

                              {(t.projectId || t.isCrmReminder) && (
                                <span className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 text-slate-500">
                                  <Briefcase className="h-3 w-3" />
                                  Khách hàng: <strong className="text-slate-700 uppercase">{getCustomerForTask(t)?.name || 'N/A'}</strong>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Inline controls */}
                        <div className="flex items-center gap-2 md:border-l md:border-slate-100 md:pl-4 shrink-0 justify-end">
                          <button
                            onClick={() => handleOpenEditForm(t)}
                            className="p-2.5 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-100 rounded-xl transition-all"
                            title="Chỉnh sửa công việc"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTask(t.id, t.projectId, t.title)}
                            className="p-2.5 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 border border-slate-100 rounded-xl transition-all"
                            title="Xóa công việc"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {filteredTasks.length === 0 && (
                    <div className="text-center py-20 text-slate-400 font-bold uppercase tracking-wider text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      Không tìm thấy công việc nào phù hợp với bộ lọc hiện tại
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* 3. STAFF WORKLOAD VIEW PANEL */}
            {activeTab === 'staff' && (
              <motion.div
                key="staff"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-2 px-2">
                  <div className="w-1 h-4 bg-blue-600 rounded-full" />
                  <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-700">Tình hình nhân sự & Phân chia tải lượng</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {users.map((member) => {
                    const memberTasks = combinedTasks.filter(t => t.assignedToId === member.id);
                    const activeCount = memberTasks.filter(t => t.status !== 'done').length;
                    const doneCount = memberTasks.filter(t => t.status === 'done').length;
                    
                    const progressRate = memberTasks.length > 0 
                      ? Math.round((doneCount / memberTasks.length) * 100) 
                      : 100;
                    
                    return (
                      <div key={member.id} className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow relative overflow-hidden">
                        {/* Upper border badge according to task workload */}
                        <div className={cn(
                          "absolute top-0 left-0 right-0 h-1.5",
                          activeCount > 5 ? "bg-rose-500" : activeCount > 2 ? "bg-amber-400" : "bg-emerald-500"
                        )} />

                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-slate-900 border border-slate-800 text-white font-black uppercase text-sm rounded-2xl flex items-center justify-center">
                            {(member.displayName || member.username).substring(0, 2)}
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">{member.displayName || member.username}</h4>
                            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">{member.role} • {member.status}</p>
                          </div>
                        </div>

                        {/* Interactive load meter */}
                        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500 font-bold">Hiệu suất hoàn tất:</span>
                            <span className="text-slate-800 font-black">{progressRate}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-600 rounded-full transition-all duration-500" 
                              style={{ width: `${progressRate}%` }}
                            />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 pt-1.5 text-center">
                            <div className="p-2 bg-white rounded-xl border border-slate-100">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Cần xử lý</p>
                              <p className={cn(
                                "text-base font-black tracking-tight",
                                activeCount > 3 ? "text-rose-500" : "text-slate-800"
                              )}>{activeCount}</p>
                            </div>
                            <div className="p-2 bg-white rounded-xl border border-slate-100">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Đã xong</p>
                              <p className="text-base font-black text-emerald-600 tracking-tight">{doneCount}</p>
                            </div>
                          </div>
                        </div>

                        {/* Quick filter trigger */}
                        <button
                          onClick={() => {
                            setAssigneeFilter(member.id);
                            setActiveTab('tasks');
                          }}
                          className="w-full text-center py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-150 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 transition-colors"
                        >
                          Xem các công việc phụ trách
                        </button>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* 4. REPORTS VIEW PANEL */}
            {activeTab === 'reports' && (
              <motion.div
                key="reports"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-2 px-2">
                  <div className="w-1 h-4 bg-emerald-600 rounded-full" />
                  <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-700">Đồ thị tiến trình & Chỉ số bàn giao</h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Task Completion Rate (Custom pure SVG visualization) */}
                  <div className="lg:col-span-4 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between items-center text-center">
                    <div className="w-full text-left pb-2 border-b border-slate-100 mb-4">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Hiệu suất hoàn tất</p>
                      <h4 className="text-sm font-black text-slate-800">Task Completion Rate</h4>
                    </div>

                    {(() => {
                      const totalCount = combinedTasks.length;
                      const doneCount = combinedTasks.filter(t => t.status === 'done').length;
                      const percentage = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
                      
                      return (
                        <div className="space-y-4">
                          <div className="w-40 h-40 rounded-full bg-slate-50 border-8 border-slate-100 flex items-center justify-center relative shadow-inner">
                            <svg className="w-40 h-40 absolute -rotate-90">
                              <circle 
                                cx="80" cy="80" r="66" 
                                fill="transparent" 
                                stroke="#10b981" 
                                strokeWidth="8" 
                                strokeDasharray={414.69} 
                                strokeDashoffset={414.69 * (1 - percentage / 100)} 
                                className="transition-all duration-700"
                              />
                            </svg>
                            <div>
                              <p className="text-3xl font-black text-slate-800 font-mono leading-none">{percentage}%</p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Nhiệm vụ xong</p>
                            </div>
                          </div>

                          <div className="text-slate-500 text-xs font-medium max-w-[220px]">
                            Đã nghiệm thu <strong className="text-slate-800">{doneCount}</strong> trên tổng số <strong className="text-slate-800">{totalCount}</strong> đầu việc của toàn bộ hệ thống solar.
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Task Status Distribustion Grid (8 cols) */}
                  <div className="lg:col-span-8 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
                    <div className="pb-2 border-b border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Phần bổ công việc</p>
                      <h4 className="text-sm font-black text-slate-800">Status Allocation Metrics</h4>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { key: 'todo', label: 'Cần làm (Todo)', color: 'bg-slate-400', count: combinedTasks.filter(t => t.status === 'todo').length, spec: 'Chưa khởi chạy' },
                        { key: 'in_progress', label: 'Đang làm (In Progress)', color: 'bg-blue-600', count: combinedTasks.filter(t => t.status === 'in_progress').length, spec: 'Đang xử lý kỹ thuật' },
                        { key: 'review', label: 'Kiểm tra (Review/Test)', color: 'bg-amber-400', count: combinedTasks.filter(t => t.status === 'review').length, spec: 'Đang đối soát thiết bị' },
                        { key: 'done', label: 'Hoàn tất (Done)', color: 'bg-emerald-500', count: combinedTasks.filter(t => t.status === 'done').length, spec: 'Đã ký tống nghiệm thu' },
                      ].map((st) => {
                        const pctAll = combinedTasks.length > 0 ? (st.count / combinedTasks.length) * 100 : 0;
                        return (
                          <div key={st.key} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors">
                            <div className="flex justify-between items-center text-xs mb-1.5">
                              <span className="font-extrabold text-slate-700 flex items-center gap-1.5">
                                <span className={cn("w-2 h-2 rounded-full", st.color)} />
                                {st.label}
                              </span>
                              <span className="font-black text-slate-800">{st.count} việc</span>
                            </div>
                            
                            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div className={cn("h-full rounded-full", st.color)} style={{ width: `${pctAll}%` }} />
                            </div>

                            <div className="flex justify-between items-center text-[9px] text-slate-400 mt-1 font-bold uppercase">
                              <span>Mô tả:</span>
                              <span className="text-slate-600 font-extrabold">{st.spec}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="p-4 bg-amber-50/20 border border-amber-200/50 rounded-2xl flex items-center gap-3">
                      <Info className="h-5 w-5 text-amber-500 shrink-0" />
                      <p className="text-[10px] text-slate-600 leading-normal font-medium">Báo cáo cập nhật trực tuyến giúp Nhà quản trị quan sát chính xác tỉ lệ tắc nghẽn công trình (Chai cổ chai) ở khâu chuẩn bị báo giá hay lắp ráp.</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 5. ALERTS PANEL */}
            {activeTab === 'alerts' && (
              <motion.div
                key="alerts"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-rose-600 rounded-full" />
                    <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-700">Thông báo nhắc việc gấp & Trễ hạn</h3>
                  </div>

                  <span className="text-[10px] px-2.5 py-1 bg-rose-50 text-rose-600 font-black rounded-lg border border-rose-100 uppercase tracking-wider">
                    {totalAlertsCount} cảnh báo hoạt động
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Overdue Section */}
                  <div className="space-y-2.5">
                    <h4 className="text-[11px] font-black uppercase text-rose-600 tracking-wider flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
                      Công việc trễ hạn (Overdue)
                    </h4>
                    
                    <div className="space-y-2">
                      {overdueTasks.map((t) => (
                        <div key={t.id} className="bg-rose-50/30 p-3.5 rounded-2xl border border-rose-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                          <div>
                            <p className="font-black text-rose-900 uppercase tracking-tight">{t.title}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">Phân công: <strong className="text-slate-700">{users.find(u => u.id === t.assignedToId)?.displayName || 'N/A'}</strong></p>
                          </div>
                          
                          <div className="flex items-center gap-3 justify-between md:justify-end">
                            <span className="font-mono text-rose-600 font-bold">Hạn cụ thể: {getDueDateString(t.dueDate)}</span>
                            <button
                              onClick={() => {
                                handleOpenEditForm(t);
                              }}
                              className="px-3 py-1.5 bg-blue-650 hover:bg-blue-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                            >
                              Gia hạn / Sửa
                            </button>
                          </div>
                        </div>
                      ))}

                      {overdueTasks.length === 0 && (
                        <div className="text-center py-6 text-slate-400 font-bold text-[10px] uppercase tracking-wider bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          Tuyệt vời! Không có công việc nào trễ hạn.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Due Soon Section */}
                  <div className="space-y-2.5 pt-4">
                    <h4 className="text-[11px] font-black uppercase text-amber-600 tracking-wider flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                      Cần hoàn tất hôm nay / ngày mai (Urgent)
                    </h4>
                    
                    <div className="space-y-2">
                      {dueSoonTasks.map((t) => (
                        <div key={t.id} className="bg-amber-50/20 p-3.5 rounded-2xl border border-amber-250 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                          <div>
                            <p className="font-black text-amber-900 uppercase tracking-tight">{t.title}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">Phụ trách: <strong className="text-slate-700">{users.find(u => u.id === t.assignedToId)?.displayName || 'N/A'}</strong></p>
                          </div>
                          
                          <div className="flex items-center gap-3 justify-between md:justify-end">
                            <span className="font-mono text-amber-700 font-bold">Sắp đến hạn: {getDueDateString(t.dueDate)}</span>
                            <button
                              onClick={() => handleQuickStatusChange(t.id, 'done', t.projectId, t.title)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                            >
                              Đánh dấu Xong
                            </button>
                          </div>
                        </div>
                      ))}

                      {dueSoonTasks.length === 0 && (
                        <div className="text-center py-6 text-slate-400 font-bold text-[10px] uppercase tracking-wider bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          Chưa ghi nhận phản hồi công việc gấp sắp đến hạn.
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Task Creation / Edit Dialog Modal */}
      <AnimatePresence>
        {isAddingTask && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 md:p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest leading-none">Task Planner</p>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mt-1">
                    {editingTask ? 'Cập nhật công việc' : 'Khởi tạo công việc'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsAddingTask(false)}
                  className="w-10 h-10 bg-white border border-slate-200 text-slate-405 hover:text-slate-800 rounded-xl flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveTask} className="p-6 md:p-8 space-y-4">
                {/* Title */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Tiêu đề công việc <strong className="text-rose-500">*</strong></label>
                  <input
                    type="text"
                    required
                    placeholder="ví dụ: Khảo sát đo mái nhà anh Nam"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs outline-none focus:border-blue-500"
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Chi tiết mô tả</label>
                  <textarea
                    placeholder="Nhập ghi chú yêu cầu, phụ trang mặt bằng cần nắm..."
                    rows={3}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs outline-none focus:border-blue-500 reschedule"
                    value={taskForm.description}
                    onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  />
                </div>

                {/* Grid inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Due Date */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Hạn hoàn thành (Deadline)</label>
                    <input
                      type="date"
                      required
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs outline-none focus:border-blue-500"
                      value={taskForm.dueDate}
                      onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    />
                  </div>

                  {/* Task Status */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Trạng thái hiện tại</label>
                    <select
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-xs outline-none focus:border-blue-500"
                      value={taskForm.status}
                      onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value as TaskStatus })}
                    >
                      <option value="todo">Cần làm (Todo)</option>
                      <option value="in_progress">Đang làm</option>
                      <option value="review">Cần kiểm định</option>
                      <option value="done">Hoàn thành</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Linked Project */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Liên kết dự án Solar</label>
                    <select
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-xs outline-none focus:border-blue-500"
                      value={taskForm.projectId}
                      onChange={(e) => setTaskForm({ ...taskForm, projectId: e.target.value })}
                    >
                      <option value="">Không liên kết dự án</option>
                      {projects.map((p) => {
                        const cust = customers.find(c => c.id === p.customerId);
                        return (
                          <option key={p.id} value={p.id}>
                            {cust ? cust.name : `Dự án #${p.id.substring(0,8)}`}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Assigned Staff */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Phân công nhân sự</label>
                    <select
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-xs outline-none focus:border-blue-500"
                      value={taskForm.assignedToId}
                      onChange={(e) => setTaskForm({ ...taskForm, assignedToId: e.target.value })}
                    >
                      <option value="">Chờ phân bổ (Ủy thác)</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.displayName || u.username} ({u.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddingTask(false)}
                    className="px-5 py-3 border border-slate-200 hover:bg-slate-50 transition-colors rounded-xl text-xs font-black uppercase tracking-widest text-slate-500"
                  >
                    Bỏ qua
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:scale-[1.02]"
                  >
                    {editingTask ? 'Lưu cập nhật' : 'Khởi chạy công việc'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
