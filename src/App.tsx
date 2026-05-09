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
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from './lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { cn } from './lib/utils';

// Components
import CustomerList from './components/CustomerList';
import ProjectDashboard from './components/ProjectDashboard';
import CatalogManager from './components/CatalogManager';
import ProjectEditor from './components/ProjectEditor';
import SalesManagement from './components/SalesManagement';

type View = 'dashboard' | 'customers' | 'projects' | 'catalog' | 'sales' | 'editor';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Username/Password state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
  }, []);

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
      setAuthError(error.message);
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
        setAuthError("Tên đăng nhập hoặc mật khẩu không chính xác.");
      } else if (error.code === 'auth/email-already-in-use') {
        setAuthError("Tên đăng nhập này đã tồn tại.");
      } else if (error.code === 'auth/operation-not-allowed') {
        setAuthError("LỖI: Bạn cần bật 'Email/Password' trong Firebase Console > Authentication > Sign-in method.");
      } else if (error.code === 'auth/unauthorized-domain') {
        setAuthError("LỖI: Tên miền này chưa được cấp phép trong Firebase Console > Authentication > Settings > Authorized domains.");
      } else {
        setAuthError("Lỗi hệ thống: " + error.message);
      }
    }
  };

  const handleLogout = () => signOut(auth);

  if (authLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-900 text-white font-sans">
        <Sun className="h-10 w-10 text-amber-400 animate-spin mb-4" />
        <p className="text-sm font-bold uppercase tracking-widest animate-pulse">Khởi động hệ thống...</p>
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
            <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-2xl md:rounded-3xl mx-auto flex flex-col items-center justify-center mb-6 md:mb-8 rotate-3 shadow-xl border-2 border-blue-600 shadow-blue-500/20">
              <span className="text-3xl md:text-4xl font-black text-red-600 leading-none">TS</span>
              <span className="text-[7px] md:text-[8px] font-bold text-blue-600 uppercase tracking-tighter mt-1 whitespace-nowrap">Solar Trường Sơn</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white mb-2 tracking-tight">TRUONGSONSOLAR</h1>
            <p className="text-slate-400 text-xs md:text-sm font-medium mb-6 md:mb-10 leading-relaxed">
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
               <div className="bg-amber-400/10 p-3 rounded-lg border border-amber-400/20 mb-2">
                  <p className="text-[9px] text-amber-200 uppercase font-bold tracking-tighter">Gợi ý tài khoản hệ thống:</p>
                  <code className="text-white text-[10px] font-mono">user: mrhieu / pass: Truongson@79</code>
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
    { id: 'sales', label: 'Quản lý Sale', icon: ClipboardList },
    { id: 'catalog', label: 'Danh mục TB', icon: Settings },
  ];

  const handleOpenProject = (id: string) => {
    setSelectedProjectId(id);
    setActiveView('editor');
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden relative">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? 256 : (window.innerWidth < 1024 ? 0 : 80),
          x: (window.innerWidth < 1024 && !isMobileMenuOpen) ? -280 : 0
        }}
        className={cn(
          "bg-slate-900 text-slate-300 flex flex-col z-50 border-r border-slate-800 fixed lg:relative h-full transition-all duration-300",
          !isSidebarOpen && window.innerWidth >= 1024 ? "items-center" : ""
        )}
      >
        <div className="p-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 bg-white rounded flex items-center justify-center text-red-600 font-black shrink-0 shadow-sm">
              TS
            </div>
            {(isSidebarOpen || isMobileMenuOpen) && (
              <div className="text-white font-bold text-lg tracking-tight whitespace-nowrap">
                TRUONGSON
              </div>
            )}
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-2 text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4">
          <div className={cn("text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 px-2", (!isSidebarOpen && !isMobileMenuOpen) && "text-center")}>
            {(isSidebarOpen || isMobileMenuOpen) ? 'QUẢN LÝ' : '•'}
          </div>
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveView(item.id as View);
                  if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 text-sm font-medium",
                  isActive 
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-amber-400" : "text-slate-500")} />
                {(isSidebarOpen || isMobileMenuOpen) && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
           {(isSidebarOpen || isMobileMenuOpen) && (
             <div className="flex items-center gap-3 mb-4 px-2">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-white">
                  {user?.email?.[0].toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold text-white truncate">{user?.displayName || user?.email?.split('@')[0]}</p>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Technical Sales</p>
                </div>
             </div>
           )}
           <button 
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="w-full hidden lg:flex items-center justify-center p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
           >
            {isSidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
           </button>
           <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center p-2 text-red-400 hover:text-red-500 hover:bg-slate-800 rounded-md transition-colors mt-2"
           >
            <LogOut className="h-4 w-4" />
           </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative pt-16 lg:pt-0">
        {/* Mobile Header */}
        <header className="fixed top-0 left-0 right-0 h-16 bg-slate-900 flex items-center justify-between px-6 z-30 lg:hidden shadow-lg border-b border-slate-800">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-white rounded flex items-center justify-center text-red-600 font-black shrink-0">TS</div>
             <span className="text-white font-bold text-sm tracking-tight uppercase">TRUONGSON</span>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-slate-400 hover:text-white"
          >
            <Menu className="h-6 w-6" />
          </button>
        </header>

        <header className="h-16 bg-white border-b border-slate-200 px-8 hidden lg:flex items-center justify-between shrink-0 shadow-sm relative z-10 no-print">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-slate-800 uppercase tracking-tight">
              {navigation.find(n => n.id === activeView)?.label || 'Dự án'}
            </h1>
            {activeView === 'editor' && (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded uppercase">
                Đang soạn thảo
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                setSelectedProjectId(null);
                setActiveView('editor');
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow-sm flex items-center gap-2 text-sm font-semibold transition-all active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Tạo Dự án Mới
            </button>
          </div>
        </header>

        <div className={cn(
          "flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50",
          activeView === 'editor' && "p-0 md:p-0"
        )}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView + (selectedProjectId || '')}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="min-h-full"
            >
              {activeView === 'dashboard' && <ProjectDashboard onOpenProject={handleOpenProject} />}
              {activeView === 'customers' && <CustomerList />}
              {activeView === 'projects' && <ProjectDashboard onOpenProject={handleOpenProject} showAll />}
              {activeView === 'catalog' && <CatalogManager />}
              {activeView === 'sales' && <SalesManagement />}
              {activeView === 'editor' && (
                <ProjectEditor 
                  projectId={selectedProjectId} 
                  onClose={() => setActiveView('dashboard')} 
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
