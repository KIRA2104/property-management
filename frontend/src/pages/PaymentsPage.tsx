import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, CreditCard, Trash2, ShieldAlert, IndianRupee } from 'lucide-react';
import api from '@/services/api';

import type { Property } from './PropertiesPage';
import type { Agreement } from './AgreementsPage';
import type { Tenant } from './TenantsPage';

export interface Payment {
  id: string;
  agreement_id: string;
  amount: number;
  payment_date: string;
  payment_method?: string;
  reference_number?: string;
  status: 'pending' | 'confirmed' | 'failed';
  notes?: string;
}

export function PaymentsPage() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'failed'>('all');
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);
  
  const [formData, setFormData] = useState({
    agreement_id: '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'Bank Transfer',
    status: 'confirmed' as 'pending' | 'confirmed' | 'failed',
    notes: ''
  });

  const { data: payments = [], isLoading: isLoadingPayments } = useQuery<Payment[]>({
    queryKey: ['payments'],
    queryFn: () => api.get('/payments/').then(res => res.data.items)
  });

  const { data: agreements = [] } = useQuery<Agreement[]>({
    queryKey: ['agreements'],
    queryFn: () => api.get('/agreements/').then(res => res.data.items)
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ['properties'],
    queryFn: () => api.get('/properties/').then(res => res.data.items)
  });

  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ['tenants'],
    queryFn: () => api.get('/tenants/').then(res => res.data.items)
  });

  const safePayments = Array.isArray(payments) ? payments : [];
  const filteredPayments = safePayments.filter(p => {
    const agreement = Array.isArray(agreements) ? agreements.find(a => a.id === p.agreement_id) : null;
    const property = agreement ? properties.find(pr => pr.id === agreement.property_id) : null;
    const propertyName = property?.name.toLowerCase() || '';
    const paymentMethod = p.payment_method?.toLowerCase() || '';
    
    // We can show any tenant name connected to this agreement
    const agreementTenants = agreement ? tenants.filter(t => agreement.tenant_ids.includes(t.id)) : [];
    const tenantNames = agreementTenants.map(t => `${t.first_name} ${t.last_name}`).join(' ').toLowerCase();
    
    const query = searchQuery.toLowerCase();
    
    const matchesSearch = propertyName.includes(query) || paymentMethod.includes(query) || tenantNames.includes(query);
    
    if (statusFilter !== 'all') {
      return matchesSearch && p.status === statusFilter;
    }
    return matchesSearch;
  });

  const exportToCSV = () => {
    const headers = ['Property Name', 'Payment Date', 'Payment Method', 'Amount', 'Status', 'Notes'];
    const rows = filteredPayments.map(p => {
      const agreement = agreements.find(a => a.id === p.agreement_id);
      const property = agreement ? properties.find(pr => pr.id === agreement.property_id) : null;
      return [
        property?.name || 'Unknown Property',
        p.payment_date,
        p.payment_method || 'Bank Transfer',
        p.amount,
        p.status,
        p.notes || ''
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `payments_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const createMutation = useMutation({
    mutationFn: (newPayment: Omit<Payment, 'id'>) => api.post('/payments/', newPayment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsOpen(false);
      setFormData({
        agreement_id: '',
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'Bank Transfer',
        status: 'confirmed',
        notes: ''
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setDeleteId(null);
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'confirmed' | 'failed' | 'pending' }) => 
      api.patch(`/payments/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      agreement_id: formData.agreement_id,
      amount: parseFloat(formData.amount),
      payment_date: formData.payment_date,
      payment_method: formData.payment_method,
      status: formData.status,
      notes: formData.notes
    });
  };

  const isLoading = isLoadingPayments;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Payments</h2>
          <p className="text-muted-foreground">Track and manage received rent payments.</p>
        </div>
        
        <div className="flex gap-2">
          {payments.length > 0 && (
            <Button variant="outline" onClick={exportToCSV} className="hover:scale-105 transition-transform">
              Export CSV
            </Button>
          )}
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="hover:scale-105 transition-transform"><Plus className="mr-2 h-4 w-4" /> Record Payment</Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Record New Payment</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="agreement_id">Rental Agreement</Label>
                <select 
                  id="agreement_id" 
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={formData.agreement_id} 
                  onChange={e => {
                    const newAgrId = e.target.value;
                    const agr = agreements.find(a => a.id === newAgrId);
                    if (agr) {
                      const totalPaid = payments.filter(p => p.agreement_id === agr.id && p.status === 'confirmed').reduce((sum, p) => sum + Number(p.amount), 0);
                      const balance = Math.max(0, agr.agreed_rent - totalPaid);
                      setFormData({...formData, agreement_id: newAgrId, amount: balance > 0 ? balance.toString() : ''});
                    } else {
                      setFormData({...formData, agreement_id: newAgrId});
                    }
                  }} 
                  required
                >
                  <option value="">Select Agreement</option>
                  {agreements.map(a => {
                    const prop = properties.find(p => p.id === a.property_id);
                    const totalPaid = payments.filter(p => p.agreement_id === a.id && p.status === 'confirmed').reduce((sum, p) => sum + Number(p.amount), 0);
                    const balance = Math.max(0, a.agreed_rent - totalPaid);
                    return (
                      <option key={a.id} value={a.id}>
                        Agreement for {prop?.name || 'Unknown Property'} (Balance: ₹{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                      </option>
                    )
                  })}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (₹)</Label>
                  <Input id="amount" type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_date">Payment Date</Label>
                  <Input id="payment_date" type="date" value={formData.payment_date} onChange={e => setFormData({...formData, payment_date: e.target.value})} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="method">Method</Label>
                  <select 
                    id="method" 
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                    value={formData.payment_method} 
                    onChange={e => setFormData({...formData, payment_method: e.target.value})}
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Check">Check</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select 
                    id="status" 
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                    value={formData.status} 
                    onChange={e => setFormData({...formData, status: e.target.value as 'pending' | 'confirmed' | 'failed'})}
                  >
                    <option value="confirmed">Confirmed</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" placeholder="Rent for July 2026" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saving...' : 'Save Payment'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>

      <div className="space-y-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : payments.length === 0 ? (
          <div className="border-dashed border-2 border-muted bg-muted/5 flex flex-col items-center justify-center p-12 text-center space-y-4 rounded-2xl">
            <CreditCard className="h-12 w-12 opacity-30 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">No payments recorded yet</span>
          </div>
        ) : (
          <>
            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-card/30 backdrop-blur-sm p-3 rounded-2xl border border-border/20 shadow-sm">
              <div className="relative w-full md:w-80">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                  <CreditCard className="h-4 w-4" />
                </span>
                <Input 
                  type="text" 
                  placeholder="Search payments (property/tenant/method)..." 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                  className="pl-9 w-full"
                />
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                {(['all', 'pending', 'confirmed', 'failed'] as const).map((filter) => (
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

            {filteredPayments.length === 0 ? (
              <div className="border-dashed border-2 border-muted bg-muted/5 flex flex-col items-center justify-center p-12 text-center space-y-4 rounded-2xl">
                <CreditCard className="h-12 w-12 opacity-30 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">No matching payments found</span>
              </div>
            ) : (
              <div className="bg-card/20 backdrop-blur-sm border border-border/20 rounded-2xl overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Property</TableHead>
                      <TableHead>Tenants</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.map((p) => {
                      const agr = Array.isArray(agreements) ? agreements.find(a => a.id === p.agreement_id) : null;
                      const prop = Array.isArray(properties) ? properties.find(pr => pr.id === agr?.property_id) : null;
                      const agreementTenants = agr ? tenants.filter(t => agr.tenant_ids.includes(t.id)) : [];
                      
                      return (
                        <TableRow key={p.id} className="hover:bg-muted/10 group">
                          <TableCell className="font-semibold text-foreground">{prop?.name || 'Property'}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {agreementTenants.length > 0 ? agreementTenants.map(t => `${t.first_name} ${t.last_name}`).join(', ') : 'Unknown'}
                          </TableCell>
                          <TableCell>{new Date(p.payment_date).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                            +₹{Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            <select 
                              value={p.status} 
                              onChange={(e) => updateStatusMutation.mutate({ id: p.id, status: e.target.value as 'confirmed' | 'failed' | 'pending' })}
                              className={`px-2.5 py-0.5 rounded-xl text-xs font-semibold uppercase tracking-wider bg-transparent focus:outline-none border border-input ${
                                p.status === 'confirmed' 
                                  ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/5' 
                                  : p.status === 'pending'
                                  ? 'text-amber-600 dark:text-amber-400 border-amber-500/20 bg-amber-500/5'
                                  : 'text-destructive border-destructive/20 bg-destructive/5'
                              }`}
                            >
                              <option value="confirmed">Confirmed</option>
                              <option value="pending">Pending</option>
                              <option value="failed">Failed</option>
                            </select>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-primary hover:bg-primary/10 rounded-xl shrink-0"
                                onClick={() => setReceiptPayment(p)}
                                title="View Receipt"
                              >
                                <CreditCard className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive rounded-xl shrink-0"
                                onClick={() => setDeleteId(p.id)}
                                title="Delete Payment"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
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

      {/* Confirmation Modal */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" /> Confirm Deletion
            </DialogTitle>
            <DialogDescription className="pt-2">
              Are you absolutely sure you want to delete this payment record? This action is permanent.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Record'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Printable Receipt Modal */}
      <Dialog open={!!receiptPayment} onOpenChange={() => setReceiptPayment(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-500" /> Payment Receipt
            </DialogTitle>
          </DialogHeader>
          {receiptPayment && (() => {
            const agreement = agreements.find(a => a.id === receiptPayment.agreement_id);
            const property = agreement ? properties.find(pr => pr.id === agreement.property_id) : null;
            return (
              <div className="space-y-6 pt-4">
                <div id="printable-receipt" className="p-6 border rounded-xl bg-card space-y-4 shadow-sm relative overflow-hidden">
                  <div className="absolute top-2 right-2 text-[60px] font-extrabold opacity-[0.03] select-none uppercase tracking-widest text-primary rotate-12">
                    {receiptPayment.status}
                  </div>
                  
                  <div className="flex justify-between items-start border-b pb-4">
                    <div>
                      <h3 className="font-bold text-lg text-primary tracking-tight">KIRA PROPERTY</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Automated Receipt System</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                      receiptPayment.status === 'confirmed' 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400' 
                        : receiptPayment.status === 'pending'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400'
                        : 'bg-destructive/10 text-destructive'
                    }`}>
                      {receiptPayment.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground block">Receipt ID</span>
                      <span className="font-semibold">{receiptPayment.id.slice(0, 8).toUpperCase()}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Payment Date</span>
                      <span className="font-semibold">{new Date(receiptPayment.payment_date).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Property Unit</span>
                      <span className="font-bold">{property?.name || 'Property'}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Location</span>
                      <span className="font-medium max-w-[200px] truncate">{property?.address || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Payment Method</span>
                      <span className="font-semibold">{receiptPayment.payment_method || 'Bank Transfer'}</span>
                    </div>
                    {receiptPayment.notes && (
                      <div className="bg-muted/30 p-2.5 rounded-lg text-xs border border-dashed text-muted-foreground">
                        <strong className="block text-foreground font-semibold mb-0.5">Notes:</strong>
                        {receiptPayment.notes}
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-4 flex justify-between items-center bg-muted/10 -mx-6 -mb-4 p-6 rounded-b-xl">
                    <span className="text-base font-bold text-foreground">Amount Paid</span>
                    <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center">
                      <IndianRupee className="h-5 w-5 shrink-0" />
                      {Number(receiptPayment.amount).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setReceiptPayment(null)}>Close</Button>
                  <Button 
                    onClick={() => {
                      const printContent = document.getElementById('printable-receipt')?.innerHTML;
                      const originalContent = document.body.innerHTML;
                      if (printContent) {
                        document.body.innerHTML = `
                          <div style="padding: 40px; max-width: 500px; margin: 0 auto; font-family: sans-serif;">
                            ${printContent}
                          </div>
                        `;
                        window.print();
                        document.body.innerHTML = originalContent;
                        window.location.reload();
                      }
                    }}
                    className="hover:scale-105 transition-transform"
                  >
                    Print Receipt
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
