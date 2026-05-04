import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, Info, Loader2 } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'info' | 'loading';

interface Notification {
  id: string;
  message: string;
  type: NotificationType;
}

interface NotificationContextType {
  showNotification: (message: string, type: NotificationType) => string;
  hideNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = (message: string, type: NotificationType) => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications((prev) => [...prev, { id, message, type }]);
    
    if (type !== 'loading') {
      setTimeout(() => hideNotification(id), 5000);
    }
    return id;
  };

  const hideNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ showNotification, hideNotification }}>
      {children}
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`
              pointer-events-auto flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border backdrop-blur-2xl
              animate-in slide-in-from-right-8 duration-300
              ${n.type === 'success' ? 'bg-zinc-900/90 border-green-500/20 text-green-400' : ''}
              ${n.type === 'error' ? 'bg-zinc-900/90 border-red-500/20 text-red-400' : ''}
              ${n.type === 'info' ? 'bg-zinc-900/90 border-zinc-700 text-zinc-300' : ''}
              ${n.type === 'loading' ? 'bg-zinc-900/90 border-zinc-700 text-zinc-300' : ''}
            `}
          >
            {n.type === 'success' && <CheckCircle size={18} />}
            {n.type === 'error' && <AlertCircle size={18} />}
            {n.type === 'info' && <Info size={18} />}
            {n.type === 'loading' && <Loader2 size={18} className="animate-spin" />}
            
            <p className="text-sm font-bold tracking-tight">{n.message}</p>
            
            <button
              onClick={() => hideNotification(n.id)}
              className="ml-2 p-1 hover:bg-white/10 rounded-lg transition"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
