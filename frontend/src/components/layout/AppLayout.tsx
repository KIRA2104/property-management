import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Building, Users, FileText, CreditCard, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { name: 'Properties', path: '/properties', icon: Building },
    { name: 'Tenants', path: '/tenants', icon: Users },
    { name: 'Agreements', path: '/agreements', icon: FileText },
    { name: 'Payments', path: '/payments', icon: CreditCard },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-primary">
            <Building className="h-6 w-6" /> PropManage
          </h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-primary/10 text-primary font-medium' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t mt-auto">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <p className="font-medium">{user?.username}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} title="Logout">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-muted/20">
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
