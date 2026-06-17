/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import api from '@/services/api';

import { Property } from './PropertiesPage';
import { Tenant } from './TenantsPage';

export interface Agreement {
  id: string;
  property_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  rent_amount: number;
  is_active: boolean;
}

export function AgreementsPage() {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({ property_id: '', tenant_id: '', start_date: '', end_date: '', rent_amount: '' });

  const fetchData = async () => {
    try {
      const [agrRes, propRes, tenRes] = await Promise.all([
        api.get('/agreements/'),
        api.get('/properties/'),
        api.get('/tenants/')
      ]);
      setAgreements(agrRes.data);
      setProperties(propRes.data);
      setTenants(tenRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/agreements/', {
        ...formData,
        property_id: parseInt(formData.property_id),
        tenant_id: parseInt(formData.tenant_id),
        rent_amount: parseFloat(formData.rent_amount)
      });
      setIsOpen(false);
      setFormData({ property_id: '', tenant_id: '', start_date: '', end_date: '', rent_amount: '' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Agreements</h2>
          <p className="text-muted-foreground">Manage rental agreements between properties and tenants</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> New Agreement</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Rental Agreement</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="property_id">Property</Label>
                  <select 
                    id="property_id" 
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={formData.property_id} 
                    onChange={e => setFormData({...formData, property_id: e.target.value})} 
                    required
                  >
                    <option value="">Select Property</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenant_id">Tenant</Label>
                  <select 
                    id="tenant_id" 
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={formData.tenant_id} 
                    onChange={e => setFormData({...formData, tenant_id: e.target.value})} 
                    required
                  >
                    <option value="">Select Tenant</option>
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                    ))}
                  </select>
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
              <div className="space-y-2">
                <Label htmlFor="rent_amount">Agreed Rent Amount ($)</Label>
                <Input id="rent_amount" type="number" step="0.01" value={formData.rent_amount} onChange={e => setFormData({...formData, rent_amount: e.target.value})} required />
              </div>
              <Button type="submit" className="w-full">Create Agreement</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Agreements</CardTitle>
          <CardDescription>A list of all rental agreements.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead className="text-right">Rent</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agreements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No agreements found.</TableCell>
                </TableRow>
              )}
              {agreements.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{properties.find(p => p.id === a.property_id)?.name || `Property #${a.property_id}`}</TableCell>
                  <TableCell>{tenants.find(t => t.id === a.tenant_id)?.first_name || `Tenant #${a.tenant_id}`}</TableCell>
                  <TableCell>{new Date(a.start_date).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(a.end_date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">${Number(a.rent_amount).toFixed(2)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      a.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {a.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
