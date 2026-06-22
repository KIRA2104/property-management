import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, FileText, Trash2, ShieldAlert, Pencil } from 'lucide-react';
import api from '@/services/api';

import type { Property } from './PropertiesPage';
import type { Tenant } from './TenantsPage';
import type { Payment } from './PaymentsPage';

export interface Agreement {
  id: string;
  property_id: string;
  tenant_ids: string[];
  start_date: string;
  end_date: string;
  agreed_rent: number;
  deposit: number;
  status: 'active' | 'expired' | 'terminated';
}

export function AgreementsPage() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editAgreement, setEditAgreement] = useState<Agreement | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'terminated'>('all');
  
  const [formData, setFormData] = useState({
    property_id: '',
    tenant_ids: [] as string[],
    start_date: '',
    end_date: '',
    agreed_rent: '',
    deposit: '0'
  });
  const [editForm, setEditForm] = useState({
    tenant_ids: [] as string[],
    start_date: '',
    end_date: '',
    agreed_rent: '',
    deposit: '',
    status: 'active' as Agreement['status']
  });

  const { data: agreements = [], isLoading: isLoadingAgreements } = useQuery<Agreement[]>({
    queryKey: ['agreements'],
    queryFn: () => api.get('/agreements/').then(res => res.data.items)
  });

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ['payments'],
    queryFn: () => api.get('/payments/').then(res => res.data.items)
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ['properties'],
    queryFn: () => api.get('/properties/').then(res => res.data.items)
  });

  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ['tenants'],
    queryFn: () => api.get('/tenants/').then(res => res.data.items)
  });

  const safeAgreements = Array.isArray(agreements) ? agreements : [];
  const filteredAgreements = safeAgreements.filter(a => {
    const property = Array.isArray(properties) ? properties.find(p => p.id === a.property_id) : null;
    const agreementTenants = Array.isArray(tenants) ? tenants.filter(t => a.tenant_ids.includes(t.id)) : [];
    const propertyName = property?.name.toLowerCase() || '';
    const tenantNames = agreementTenants.map(t => `${t.first_name} ${t.last_name}`).join(' ').toLowerCase();
    const query = searchQuery.toLowerCase();
    
    const matchesSearch = propertyName.includes(query) || tenantNames.includes(query);
    
    if (statusFilter !== 'all') {
      return matchesSearch && a.status === statusFilter;
    }
    return matchesSearch;
  });

  const createMutation = useMutation({
    mutationFn: (newAgreement: Omit<Agreement, 'id' | 'status'> & { status?: 'active' | 'expired' | 'terminated' }) => api.post('/agreements/', newAgreement),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agreements'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsOpen(false);
      setFormData({ property_id: '', tenant_ids: [], start_date: '', end_date: '', agreed_rent: '', deposit: '0' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/agreements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agreements'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setDeleteId(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Omit<typeof editForm, 'agreed_rent' | 'deposit'> & { agreed_rent: number; deposit: number } }) =>
      api.patch(`/agreements/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agreements'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setEditAgreement(null);
    }
  });

  const openEditDialog = (agreement: Agreement) => {
    setEditAgreement(agreement);
    setEditForm({
      tenant_ids: [...agreement.tenant_ids],
      start_date: agreement.start_date,
      end_date: agreement.end_date,
      agreed_rent: String(agreement.agreed_rent),
      deposit: String(agreement.deposit),
      status: agreement.status
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAgreement) return;
    updateMutation.mutate({
      id: editAgreement.id,
      data: {
        ...editForm,
        agreed_rent: parseFloat(editForm.agreed_rent),
        deposit: parseFloat(editForm.deposit)
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      property_id: formData.property_id,
      tenant_ids: formData.tenant_ids,
      start_date: formData.start_date,
      end_date: formData.end_date,
      agreed_rent: parseFloat(formData.agreed_rent),
      deposit: parseFloat(formData.deposit)
    });
  };

  const isLoading = isLoadingAgreements;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Agreements</h2>
          <p className="text-muted-foreground">Manage rental agreements between properties and tenants.</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="hover:scale-105 transition-transform"><Plus className="mr-2 h-4 w-4" /> New Agreement</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create Rental Agreement</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="property_id">Property</Label>
                  <select 
                    id="property_id" 
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={formData.property_id} 
                    onChange={e => setFormData({...formData, property_id: e.target.value})} 
                    required
                  >
                    <option value="">Select Property</option>
                    {properties.filter(p => p.is_available).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Tenants</Label>
                  <select
                    className="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val && !formData.tenant_ids.includes(val)) {
                        setFormData({ ...formData, tenant_ids: [...formData.tenant_ids, val] });
                      }
                      e.target.value = "";
                    }}
                  >
                    <option value="">Select a tenant to add</option>
                    {Array.isArray(tenants) && tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.first_name} {tenant.last_name}
                      </option>
                    ))}
                  </select>
                  {formData.tenant_ids.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.tenant_ids.map(id => {
                        const t = tenants.find(t => t.id === id);
                        return t ? (
                          <div key={id} className="bg-secondary text-secondary-foreground text-xs px-2 py-1 rounded-full flex items-center gap-1">
                            {t.first_name} {t.last_name}
                            <button type="button" onClick={() => setFormData({...formData, tenant_ids: formData.tenant_ids.filter(tid => tid !== id)})} className="text-muted-foreground hover:text-foreground">×</button>
                          </div>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input id="start_date" type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input id="end_date" type="date" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="agreed_rent">Rent Amount (₹)</Label>
                  <Input id="agreed_rent" type="number" step="0.01" value={formData.agreed_rent} onChange={e => setFormData({...formData, agreed_rent: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deposit">Security Deposit (₹)</Label>
                  <Input id="deposit" type="number" step="0.01" value={formData.deposit} onChange={e => setFormData({...formData, deposit: e.target.value})} required />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Agreement'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : agreements.length === 0 ? (
          <div className="border-dashed border-2 border-muted bg-muted/5 flex flex-col items-center justify-center p-12 text-center space-y-4 rounded-2xl">
            <FileText className="h-12 w-12 opacity-30 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">No agreements registered yet</span>
          </div>
        ) : (
          <>
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-card/30 backdrop-blur-sm p-3 rounded-2xl border border-border/20 shadow-sm">
              <div className="relative w-full md:w-80">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                  <FileText className="h-4 w-4" />
                </span>
                <Input 
                  type="text" 
                  placeholder="Search agreements (property/tenant)..." 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                  className="pl-9 w-full"
                />
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                {(['all', 'active', 'expired', 'terminated'] as const).map((filter) => (
                  <Button
                    key={filter}
                    variant={statusFilter === filter ? 'default' : 'outline'}
                    onClick={() => setStatusFilter(filter)}
                    size="sm"
                    className="capitalize flex-1 md:flex-initial"
                  >
                    {filter}
                  </Button>
                ))}
              </div>
            </div>

            {filteredAgreements.length === 0 ? (
              <div className="border-dashed border-2 border-muted bg-muted/5 flex flex-col items-center justify-center p-12 text-center space-y-4 rounded-2xl">
                <FileText className="h-12 w-12 opacity-30 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">No matching agreements found</span>
              </div>
            ) : (
              <div className="bg-card/20 backdrop-blur-sm border border-border/20 rounded-2xl overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Property</TableHead>
                      <TableHead>Tenants</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead className="text-right">Rent</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead>Coverage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAgreements.map((a) => {
                      const agreementPayments = payments.filter(p => p.agreement_id === a.id && p.status === 'confirmed');
                      const totalPaid = agreementPayments.reduce((sum, p) => sum + Number(p.amount), 0);
                      const isCovered = totalPaid >= a.agreed_rent;
                      const coveragePercentage = Math.min(100, Math.round((totalPaid / a.agreed_rent) * 100)) || 0;
                      const prop = Array.isArray(properties) ? properties.find(p => p.id === a.property_id) : null;
                      const agreementTenants = Array.isArray(tenants) ? tenants.filter(t => a.tenant_ids.includes(t.id)) : [];

                      return (
                      <TableRow key={a.id} className="hover:bg-muted/10 group">
                        <TableCell className="font-semibold text-foreground">{prop?.name || `Property`}</TableCell>
                        <TableCell>
                          {agreementTenants.length > 0 
                            ? agreementTenants.map(t => `${t.first_name} ${t.last_name}`).join(', ') 
                            : 'N/A'}
                        </TableCell>
                        <TableCell>{new Date(a.start_date).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(a.end_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right font-bold text-foreground">₹{Number(a.agreed_rent).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right text-emerald-600 dark:text-emerald-400 font-semibold">₹{totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 w-24">
                            <div className="flex justify-between items-center text-[10px] font-semibold">
                              <span className={isCovered ? "text-emerald-600" : "text-amber-600"}>
                                {isCovered ? 'Covered' : 'Pending'}
                              </span>
                              <span>{coveragePercentage}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${isCovered ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${coveragePercentage}%` }} />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-xl text-[10px] font-bold uppercase tracking-wider ${
                            a.status === 'active' 
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400' 
                              : 'bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400'
                          }`}>
                            {a.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-xl opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                            onClick={() => openEditDialog(a)}
                            aria-label="Edit agreement"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive rounded-xl opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                            onClick={() => setDeleteId(a.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={!!editAgreement} onOpenChange={(open) => !open && setEditAgreement(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Edit Rental Agreement</DialogTitle>
            <DialogDescription>
              Paid billing history is preserved; changes apply to unpaid rent charges.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Property</Label>
              <Input
                value={properties.find(p => p.id === editAgreement?.property_id)?.name || 'Property'}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label>Tenants</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value=""
                onChange={(e) => {
                  const id = e.target.value;
                  if (id && !editForm.tenant_ids.includes(id)) {
                    setEditForm({ ...editForm, tenant_ids: [...editForm.tenant_ids, id] });
                  }
                }}
              >
                <option value="">Select a tenant to add</option>
                {tenants.filter(t => !editForm.tenant_ids.includes(t.id)).map(t => (
                  <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2">
                {editForm.tenant_ids.map(id => {
                  const tenant = tenants.find(t => t.id === id);
                  return tenant ? (
                    <span key={id} className="bg-secondary text-secondary-foreground text-xs px-2 py-1 rounded-full flex items-center gap-1">
                      {tenant.first_name} {tenant.last_name}
                      <button
                        type="button"
                        disabled={editForm.tenant_ids.length === 1}
                        onClick={() => setEditForm({ ...editForm, tenant_ids: editForm.tenant_ids.filter(tenantId => tenantId !== id) })}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >×</button>
                    </span>
                  ) : null;
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_start_date">Start Date</Label>
                <Input id="edit_start_date" type="date" value={editForm.start_date} onChange={e => setEditForm({...editForm, start_date: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_end_date">End Date</Label>
                <Input id="edit_end_date" type="date" value={editForm.end_date} onChange={e => setEditForm({...editForm, end_date: e.target.value})} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_rent">Rent Amount (₹)</Label>
                <Input id="edit_rent" type="number" min="0.01" step="0.01" value={editForm.agreed_rent} onChange={e => setEditForm({...editForm, agreed_rent: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_deposit">Security Deposit (₹)</Label>
                <Input id="edit_deposit" type="number" min="0" step="0.01" value={editForm.deposit} onChange={e => setEditForm({...editForm, deposit: e.target.value})} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_status">Status</Label>
              <select
                id="edit_status"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={editForm.status}
                onChange={e => setEditForm({...editForm, status: e.target.value as Agreement['status']})}
              >
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditAgreement(null)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending || editForm.tenant_ids.length === 0}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" /> Confirm Deletion
            </DialogTitle>
            <DialogDescription className="pt-2">
              Are you absolutely sure you want to terminate/delete this agreement? This action will restore property availability.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Terminating...' : 'Terminate Agreement'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
