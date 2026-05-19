import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { Project, ProjectTask, ProjectActivity, AppUser, TaskStatus, ProjectStatus } from '../types';
import { 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  Plus, 
  Calendar, 
  User, 
  AlertCircle,
  ChevronRight,
  MoreVertical,
  Activity,
  ArrowLeft,
  Layout,
  ListTodo,
  TrendingUp,
  Settings
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  projectId: string;
  onClose: () => void;
  userId?: string;
  userName?: string;
}

export default function ProjectProgressTracker({ projectId, onClose, userId, userName }: Props) {
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [loading, setLoading] = useState(true);

  // New Task State
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    status: 'todo' as TaskStatus,
    assignedToId: ''
  });

  useEffect(() => {
    if (!projectId || !userId) return;

    const unsubProj = onSnapshot(doc(db, 'projects', projectId), (s) => {
      if (s.exists()) setProject({ id: s.id, ...s.data() } as Project);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `projects/${projectId}`);
      setLoading(false);
    });

    const unsubTasks = onSnapshot(
      query(collection(db, 'projectTasks'), where('projectId', '==', projectId), orderBy('createdAt', 'desc')),
      (s) => setTasks(s.docs.map(d => ({ id: d.id, ...d.data() } as ProjectTask))),
      (error) => handleFirestoreError(error, OperationType.GET, 'projectTasks')
    );

    const unsubActivities = onSnapshot(
      query(collection(db, 'projectActivities'), where('projectId', '==', projectId), orderBy('createdAt', 'desc')),
      (s) => setActivities(s.docs.map(d => ({ id: d.id, ...d.data() } as ProjectActivity))),
      (error) => handleFirestoreError(error, OperationType.GET, 'projectActivities')
    );

    const unsubUsers = onSnapshot(collection(db, 'users'), (s) => {
      setUsers(s.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    return () => {
      unsubProj();
      unsubTasks();
      unsubActivities();
      unsubUsers();
    };
  }, [projectId, userId]);

  const logActivity = async (type: ProjectActivity['type'], description: string) => {
    if (!userId || !userName) return;
    try {
      await addDoc(collection(db, 'projectActivities'), {
        projectId,
        userId,
        userName,
        type,
        description,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Failed to log activity:", e);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title || !userId) return;

    try {
      await addDoc(collection(db, 'projectTasks'), {
        projectId,
        creatorId: userId,
        title: newTask.title,
        description: newTask.description,
        status: newTask.status,
        assignedToId: newTask.assignedToId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await logActivity('task_update', `Đã tạo công việc mới: ${newTask.title}`);
      
      setNewTask({ title: '', description: '', status: 'todo', assignedToId: '' });
      setIsAddingTask(false);
      updateProjectProgress();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'projectTasks');
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: TaskStatus, title: string) => {
    try {
      await updateDoc(doc(db, 'projectTasks', taskId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      await logActivity('task_update', `Cập nhật công việc "${title}" sang trạng thái ${newStatus.toUpperCase()}`);
      updateProjectProgress();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projectTasks/${taskId}`);
    }
  };

  const updateProjectProgress = async () => {
     // Local calculation for immediate UI feel, though snapshot will handle it
     const q = query(collection(db, 'projectTasks'), where('projectId', '==', projectId));
     const snap = await getDocs(q);
     const allTasks = snap.docs.map(d => d.data() as ProjectTask);
     if (allTasks.length === 0) return;

     const done = allTasks.filter(t => t.status === 'done').length;
     const progress = Math.round((done / allTasks.length) * 100);

     await updateDoc(doc(db, 'projects', projectId), {
       progress,
       updatedAt: serverTimestamp()
     });
  };

  const handleUpdatePhase = async (phase: ProjectStatus) => {
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        status: phase,
        updatedAt: serverTimestamp()
      });
      await logActivity('status_change', `Đã chuyển giai đoạn dự án sang: ${phase.toUpperCase()}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
    }
  };

  if (loading || !project) return <div className="p-10 text-center font-black uppercase text-slate-400 animate-pulse">Khởi tạo dữ liệu...</div>;

  const phases: ProjectStatus[] = ['lead', 'survey', 'proposal', 'contract', 'installation', 'completed'];
  
  const getPhaseLabel = (p: string) => {
    switch(p) {
      case 'lead': return 'Tiềm năng';
      case 'survey': return 'Khảo sát';
      case 'proposal': return 'Báo giá';
      case 'contract': return 'Hợp đồng';
      case 'installation': return 'Thi công';
      case 'completed': return 'Nghiệm thu';
      default: return p;
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-0 pb-20 space-y-8">
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-6">
          <button 
            onClick={onClose}
            className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-white hover:shadow-md transition-all active:scale-90"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none">Theo Dõi Tiến Độ</h1>
              <span className="px-3 py-1 bg-blue-600 text-[10px] font-black text-white rounded-full shadow-lg shadow-blue-200 uppercase tracking-widest">Live</span>
            </div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em]">Dự án: {projectId.substring(0, 8)} • Cập nhật {project.updatedAt?.toDate?.().toLocaleTimeString('vi-VN')}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="text-right hidden sm:block">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Giai đoạn hiện tại</p>
              <p className="text-sm font-black text-blue-600 uppercase tracking-tight">{getPhaseLabel(project.status)}</p>
           </div>
           <div className="w-16 h-16 rounded-full border-[6px] border-slate-100 flex items-center justify-center relative">
              <svg className="w-16 h-16 absolute -rotate-90">
                 <circle 
                   cx="32" cy="32" r="26" 
                   fill="transparent" 
                   stroke="currentColor" 
                   strokeWidth="6" 
                   className="text-blue-600" 
                   strokeDasharray={163.36} 
                   strokeDashoffset={163.36 * (1 - (project.progress || 0) / 100)} 
                 />
              </svg>
              <span className="text-sm font-black text-slate-900">{project.progress || 0}%</span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar: Navigation & Phase Control */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
             <div className="flex items-center gap-3 pb-4 border-b border-slate-50">
                <Settings className="h-4 w-4 text-slate-400" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Quy trình dự án</h3>
             </div>
             <div className="space-y-1">
                {phases.map((p, idx) => (
                  <button
                    key={p}
                    onClick={() => handleUpdatePhase(p)}
                    className={cn(
                      "w-full group text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between",
                      project.status === p 
                        ? "bg-slate-900 text-white shadow-lg shadow-slate-200" 
                        : "text-slate-500 hover:bg-slate-50 border border-transparent hover:border-slate-100"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black",
                        project.status === p ? "bg-blue-600 text-white" : "bg-slate-100 group-hover:bg-white"
                      )}>
                        {idx + 1}
                      </span>
                      <span className="text-[11px] font-black uppercase tracking-tight">{getPhaseLabel(p)}</span>
                    </div>
                    {project.status === p && <CheckCircle2 className="h-3 w-3 text-blue-400" />}
                  </button>
                ))}
             </div>
          </div>

          <div className="bg-slate-900 p-8 rounded-[2rem] text-white shadow-2xl shadow-slate-200 overflow-hidden relative">
             <TrendingUp className="h-10 w-10 text-blue-500/50 absolute -right-2 -top-2 rotate-12" />
             <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-4">Thành viên tham gia</h3>
             <div className="space-y-4">
                {users.filter(u => u.id === project.assignedSalesId || u.id === project.assignedOperatorId).map(u => (
                  <div key={u.id} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xs font-black uppercase">
                       {(u.displayName || u.username).substring(0, 2)}
                    </div>
                    <div>
                      <p className="text-xs font-black tracking-tight">{u.displayName}</p>
                      <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">{u.role}</p>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        </div>

        {/* Main Content: Tasks & Activity */}
        <div className="lg:col-span-3 space-y-8">
           {/* Section Tabs */}
           <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm inline-flex gap-2">
              <button className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">
                <ListTodo className="h-4 w-4" /> Công việc (Tasks)
              </button>
              <button disabled className="flex items-center gap-2 px-5 py-2.5 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">
                <Activity className="h-4 w-4" /> Nhật ký (Logs)
              </button>
           </div>

           {/* Task Management Section */}
           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-10">
              <div className="flex items-center justify-between">
                 <div>
                   <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-1">Quản lý Công việc</h2>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">{tasks.length} hạng mục trong hệ thống</p>
                 </div>
                 <button 
                  onClick={() => setIsAddingTask(true)}
                  className="flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
                 >
                   <Plus className="h-4 w-4" /> Giao việc mới
                 </button>
              </div>

              {/* Task Columns (Bento Inspired) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {(['todo', 'in_progress', 'done'] as TaskStatus[]).map((colStatus) => (
                    <div key={colStatus} className="space-y-4">
                       <div className="flex items-center justify-between px-2">
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-widest",
                            colStatus === 'todo' ? "text-slate-400" : colStatus === 'in_progress' ? "text-blue-500" : "text-green-600"
                          )}>
                             {colStatus === 'todo' ? 'Cần làm' : colStatus === 'in_progress' ? 'Đang thực hiện' : 'Hoàn thành'}
                          </span>
                          <span className="w-5 h-5 rounded-full bg-slate-50 flex items-center justify-center text-[9px] font-black text-slate-400">
                             {tasks.filter(t => t.status === colStatus).length}
                          </span>
                       </div>
                       
                       <AnimatePresence mode="popLayout">
                         {tasks.filter(t => t.status === colStatus).map((task) => (
                           <motion.div 
                             layout
                             initial={{ opacity: 0, y: 10 }}
                             animate={{ opacity: 1, y: 0 }}
                             exit={{ opacity: 0, scale: 0.95 }}
                             key={task.id}
                             className="group bg-slate-50 border border-slate-100 p-4 rounded-2xl hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1 transition-all cursor-pointer relative"
                           >
                              <div className="flex justify-between items-start mb-3">
                                 <h4 className="text-xs font-black text-slate-800 leading-tight group-hover:text-blue-600 transition-colors">{task.title}</h4>
                                 <button className="text-slate-300 hover:text-slate-900 transition-colors">
                                    <MoreVertical className="h-4 w-4" />
                                 </button>
                              </div>
                              <p className="text-[10px] text-slate-500 line-clamp-2 mb-4 font-medium">{task.description}</p>
                              
                              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                 <div className="flex -space-x-1 grayscale group-hover:grayscale-0 transition-all">
                                    <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                                       <User className="h-3 w-3 text-slate-400" />
                                    </div>
                                 </div>
                                 <div className="flex gap-1.5">
                                    {colStatus !== 'done' && (
                                       <button 
                                          onClick={() => handleUpdateTaskStatus(task.id, 'done', task.title)}
                                          className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-600 hover:text-white transition-all shadow-sm"
                                       >
                                          <CheckCircle2 className="h-3.5 w-3.5" />
                                       </button>
                                    )}
                                    {colStatus === 'todo' && (
                                       <button 
                                          onClick={() => handleUpdateTaskStatus(task.id, 'in_progress', task.title)}
                                          className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                       >
                                          <TrendingUp className="h-3.5 w-3.5" />
                                       </button>
                                    )}
                                 </div>
                              </div>
                           </motion.div>
                         ))}
                       </AnimatePresence>
                    </div>
                 ))}
              </div>
           </div>

           {/* Activity Log Grid */}
           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                 <Activity className="h-5 w-5 text-blue-600" />
                 <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Dòng hoạt động</h2>
              </div>
              <div className="relative pl-8 space-y-8 before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                 {activities.map((act) => (
                    <div key={act.id} className="relative group">
                       <div className="absolute -left-[27px] top-1 w-4 h-4 rounded-full bg-white border-2 border-slate-100 z-10 group-hover:border-blue-500 transition-colors" />
                       <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{act.userName}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300" />
                          <span className="text-[10px] font-black text-slate-400 tracking-widest">{act.createdAt?.toDate ? act.createdAt.toDate().toLocaleTimeString('vi-VN') : 'Mới'}</span>
                       </div>
                       <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-[11px] font-medium text-slate-700 leading-relaxed">
                          {act.description}
                       </div>
                    </div>
                 ))}
                 {activities.length === 0 && <p className="text-xs text-slate-400 font-bold uppercase tracking-widest italic py-4">Chưa có hoạt động nào được ghi lại</p>}
              </div>
           </div>
        </div>
      </div>

      {/* Task Modal */}
      <AnimatePresence>
        {isAddingTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setIsAddingTask(false)}
               className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            />
            <motion.div
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
               <form onSubmit={handleCreateTask} className="p-8 md:p-10 space-y-8">
                  <div className="flex items-center justify-between">
                     <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Giao việc mới</h3>
                     <ListTodo className="h-6 w-6 text-blue-600" />
                  </div>

                  <div className="space-y-6">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Tiêu đề công việc</label>
                        <input 
                           required
                           className="w-full bg-slate-50 border border-slate-100 px-6 py-4 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-blue-600 transition-all shadow-inner"
                           placeholder="VD: Khảo sát vị trí lắp Inverter..."
                           value={newTask.title}
                           onChange={e => setNewTask({...newTask, title: e.target.value})}
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Mô tả chi tiết</label>
                        <textarea 
                           className="w-full bg-slate-50 border border-slate-100 px-6 py-4 rounded-2xl text-sm font-medium outline-none focus:bg-white focus:border-blue-600 transition-all shadow-inner min-h-[120px]"
                           placeholder="Nội dung hướng dẫn chi tiết cho nhân viên..."
                           value={newTask.description}
                           onChange={e => setNewTask({...newTask, description: e.target.value})}
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Nhân viên phụ trách</label>
                        <select 
                           className="w-full bg-slate-50 border border-slate-100 px-6 py-4 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-blue-600 transition-all appearance-none"
                           value={newTask.assignedToId}
                           onChange={e => setNewTask({...newTask, assignedToId: e.target.value})}
                        >
                           <option value="">-- Chọn nhân viên --</option>
                           {users.filter(u => ['sales_rep', 'operator', 'manager', 'admin'].includes(u.role)).map(u => (
                              <option key={u.id} value={u.id}>{u.displayName.toUpperCase()}</option>
                           ))}
                        </select>
                     </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                     <button 
                        type="button"
                        onClick={() => setIsAddingTask(false)}
                        className="flex-1 px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                     >
                        Hủy
                     </button>
                     <button 
                        type="submit"
                        className="flex-1 px-8 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100"
                     >
                        Xác nhận giao việc
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
