import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Users, Mail, Phone, Trash2, ShieldAlert } from 'lucide-react';
import api from '@/services/api';

export interface Tenant {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
}

export function TenantsPage() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({ first_name: '', last_name: '', email: '', phone_number: '' });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');

  const { data: tenants = [], isLoading } = useQuery<Tenant[]>({
    queryKey: ['tenants'],
    queryFn: () => api.get('/tenants/').then(res => res.data.items)
  });

  const safeTenants = Array.isArray(tenants) ? tenants : [];
  const filteredTenants = safeTenants.filter(t => {
    const fullName = `${t.first_name} ${t.last_name}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || 
           t.email.toLowerCase().includes(query) || 
           (t.phone_number && t.phone_number.toLowerCase().includes(query));
  });

  const createMutation = useMutation({
    mutationFn: (newTenant: Omit<Tenant, 'id'>) => api.post('/tenants/', newTenant),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsOpen(false);
      setFormData({ first_name: '', last_name: '', email: '', phone_number: '' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tenants/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setDeleteId(null);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Tenants</h2>
          <p className="text-muted-foreground">Manage your tenants and their contact details.</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="hover:scale-105 transition-transform"><Plus className="mr-2 h-4 w-4" /> Add Tenant</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Tenant</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input id="first_name" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input id="last_name" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input 
                  id="phone" 
                  type="tel" 
                  pattern="^[0-9]{10}$" 
                  maxLength={10}
                  title="Phone number must be exactly 10 digits" 
                  placeholder="e.g. 9876543210" 
                  value={formData.phone_number} 
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setFormData({...formData, phone_number: val});
                  }} 
                />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saving...' : 'Save Tenant'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : tenants.length === 0 ? (
        <div className="border-dashed border-2 border-primary/20 bg-primary/5 flex flex-col items-center justify-center p-12 text-center space-y-4 rounded-3xl">
          <Users className="h-16 w-16 text-primary/30 animate-pulse" />
          <h3 className="text-xl font-bold">No Tenants Registered</h3>
          <p className="text-sm text-muted-foreground max-w-sm">Keep track of your occupants by registering them here.</p>
          <Button onClick={() => setIsOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Register First Tenant
          </Button>
        </div>
      ) : (
        <>
          {/* Search Bar */}
          <div className="flex bg-card/30 backdrop-blur-sm p-3 rounded-2xl border border-border/20 shadow-sm">
            <div className="relative w-full md:w-80">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                <Users className="h-4 w-4" />
              </span>
              <Input 
                type="text" 
                placeholder="Search tenants..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                className="pl-9 w-full"
              />
            </div>
          </div>

          {filteredTenants.length === 0 ? (
            <div className="border-dashed border-2 border-muted bg-muted/5 flex flex-col items-center justify-center p-12 text-center space-y-4 rounded-2xl">
              <Users className="h-12 w-12 text-muted-foreground/30" />
              <h3 className="text-lg font-bold">No Match Found</h3>
              <p className="text-sm text-muted-foreground">Try adjusting your search query.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30 bg-card/20 backdrop-blur-sm rounded-2xl border border-border/20 overflow-hidden shadow-sm">
              {filteredTenants.map((t) => {
                const initials = `${t.first_name[0] || ''}${t.last_name[0] || ''}`.toUpperCase();
                return (
                  <div 
                    key={t.id} 
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 hover:bg-muted/10 transition-all duration-300 group"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 group-hover:scale-110 transition-transform duration-300">
                        {initials}
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <h3 className="text-base font-bold tracking-tight text-foreground truncate">{t.first_name} {t.last_name}</h3>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Leaseholder</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-8 gap-y-2 shrink-0 sm:justify-end">
                      {/* Email */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-[180px]">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                        <span className="truncate">{t.email}</span>
                      </div>
                      
                      {/* Phone */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-[140px]">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                        <span>{t.phone_number || 'No phone number'}</span>
                      </div>

                      {/* Actions */}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive rounded-xl shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        onClick={() => setDeleteId(t.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Confirmation Modal */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" /> Confirm Deletion
            </DialogTitle>
            <DialogDescription className="pt-2">
              Are you absolutely sure you want to delete this tenant? This action is permanent and will archive the record.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
