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

export interface Tenant {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

export function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({ first_name: '', last_name: '', email: '', phone: '' });

  const fetchTenants = async () => {
    try {
      const res = await api.get('/tenants/');
      setTenants(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/tenants/', formData);
      setIsOpen(false);
      setFormData({ first_name: '', last_name: '', email: '', phone: '' });
      fetchTenants();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Tenants</h2>
          <p className="text-muted-foreground">Manage your tenants and their details</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Tenant</Button>
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
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} required />
              </div>
              <Button type="submit" className="w-full">Save Tenant</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Tenants</CardTitle>
          <CardDescription>A list of all tenants registered in the system.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No tenants found.</TableCell>
                </TableRow>
              )}
              {tenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.first_name} {t.last_name}</TableCell>
                  <TableCell>{t.email}</TableCell>
                  <TableCell>{t.phone}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
