import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import api from '@/services/api';

export interface Property {
  id: string;
  name: string;
  address: string;
  monthly_rent: number;
}

export function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', address: '', monthly_rent: '' });

  const fetchProperties = async () => {
    try {
      const res = await api.get('/properties/');
      setProperties(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProperties();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/properties/', {
        ...formData,
        monthly_rent: parseFloat(formData.monthly_rent)
      });
      setIsOpen(false);
      setFormData({ name: '', address: '', monthly_rent: '' });
      fetchProperties();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Properties</h2>
          <p className="text-muted-foreground">Manage your real estate portfolio</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Property</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Property</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Property Name</Label>
                <Input id="name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="monthly_rent">Monthly Rent ($)</Label>
                <Input id="monthly_rent" type="number" step="0.01" value={formData.monthly_rent} onChange={e => setFormData({...formData, monthly_rent: e.target.value})} required />
              </div>
              <Button type="submit" className="w-full">Save Property</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Properties</CardTitle>
          <CardDescription>A list of all your registered properties.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="text-right">Monthly Rent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No properties found.</TableCell>
                </TableRow>
              )}
              {properties.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.address}</TableCell>
                  <TableCell className="text-right">${Number(p.monthly_rent).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
