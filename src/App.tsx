/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Sun, 
  ClipboardList, 
  TrendingUp, 
  FileText, 
  Settings, 
  Plus, 
  Menu, 
  X,
  LayoutDashboard,
  LogOut,
  UserCog,
  Sliders,
  Box,
  Bell,
  AlertTriangle,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, handleFirestoreError, OperationType } from './lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, limit, onSnapshot, collectionGroup } from 'firebase/firestore';
import { cn } from './lib/utils';
import { UserRole } from './types';

// Components
import CustomerList from './components/CustomerList';
import ProjectDashboard from './components/ProjectDashboard';
import CatalogManager from './components/CatalogManager';
import ProjectEditor from './components/ProjectEditor';
import ProjectProgressTracker from './components/ProjectProgressTracker';
import UserManagement from './components/UserManagement';
import SystemSettings from './components/SystemSettings';
import WorkSchedulerHub from './components/WorkSchedulerHub';
import UserProfile from './components/UserProfile';
import { Logo } from './components/Logo';

type View = 'dashboard' | 'customers' | 'projects' | 'catalog' | 'editor' | 'users' | 'tracker' | 'settings' | 'tasks' | 'profile';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [targetCustomerId, setTargetCustomerId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('sales_rep');
  const [userStatus, setUserStatus] = useState<'active' | 'inactive' | 'pending'>('pending');
  const [profileLoading, setProfileLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [userTasks, setUserTasks] = useState<any[]>([]);
  const [crmReminders, setCrmReminders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (!user) {
      setUserTasks([]);
      return;
    }
    const qTask = query(
      collection(db, 'projectTasks'),
      where('assignedToId', '==', user.uid)
    );
    const unsubTasks = onSnapshot(qTask, (s) => {
      setUserTasks(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Error loading tasks for notification bar:", error);
    });
    return () => unsubTasks();
  }, [user?.uid]);

  useEffect(() => {
    if (!user) {
      setCrmReminders([]);
      setCustomers([]);
      return;
    }

    const qCust = userRole === 'sales_rep'
      ? query(collection(db, 'customers'), where('assignedSalesId', '==', user.uid))
      : collection(db, 'customers');

    const unsubCust = onSnapshot(qCust, (snapshot) => {
      setCustomers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Error loading customers for notifications:", error);
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
        console.error("Error loading CRM reminders for notifications:", error);
      }
    );

    return () => {
      unsubCust();
      unsubReminders();
    };
  }, [user?.uid, userRole]);

  const checkOverdue = React.useCallback((t: any) => {
    if (t.status === 'done' || !t.dueDate) return false;
    try {
      const dDate = t.dueDate.seconds ? new Date(t.dueDate.seconds * 1000) : new Date(t.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dDate.setHours(0, 0, 0, 0);
      return dDate < today;
    } catch (e) {
      return false;
    }
  }, []);

  const checkDueSoon = React.useCallback((t: any) => {
    if (t.status === 'done' || !t.dueDate) return false;
    try {
      const dDate = t.dueDate.seconds ? new Date(t.dueDate.seconds * 1000) : new Date(t.dueDate);
      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(today.getDate() + 1);
      
      today.setHours(0, 0, 0, 0);
      tomorrow.setHours(23, 59, 59, 999);
      
      const checkDate = new Date(dDate);
      checkDate.setHours(12, 0, 0, 0);
      
      return checkDate >= today && checkDate <= tomorrow;
    } catch (e) {
      return false;
    }
  }, []);

  const combinedUserTasks = React.useMemo(() => {
    const formattedProjectTasks = userTasks.map(t => ({
      ...t,
      type: 'project_task' as const,
      isCrmReminder: false,
    }));

    const formattedCrmTasks = crmReminders
      .filter(rem => {
        const customer = customers.find(c => c.id === rem.customerId);
        const isAssignedToUser = rem.assignedToId === user?.uid || customer?.assignedSalesId === user?.uid;
        if (userRole === 'sales_rep') {
          return isAssignedToUser;
        }
        return rem.assignedToId === user?.uid || isAssignedToUser;
      })
      .map(rem => {
        const customer = customers.find(c => c.id === rem.customerId);
        const customerName = customer ? customer.name : 'Khách hàng';
        return {
          id: rem.id,
          title: `[CRM] ${rem.title}`,
          description: `Chăm sóc khách hàng: ${customerName}. ${rem.title}`,
          dueDate: rem.dueDate,
          status: rem.status === 'completed' ? 'done' as const : 'todo' as const,
          isCrmReminder: true,
          customerId: rem.customerId,
          customerName: customerName,
        };
      });

    return [...formattedProjectTasks, ...formattedCrmTasks];
  }, [userTasks, crmReminders, customers, user?.uid, userRole]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthLoading(false);
      
      if (u) {
        setProfileLoading(true);
        const userRef = doc(db, 'users', u.uid);
        try {
          const userDoc = await getDoc(userRef);
          if (!userDoc.exists()) {
            const username = u.email?.split('@')[0] || 'unknown';
            const role: UserRole = username === 'mrhieu' ? 'admin' : 'sales_rep';
            const status = username === 'mrhieu' ? 'active' : 'pending';
            
            await setDoc(userRef, {
              username,
              email: u.email,
              role,
              displayName: username.toUpperCase(),
              createdAt: serverTimestamp(),
              lastLogin: serverTimestamp(),
              status
            });
          } else {
            await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true });
          }
        } catch (error) {
          console.error("User sync error:", error);
        }
      } else {
        setProfileLoading(false);
      }
    });
    return () => unsubAuth();
  }, []);

  // User status management is now at the top
  useEffect(() => {
    if (!user) {
      setUserRole('sales_rep');
      setUserStatus('pending'); // Default to pending on logout
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    const unsubRole = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setUserRole(data.role || 'sales_rep');
        setUserStatus(data.status || 'pending');
      }
      setProfileLoading(false);
    }, (error) => {
      console.error("Role listener error:", error);
      setProfileLoading(false);
    });

    return () => unsubRole();
  }, [user?.uid]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
        setIsMobileMenuOpen(false);
      } else {
        setSidebarOpen(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    setAuthError(null);
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login failed:", error);
      if (error.code === 'auth/popup-closed-by-user') {
        setAuthError("Popup đã bị đóng trước khi hoàn tất đăng nhập.");
      } else if (error.code === 'auth/cancelled-by-user') {
        setAuthError("Đăng nhập đã bị hủy.");
      } else {
        setAuthError("Đăng nhập Google thất bại: " + (error.message || "Lỗi không xác định"));
      }
    }
  };

  const handleUsernameAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    
    // Convert username to a dummy email for Firebase Auth
    const internalEmail = `${username.toLowerCase().trim()}@truongsonsolar.local`;
    
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, internalEmail, password);
      } else {
        await signInWithEmailAndPassword(auth, internalEmail, password);
      }
    } catch (error: any) {
      console.error("Auth failed:", error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setAuthError("Tên đăng nhập hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại thông tin.");
      } else if (error.code === 'auth/invalid-email') {
        setAuthError("Tên đăng nhập không hợp lệ.");
      } else if (error.code === 'auth/email-already-in-use') {
        setAuthError("Tên đăng nhập này đã tồn tại.");
      } else if (error.code === 'auth/operation-not-allowed') {
        setAuthError("LỖI CẤU HÌNH: Bạn cần bật 'Email/Password' trong Firebase Console > Authentication > Sign-in method để sử dụng tính năng này.");
      } else if (error.code === 'auth/unauthorized-domain') {
        setAuthError("LỖI: Tên miền này chưa được cấp phép trong Firebase Console > Authentication > Settings > Authorized domains.");
      } else {
        setAuthError("Lỗi hệ thống: " + error.message);
      }
    }
  };

  const handleLogout = () => signOut(auth);

  if (authLoading || profileLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white font-sans">
        <Sun className="h-10 w-10 text-amber-400 animate-spin mb-4" />
        <p className="text-sm font-bold uppercase tracking-widest animate-pulse">
          {authLoading ? 'Khởi động hệ thống...' : 'Đang tải thông tin...'}
        </p>
      </div>
    );
  }

  if (user && userStatus !== 'active') {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950 font-sans p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-20">
           <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px]" />
           <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-600 rounded-full blur-[120px]" />
        </div>
        
        <div className="relative z-10 w-full max-w-lg bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl md:rounded-3xl p-6 md:p-10 shadow-2xl text-center">
            <div className="w-20 h-20 bg-white/10 rounded-2xl mx-auto flex items-center justify-center mb-6 border border-white/20">
              {userStatus === 'pending' ? (
                <ClipboardList className="h-10 w-10 text-amber-400" />
              ) : (
                <X className="h-10 w-10 text-red-500" />
              )}
            </div>
            
            <h1 className="text-2xl md:text-3xl font-extrabold text-white mb-2 tracking-tight uppercase">
              {userStatus === 'pending' ? 'Yêu cầu đang chờ duyệt' : 'Tài khoản bị khóa'}
            </h1>
            
            <p className="text-slate-400 text-sm md:text-base font-medium mb-8 leading-relaxed">
              {userStatus === 'pending' 
                ? 'Tài khoản của bạn đã được khởi tạo thành công. Vui lòng liên hệ Quản trị viên để được phê duyệt và gán quyền truy cập hệ thống.' 
                : 'Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ với bộ phận kỹ thuật để biết thêm chi tiết.'}
            </p>

            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 mb-8 text-left">
              <p className="text-[10px] text-slate-500 uppercase font-black mb-2 tracking-widest leading-none">Thông tin tài khoản</p>
              <div className="space-y-2">
                <p className="text-xs text-white font-bold tracking-tight shrink-0 flex items-center gap-2">
                  <span className="text-slate-400 font-medium">Username:</span> {user.email?.split('@')[0]}
                </p>
                <p className="text-xs text-white font-bold tracking-tight shrink-0 flex items-center gap-2">
                  <span className="text-slate-400 font-medium">Email:</span> {user.email}
                </p>
                <p className="text-xs text-white font-bold tracking-tight shrink-0 flex items-center gap-2">
                  <span className="text-slate-400 font-medium">Trạng thái:</span> 
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-black uppercase",
                    userStatus === 'pending' ? "bg-amber-400/20 text-amber-300" : "bg-red-400/20 text-red-300"
                  )}>
                    {userStatus === 'pending' ? 'Chờ duyệt' : 'Đã khóa'}
                  </span>
                </p>
              </div>
            </div>

            <button 
              onClick={handleLogout}
              className="w-full py-4 border border-white/10 text-white rounded-xl font-bold text-sm uppercase tracking-widest transition-all hover:bg-white/5 active:scale-95 flex items-center justify-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Đăng xuất
            </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-950 font-sans p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-20">
           <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px]" />
           <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-600 rounded-full blur-[120px]" />
        </div>
        
        <div className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl md:rounded-3xl p-6 md:p-10 shadow-2xl text-center">
            <Logo className="w-20 h-20 md:w-24 md:h-24 mx-auto mb-6 md:mb-8" />
            <h1 className="text-2xl md:text-5xl font-extrabold text-white mb-2 tracking-tight">TRUONGSONSOLAR</h1>
            <p className="text-slate-400 text-sm md:text-base font-medium mb-6 md:mb-10 leading-relaxed uppercase tracking-widest opacity-80">
              Giải pháp Điện mặt trời Trường Sơn - Chuyên nghiệp & Tận tâm.
            </p>
            
            <form onSubmit={handleUsernameAuth} className="space-y-4 mb-8 text-left">
               <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 ml-1">Tên đăng nhập</label>
                  <input 
                    type="text" 
                    placeholder="Nhập username (ví dụ: mrhieu)"
                    className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-amber-400 transition-colors"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                  />
               </div>
               <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 ml-1">Mật khẩu</label>
                  <input 
                    type="password" 
                    placeholder="••••••••"
                    className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-amber-400 transition-colors"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
               </div>
               {authError && <p className="text-red-400 text-[10px] font-bold uppercase py-1">{authError}</p>}
               <button 
                  type="submit"
                  className="w-full py-4 bg-amber-400 text-slate-900 rounded-xl font-bold text-sm uppercase tracking-widest transition-all hover:bg-amber-300 hover:scale-[1.02] active:scale-95 shadow-xl shadow-amber-400/20"
               >
                  {isSignUp ? 'Đăng ký tài khoản' : 'Đăng nhập hệ thống'}
               </button>
            </form>

            <div className="flex items-center gap-4 mb-8">
               <div className="h-px flex-1 bg-white/10"></div>
               <span className="text-[10px] text-slate-500 font-bold uppercase">Hoặc</span>
               <div className="h-px flex-1 bg-white/10"></div>
            </div>
            
            <button 
              onClick={handleLogin}
              className="w-full py-3 border border-white/10 text-white rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all hover:bg-white/5 active:scale-95"
            >
               <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="Google" />
               Đăng nhập với Google
            </button>
            
            <p className="mt-8 text-[11px] text-slate-400 font-medium">
               {isSignUp ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'} 
               <button 
                onClick={() => setIsSignUp(!isSignUp)}
                className="ml-2 text-amber-400 font-bold hover:underline"
               >
                {isSignUp ? 'Đăng nhập ngay' : 'Đăng ký tại đây'}
               </button>
            </p>

            <p className="mt-8 text-[10px] text-slate-500 uppercase font-bold tracking-widest opacity-40">
               © 2024 Solar Trường Sơn • Technical Portfolio
            </p>
        </div>
      </div>
    );
  }

  const navigation = [
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'customers', label: 'Khách hàng', icon: Users },
    { id: 'projects', label: 'Công trình', icon: Sun },
    { id: 'tasks', label: 'Lịch & Công việc', icon: ClipboardList },
    { id: 'profile', label: 'Cá nhân', icon: UserIcon },
    ...(userRole === 'admin' || userRole === 'manager' ? [
      { id: 'catalog', label: 'Danh mục TB', icon: Box },
      { id: 'users', label: 'Quản lý Nhân sự', icon: UserCog },
      { id: 'settings', label: 'Cấu hình', icon: Sliders }
    ] : []),
  ];

  const handleOpenProject = (id: string) => {
    setSelectedProjectId(id);
    setActiveView('editor');
  };

  const handleOpenTracker = (id: string) => {
    setSelectedProjectId(id);
    setActiveView('tracker');
  };

  const handleViewCustomerProject = async (customerId: string) => {
    try {
      let q;
      if (userRole === 'admin' || userRole === 'manager') {
        q = query(
          collection(db, 'projects'), 
          where('customerId', '==', customerId),
          limit(1)
        );
      } else {
        q = query(
          collection(db, 'projects'), 
          where('customerId', '==', customerId),
          where('assignedSalesId', '==', user.uid),
          limit(1)
        );
      }
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        // Open existing project
        setTargetCustomerId(null);
        handleOpenProject(snapshot.docs[0].id);
      } else {
        setTargetCustomerId(customerId);
        setSelectedProjectId(null);
        setActiveView('editor');
      }
    } catch (error) {
      console.error("Error finding customer project:", error);
      setActiveView('projects');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden relative">
      {/* Top Header - Mobile and Desktop Optimized */}
      <header className="h-16 lg:h-20 bg-white border-b border-slate-200 sticky top-0 z-40 px-4 lg:px-8 flex items-center justify-between shadow-sm backdrop-blur-md bg-white/90">
        <div className="flex items-center gap-3 lg:gap-4">
          <Logo className="w-10 h-10 lg:w-14 lg:h-14 shrink-0" />
          <div>
            <h1 className="text-sm lg:text-lg font-black text-slate-900 tracking-tight uppercase leading-none mb-0.5">TRƯỜNG SƠN SOLAR</h1>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <p className="text-[8px] lg:text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none">Smart Management System</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Real-time Reminder/Alert Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2.5 bg-slate-50 text-slate-500 hover:text-red-500 hover:bg-red-50 border border-slate-100 rounded-xl transition-all relative flex items-center justify-center"
              title="Nhắc việc & Cảnh báo"
            >
              <Bell className="h-4.5 w-4.5" />
              {combinedUserTasks.filter(t => t.status !== 'done').length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[8px] font-black text-white ring-2 ring-white">
                  {combinedUserTasks.filter(t => t.status !== 'done').length}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <>
                  {/* Click outside backdrop */}
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                  
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-4 space-y-3 font-sans"
                  >
                    <div className="pb-2 border-b border-slate-100 flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">🔔 Công việc & Lịch nhắc</span>
                      <span className="text-[9px] px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full font-black uppercase">
                        {combinedUserTasks.filter(t => t.status !== 'done' && (checkOverdue(t) || checkDueSoon(t))).length} gấp / cận kề
                      </span>
                    </div>

                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {/* CATEGORY 1: OVERDUE (QUÁ HẠN) */}
                      {combinedUserTasks.filter(t => t.status !== 'done' && checkOverdue(t)).length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[8px] font-black text-rose-600 uppercase tracking-widest bg-rose-50 px-2 py-0.5 rounded-md w-max">
                            🚨 ĐÃ QUÁ HẠN
                          </p>
                          {combinedUserTasks.filter(t => t.status !== 'done' && checkOverdue(t)).map((t, index) => (
                            <div 
                              key={`overdue-${t.isCrmReminder ? 'crm' : 'proj'}-${t.id || index}-${index}`} 
                              onClick={() => {
                                setActiveView('tasks');
                                setShowNotifications(false);
                              }}
                              className="p-2 bg-rose-50/10 border border-thin border-rose-100 rounded-xl text-xs text-left cursor-pointer hover:bg-rose-50/30 transition-colors space-y-1"
                            >
                              <p className="font-extrabold text-slate-800 uppercase tracking-tight line-clamp-1">
                                {t.title}
                              </p>
                              {t.isCrmReminder && (
                                <p className="text-[9px] font-bold text-slate-400">Khách: {t.customerName}</p>
                              )}
                              <div className="flex justify-between items-center text-[9px] font-bold mt-0.5 text-rose-500">
                                <span>Trễ từ: {t.dueDate ? (t.dueDate.seconds ? new Date(t.dueDate.seconds * 1000).toLocaleDateString('vi-VN') : new Date(t.dueDate).toLocaleDateString('vi-VN')) : ''}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* CATEGORY 2: DUE SOON (SẮP QUÁ HẠN - HÔM NAY / NGÀY MAI) */}
                      {combinedUserTasks.filter(t => t.status !== 'done' && checkDueSoon(t)).length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded-md w-max">
                            ⚠️ HẠN GẦN KỀ (HÔM NAY / MAI)
                          </p>
                          {combinedUserTasks.filter(t => t.status !== 'done' && checkDueSoon(t)).map((t, index) => (
                            <div 
                              key={`soon-${t.isCrmReminder ? 'crm' : 'proj'}-${t.id || index}-${index}`} 
                              onClick={() => {
                                setActiveView('tasks');
                                setShowNotifications(false);
                              }}
                              className="p-2 bg-amber-50/10 border border-thin border-amber-100 rounded-xl text-xs text-left cursor-pointer hover:bg-amber-50/30 transition-colors space-y-1"
                            >
                              <p className="font-extrabold text-slate-800 uppercase tracking-tight line-clamp-1">
                                {t.title}
                              </p>
                              {t.isCrmReminder && (
                                <p className="text-[9px] font-bold text-slate-400">Khách: {t.customerName}</p>
                              )}
                              <div className="flex justify-between items-center text-[9px] font-bold mt-0.5 text-amber-600">
                                <span>Hạn: {t.dueDate ? (t.dueDate.seconds ? new Date(t.dueDate.seconds * 1000).toLocaleDateString('vi-VN') : new Date(t.dueDate).toLocaleDateString('vi-VN')) : ''}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* CATEGORY 3: TO DO (CẦN LÀM KHÁC) */}
                      {combinedUserTasks.filter(t => t.status !== 'done' && !checkOverdue(t) && !checkDueSoon(t)).length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-md w-max">
                            📋 CÔNG VIỆC CẦN LÀM
                          </p>
                          {combinedUserTasks.filter(t => t.status !== 'done' && !checkOverdue(t) && !checkDueSoon(t)).map((t, index) => (
                            <div 
                              key={`todo-${t.isCrmReminder ? 'crm' : 'proj'}-${t.id || index}-${index}`} 
                              onClick={() => {
                                setActiveView('tasks');
                                setShowNotifications(false);
                              }}
                              className="p-2 bg-slate-50/30 border border-thin border-slate-100 rounded-xl text-xs text-left cursor-pointer hover:bg-slate-50 transition-colors space-y-1"
                            >
                              <p className="font-extrabold text-slate-800 uppercase tracking-tight line-clamp-1">
                                {t.title}
                              </p>
                              {t.isCrmReminder && (
                                <p className="text-[9px] font-bold text-slate-400">Khách: {t.customerName}</p>
                              )}
                              <div className="flex justify-between items-center text-[9px] font-bold mt-0.5 text-slate-400">
                                <span>Hạn: {t.dueDate ? (t.dueDate.seconds ? new Date(t.dueDate.seconds * 1000).toLocaleDateString('vi-VN') : new Date(t.dueDate).toLocaleDateString('vi-VN')) : 'Không có hạn'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {combinedUserTasks.filter(t => t.status !== 'done').length === 0 && (
                        <div className="text-center py-6 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                          Không có việc tồn đọng 🎉
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setActiveView('tasks');
                        setShowNotifications(false);
                      }}
                      className="w-full text-center py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Mở bảng điều hành lịch biểu
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <div className="hidden md:flex flex-col items-end mr-2">
            <span className="text-xs font-black text-slate-900 uppercase">{user.displayName || user.email?.split('@')[0]}</span>
            <span className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-black uppercase tracking-tighter">{userRole}</span>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 lg:p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100"
            title="Đăng xuất"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>
      
      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop Sidebar - Side Navigation */}
        <aside className="hidden lg:flex w-72 bg-white border-r border-slate-200 flex-col p-6 shadow-inner h-full shrink-0">
            <div className="mb-4 px-4 py-3 bg-slate-50 rounded-2xl border border-slate-100 shrink-0">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Phần mềm ERP v2.0</p>
               <p className="text-[11px] text-slate-600 font-medium">Xin chào, <span className="font-bold text-slate-900">{user.displayName || user.email?.split('@')[0]}</span></p>
            </div>

            <nav className="flex-1 overflow-y-auto space-y-1 pr-1 custom-sidebar-scrollbar min-h-0 py-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id as View)}
                    className={cn(
                      "w-full flex items-center gap-4 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all group relative overflow-hidden shrink-0",
                      isActive 
                        ? "bg-slate-900 text-white shadow-xl translate-x-1" 
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <Icon className={cn(
                      "h-4.5 w-4.5 transition-colors shrink-0",
                      isActive ? "text-blue-400" : "text-slate-400 group-hover:text-slate-900"
                    )} />
                    <span className="relative z-10">{item.label}</span>
                    {isActive && (
                      <motion.div 
                        layoutId="active-pill-desktop"
                        className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"
                      />
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="pt-4 border-t border-slate-100 shrink-0">
              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">Hệ thống sẵn sàng</p>
                <p className="text-[10px] text-blue-700 font-medium leading-tight">Mọi dữ liệu đã được đồng bộ hóa với Firestore.</p>
              </div>
            </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-10 pb-28 lg:pb-10 scroll-smooth bg-slate-50/50">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView + (selectedProjectId || '')}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
              className="max-w-7xl mx-auto w-full"
            >
              {activeView === 'dashboard' && <ProjectDashboard onOpenProject={handleOpenProject} onOpenTracker={handleOpenTracker} userRole={userRole} userId={user.uid} />}
              {activeView === 'customers' && <CustomerList onViewProject={handleViewCustomerProject} userId={user.uid} userRole={userRole} />}
              {activeView === 'projects' && <ProjectDashboard onOpenProject={handleOpenProject} onOpenTracker={handleOpenTracker} showAll userRole={userRole} userId={user.uid} />}
              {activeView === 'catalog' && <CatalogManager userId={user.uid} userRole={userRole} />}
              {activeView === 'tasks' && <WorkSchedulerHub userId={user.uid} userRole={userRole} />}
              {activeView === 'users' && <UserManagement userId={user.uid} />}
              {activeView === 'settings' && <SystemSettings userId={user.uid} />}
              {activeView === 'profile' && <UserProfile userId={user.uid} user={user} />}
              {activeView === 'editor' && (
                <ProjectEditor 
                  projectId={selectedProjectId} 
                  initialCustomerId={targetCustomerId}
                  userRole={userRole}
                  userId={user.uid}
                  onClose={() => {
                    setActiveView('dashboard');
                    setTargetCustomerId(null);
                  }} 
                />
              )}
              {activeView === 'tracker' && (
                <ProjectProgressTracker 
                  projectId={selectedProjectId!} 
                  userId={user.uid}
                  userName={user.displayName || user.email?.split('@')[0]}
                  onClose={() => setActiveView('dashboard')}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Bottom Navigation - Floating Professional Design */}
      <nav className="lg:hidden fixed bottom-6 left-6 right-6 z-50">
        <div className="bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-[2rem] px-4 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center justify-around">
          {navigation.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id as View)}
                className={cn(
                  "flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl transition-all relative",
                  isActive ? "text-white" : "text-slate-500"
                )}
              >
                {isActive && (
                  <motion.div 
                    layoutId="mobile-nav-pill"
                    className="absolute inset-0 bg-blue-600 rounded-2xl -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon className={cn("h-5 w-5", isActive ? "scale-110" : "scale-100")} />
                <span className="text-[8px] font-black uppercase tracking-tighter">
                  {item.label === 'Bảng điều khiển' ? 'Home' : item.label.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Responsive Overlay for Alerts/Modals */}
      <div className="fixed top-0 pointer-events-none w-full h-full z-[100]" />
    </div>
  );
}
