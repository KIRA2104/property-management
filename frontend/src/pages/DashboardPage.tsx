import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building, CreditCard, Plus, Calendar, AlertTriangle, FileText, CheckCircle2, XCircle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '@/services/api';

interface Property {
  id: string;
  name: string;
  address: string;
  is_available: boolean;
  monthly_rent: number;
}

interface Tenant {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
}

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  status: 'pending' | 'confirmed' | 'failed';
  agreement_id: string;
}

interface Agreement {
  id: string;
  property_id: string;
  tenant_ids: string[];
  start_date: string;
  end_date: string;
  agreed_rent: number;
  deposit: number;
  status: 'active' | 'expired' | 'terminated';
}

interface RentCharge {
  id: string;
  agreement_id: string;
  billing_month: string;
  due_date: string;
  rent_amount: number;
  late_fee: number;
  amount_paid: number;
  status: 'upcoming' | 'due' | 'partial' | 'paid' | 'overdue';
}

interface DashboardData {
  properties: Property[];
  tenants: Tenant[];
  payments: Payment[];
  rent_charges: RentCharge[];
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);
  const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);
  
  const [propertyForm, setPropertyForm] = useState({ name: '', address: '', monthly_rent: '' });
  const [tenantForm, setTenantForm] = useState({ first_name: '', last_name: '', email: '', phone_number: '' });

  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard/').then(res => res.data)
  });

  const { data: agreements = [] } = useQuery<Agreement[]>({
    queryKey: ['agreements'],
    queryFn: () => api.get('/agreements/').then(res => res.data.items)
  });

  const createPropertyMutation = useMutation({
    mutationFn: (newProperty: Omit<Property, 'id' | 'is_available'>) => api.post('/properties/', newProperty),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      setIsPropertyModalOpen(false);
      setPropertyForm({ name: '', address: '', monthly_rent: '' });
    }
  });

  const createTenantMutation = useMutation({
    mutationFn: (newTenant: Omit<Tenant, 'id'>) => api.post('/tenants/', newTenant),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setIsTenantModalOpen(false);
      setTenantForm({ first_name: '', last_name: '', email: '', phone_number: '' });
    }
  });

  const triggerRemindersMutation = useMutation({
    mutationFn: () => api.post('/dashboard/trigger-reminders').then(res => res.data),
    onSuccess: (data) => {
      alert(data.message || 'Reminders sent successfully!');
    },
    onError: () => {
      alert('Failed to send reminders. Please try again.');
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Skeleton className="col-span-4 h-[350px] rounded-xl" />
          <Skeleton className="col-span-3 h-[350px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
        <AlertTriangle className="h-16 w-16 text-destructive animate-bounce" />
        <h3 className="text-2xl font-bold text-foreground">Failed to Load Dashboard</h3>
        <p className="text-muted-foreground max-w-md">There was an issue connecting to the servers. Please check your connection and try again.</p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['dashboard'] })}>Retry</Button>
      </div>
    );
  }

  const properties = Array.isArray(data?.properties) ? data.properties : [];
  const tenants = Array.isArray(data?.tenants) ? data.tenants : [];
  const payments = Array.isArray(data?.payments) ? data.payments : [];
  const rentCharges = Array.isArray(data?.rent_charges) ? data.rent_charges : [];

  // Calculations
  const totalProperties = properties.length;
  const totalTenants = tenants.length;
  const occupiedProperties = properties.filter(p => !p.is_available).length;
  const occupancyRate = totalProperties > 0 ? Math.round((occupiedProperties / totalProperties) * 100) : 0;
  
  const totalRevenue = payments
    .filter(p => p.status === 'confirmed')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const pendingPayments = payments.filter(p => p.status === 'pending');
  const failedPayments = payments.filter(p => p.status === 'failed');

  const overdueOrDueCharges = rentCharges.filter(rc => rc.status === 'overdue' || rc.status === 'due' || rc.status === 'partial');
  const pendingRevenue = overdueOrDueCharges.reduce((sum, rc) => sum + (Number(rc.rent_amount) + Number(rc.late_fee) - Number(rc.amount_paid)), 0);

  const safeAgreements = Array.isArray(agreements) ? agreements : [];
  const expiringAgreements = safeAgreements.filter(a => {
    if (a.status !== 'active') return false;
    const endDate = new Date(a.end_date);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  });

  // Last 5 payments
  const recentPayments = [...payments]
    .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
    .slice(0, 5);

  // Group revenue by Month for the CSS Bar Chart
  const monthlyRevenueData = payments
    .filter(p => p.status === 'confirmed')
    .reduce((acc: { [key: string]: number }, p) => {
      const date = new Date(p.payment_date);
      const month = date.toLocaleString('default', { month: 'short' });
      acc[month] = (acc[month] || 0) + Number(p.amount);
      return acc;
    }, {});

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // Keep only months with data or the last 6 months
  const activeMonths = months.filter(m => monthlyRevenueData[m] !== undefined || months.indexOf(m) >= new Date().getMonth() - 5);
  const maxRevenue = Math.max(...activeMonths.map(m => monthlyRevenueData[m] || 0), 100);

  const handlePropertySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createPropertyMutation.mutate({
      ...propertyForm,
      monthly_rent: parseFloat(propertyForm.monthly_rent)
    });
  };

  const handleTenantSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTenantMutation.mutate(tenantForm);
  };

  return (
    <div className="space-y-10 animate-fade-in pb-12">
      {/* Header and Quick Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Dashboard
          </h2>
          <p className="text-muted-foreground mt-1">Real-time overview of your real estate business.</p>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button 
            variant="default" 
            size="sm" 
            className="h-10 hover:scale-105 transition-all bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={() => triggerRemindersMutation.mutate()}
            disabled={triggerRemindersMutation.isPending}
          >
            <Mail className="mr-2 h-4 w-4" /> 
            {triggerRemindersMutation.isPending ? 'Sending...' : 'Send Reminders'}
          </Button>

          <Dialog open={isPropertyModalOpen} onOpenChange={setIsPropertyModalOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-10 hover:scale-105 transition-all">
                <Plus className="mr-2 h-4 w-4" /> Add Property
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Property</DialogTitle>
                <DialogDescription>Quickly register a property into the ecosystem.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handlePropertySubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Property Name</Label>
                  <Input id="name" placeholder="Grand Villa" value={propertyForm.name} onChange={e => setPropertyForm({...propertyForm, name: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" placeholder="123 Luxury Ave, CA" value={propertyForm.address} onChange={e => setPropertyForm({...propertyForm, address: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthly_rent">Monthly Rent (₹)</Label>
                  <Input id="monthly_rent" type="number" step="0.01" placeholder="2500" value={propertyForm.monthly_rent} onChange={e => setPropertyForm({...propertyForm, monthly_rent: e.target.value})} required />
                </div>
                <Button type="submit" className="w-full mt-2" disabled={createPropertyMutation.isPending}>
                  {createPropertyMutation.isPending ? 'Saving...' : 'Save Property'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isTenantModalOpen} onOpenChange={setIsTenantModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 hover:scale-105 transition-all">
                <Plus className="mr-2 h-4 w-4" /> Add Tenant
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Tenant</DialogTitle>
                <DialogDescription>Register a new tenant in the system.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleTenantSubmit} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input id="first_name" placeholder="John" value={tenantForm.first_name} onChange={e => setTenantForm({...tenantForm, first_name: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input id="last_name" placeholder="Doe" value={tenantForm.last_name} onChange={e => setTenantForm({...tenantForm, last_name: e.target.value})} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" placeholder="john.doe@example.com" value={tenantForm.email} onChange={e => setTenantForm({...tenantForm, email: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" type="tel" pattern="^[0-9]{10}$" title="Phone number must be exactly 10 digits" placeholder="e.g. 9876543210" value={tenantForm.phone_number} onChange={e => setTenantForm({...tenantForm, phone_number: e.target.value})} />
                </div>
                <Button type="submit" className="w-full mt-2" disabled={createTenantMutation.isPending}>
                  {createTenantMutation.isPending ? 'Saving...' : 'Save Tenant'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Frameless Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-8 border-y border-border/40 bg-card/20 backdrop-blur-sm px-6 rounded-2xl relative overflow-hidden">
        {/* Revenue */}
        <div className="space-y-2 md:border-r border-border/40 last:border-none pr-4">
          <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground block">Total Revenue</span>
          <span className="text-3xl font-extrabold text-primary block">₹{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          <span className="text-[10px] text-emerald-500 font-semibold block">Fully confirmed rent</span>
        </div>
        {/* Occupancy */}
        <div className="space-y-2 md:border-r border-border/40 last:border-none pr-4 md:pl-4">
          <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground block">Occupancy Rate</span>
          <span className="text-3xl font-extrabold text-primary block">{occupancyRate}%</span>
          <div className="w-24 bg-muted rounded-full h-1 overflow-hidden mt-1.5">
            <div className="bg-primary h-1 rounded-full" style={{ width: `${occupancyRate}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground block mt-1">{occupiedProperties} of {totalProperties} units filled</span>
        </div>
        {/* Tenants */}
        <div className="space-y-2 md:border-r border-border/40 last:border-none pr-4 md:pl-4">
          <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground block">Active Tenants</span>
          <span className="text-3xl font-extrabold text-primary block">{totalTenants}</span>
          <span className="text-[10px] text-muted-foreground block">Registered leaseholders</span>
        </div>
        {/* Pending Bills */}
        <div className="space-y-2 md:pl-4">
          <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground block">Pending Bills</span>
          <span className="text-3xl font-extrabold text-primary block">₹{pendingRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          <span className="text-[10px] text-amber-500 font-semibold block flex items-center gap-1">
            {overdueOrDueCharges.length > 0 ? `${overdueOrDueCharges.length} open charges` : 'All collections current'}
          </span>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid gap-10 lg:grid-cols-3">
        {/* Left Workspace: Charts & empty states */}
        <div className="lg:col-span-2 space-y-10">
          
          {/* Revenue Trend Chart */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-foreground">Revenue Collections Trend</h3>
              <p className="text-xs text-muted-foreground">Monthly completed rent distributions.</p>
            </div>
            
            <div className="h-[280px] flex items-end justify-between pt-6 px-6 bg-card/20 backdrop-blur-sm rounded-2xl border border-border/20">
              {activeMonths.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                  <FileText className="h-10 w-10 opacity-30 mb-2" />
                  <span className="text-sm">No confirmed payment data available yet</span>
                </div>
              ) : (
                activeMonths.map(month => {
                  const amount = monthlyRevenueData[month] || 0;
                  const percentage = (amount / maxRevenue) * 90 + 10;
                  return (
                    <div key={month} className="flex flex-col items-center flex-1 group">
                      <div className="w-full flex justify-center relative mb-2">
                        <div className="absolute bottom-full mb-1 px-2.5 py-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
                          ₹{amount.toLocaleString()}
                        </div>
                      </div>
                      <div className="w-8 md:w-12 bg-muted/30 rounded-t-lg overflow-hidden h-[180px] flex items-end">
                        <div 
                          className="w-full bg-gradient-to-t from-primary/80 to-primary hover:from-primary hover:to-primary/90 transition-all rounded-t-lg"
                          style={{ height: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground mt-2">{month}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Monthly Rent Status per Property */}
          <div className="space-y-4 pt-4">
            <div>
              <h3 className="text-lg font-bold text-foreground">Monthly Rent Status</h3>
              <p className="text-xs text-muted-foreground">Breakdown of rent collections per property by month.</p>
            </div>
            
            {rentCharges.length === 0 ? (
              <div className="border-dashed border-2 border-muted bg-muted/5 flex flex-col items-center justify-center p-8 text-center space-y-3 rounded-2xl">
                <FileText className="h-10 w-10 opacity-30 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">No rent charges generated yet. Create an agreement to see monthly breakdowns.</span>
              </div>
            ) : (
              <div className="bg-card/20 backdrop-blur-sm border border-border/20 rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Property</TableHead>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Rent Due</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...rentCharges].sort((a, b) => {
                      if (b.billing_month !== a.billing_month) return b.billing_month.localeCompare(a.billing_month);
                      const propA = properties.find(p => p.id === safeAgreements.find(agr => agr.id === a.agreement_id)?.property_id)?.name || '';
                      const propB = properties.find(p => p.id === safeAgreements.find(agr => agr.id === b.agreement_id)?.property_id)?.name || '';
                      return propA.localeCompare(propB);
                    }).map(charge => {
                      const agreement = safeAgreements.find(a => a.id === charge.agreement_id);
                      const property = properties.find(p => p.id === agreement?.property_id);
                      const propName = property?.name || 'Unknown Property';
                      const totalDue = Number(charge.rent_amount) + Number(charge.late_fee);
                      const paid = Number(charge.amount_paid);
                      const remaining = Math.max(0, totalDue - paid);
                      
                      let statusBadge = null;
                      switch(charge.status) {
                        case 'paid':
                          statusBadge = <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400 uppercase">Paid</span>;
                          break;
                        case 'partial':
                          statusBadge = <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400 uppercase">Partial</span>;
                          break;
                        case 'due':
                          statusBadge = <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400 uppercase">Due</span>;
                          break;
                        case 'overdue':
                          statusBadge = <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-destructive/10 text-destructive dark:bg-destructive/20 uppercase">Overdue</span>;
                          break;
                        default:
                          statusBadge = <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground uppercase">{charge.status}</span>;
                      }

                      return (
                        <TableRow key={charge.id} className="hover:bg-muted/10">
                          <TableCell className="font-semibold">{propName}</TableCell>
                          <TableCell>{charge.billing_month}</TableCell>
                          <TableCell className="text-right font-medium">₹{totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right text-emerald-600 dark:text-emerald-400 font-medium">₹{paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right font-bold text-amber-600 dark:text-amber-400">₹{remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell>{statusBadge}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Empty States CTA */}
          {totalProperties === 0 && (
            <div className="border-dashed border-2 border-primary/20 bg-primary/5 rounded-3xl flex flex-col items-center justify-center p-12 text-center space-y-4">
              <Building className="h-16 w-16 text-primary/30 animate-pulse" />
              <h3 className="text-xl font-bold">Build Your Property Portfolio</h3>
              <p className="text-sm text-muted-foreground max-w-sm">You haven't added any properties to your database yet. Get started by entering your first property to manage tenants and agreements.</p>
              <Button onClick={() => setIsPropertyModalOpen(true)} className="hover:scale-105 transition-transform">
                <Plus className="mr-2 h-4 w-4" /> Create First Property
              </Button>
            </div>
          )}
        </div>

        {/* Right Sidebar: Feeds, Alert, Recent activity */}
        <div className="space-y-8 lg:border-l lg:border-border/40 lg:pl-8">
          
          {/* Alerts Feed */}
          {(pendingPayments.length > 0 || failedPayments.length > 0 || expiringAgreements.length > 0) && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Action Center</h3>
              <div className="space-y-3">
                {pendingPayments.length > 0 && (
                  <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-start gap-3 shadow-sm hover:shadow-md transition-shadow">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0 animate-pulse" />
                    <div>
                      <h4 className="font-bold text-xs text-amber-800 dark:text-amber-400">Pending Verification ({pendingPayments.length})</h4>
                      <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                        Waiting for confirmation. Go to the payments portal.
                      </p>
                    </div>
                  </div>
                )}
                {failedPayments.length > 0 && (
                  <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 flex items-start gap-3 shadow-sm hover:shadow-md transition-shadow">
                    <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                    <div>
                      <h4 className="font-bold text-xs text-destructive">Failed Payments ({failedPayments.length})</h4>
                      <p className="text-[11px] text-destructive-foreground/80 mt-0.5">
                        Transactions have failed. Contact affected tenants.
                      </p>
                    </div>
                  </div>
                )}
                {expiringAgreements.length > 0 && (
                  <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-3 shadow-sm hover:shadow-md transition-shadow">
                    <Calendar className="h-5 w-5 text-primary mt-0.5 shrink-0 animate-pulse" />
                    <div>
                      <h4 className="font-bold text-xs text-primary">Leases Expiring Soon ({expiringAgreements.length})</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                        {expiringAgreements.map(a => {
                          const prop = properties.find(p => p.id === a.property_id);
                          const agreementTenants = tenants.filter(t => a.tenant_ids?.includes(t.id));
                          const ten = agreementTenants.length > 0 ? agreementTenants[0] : null;
                          return `${prop?.name || 'Unit'} (${ten ? `${ten.first_name[0]}.${ten.last_name}` : 'Tenant'})`;
                        }).join(', ')} nearing end.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recent Collections */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Recent Payments</h3>
              <CreditCard className="h-4 w-4 text-muted-foreground opacity-60" />
            </div>
            
            <div className="space-y-3">
              {recentPayments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-xs flex flex-col items-center gap-2 bg-muted/5 rounded-xl border border-dashed">
                  <CreditCard className="h-8 w-8 opacity-20" />
                  <span>No payments logged</span>
                </div>
              ) : (
                recentPayments.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-card/40 backdrop-blur-sm border border-border/20 hover:bg-muted/10 transition-colors">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold tracking-tight text-primary">₹{Number(p.amount).toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(p.payment_date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      {p.status === 'confirmed' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Confirmed
                        </span>
                      )}
                      {p.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
                          <AlertTriangle className="h-2.5 w-2.5 animate-pulse" /> Pending
                        </span>
                      )}
                      {p.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/10 text-destructive dark:bg-destructive/20">
                          <XCircle className="h-2.5 w-2.5" /> Failed
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
