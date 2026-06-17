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

import type { Property } from './PropertiesPage';
import type { Agreement } from './AgreementsPage';

export interface Payment {
  id: string;
  agreement_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
}

export function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({ agreement_id: '', amount: '', payment_date: '' });

  const fetchData = async () => {
    try {
      const [payRes, agrRes, propRes] = await Promise.all([
        api.get('/payments/'),
        api.get('/agreements/'),
        api.get('/properties/')
      ]);
      setPayments(payRes.data);
      setAgreements(agrRes.data);
      setProperties(propRes.data);
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
      await api.post('/payments/', {
        ...formData,
        agreement_id: parseInt(formData.agreement_id),
        amount: parseFloat(formData.amount)
      });
      setIsOpen(false);
      setFormData({ agreement_id: '', amount: '', payment_date: '' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Payments</h2>
          <p className="text-muted-foreground">Track your received rent payments</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Record Payment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record New Payment</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="agreement_id">Rental Agreement</Label>
                <select 
                  id="agreement_id" 
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.agreement_id} 
                  onChange={e => setFormData({...formData, agreement_id: e.target.value})} 
                  required
                >
                  <option value="">Select Agreement</option>
                  {agreements.map(a => {
                    const prop = properties.find(p => p.id === a.property_id);
                    return (
                      <option key={a.id} value={a.id}>
                        Agreement #{a.id} ({prop?.name || 'Unknown Property'})
                      </option>
                    )
                  })}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount ($)</Label>
                  <Input id="amount" type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_date">Payment Date</Label>
                  <Input id="payment_date" type="date" value={formData.payment_date} onChange={e => setFormData({...formData, payment_date: e.target.value})} required />
                </div>
              </div>
              <Button type="submit" className="w-full">Save Payment</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>A list of all recorded payments.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment ID</TableHead>
                <TableHead>Agreement</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No payments recorded.</TableCell>
                </TableRow>
              )}
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">#{p.id}</TableCell>
                  <TableCell>
                    {(() => {
                      const agr = agreements.find(a => a.id === p.agreement_id);
                      if (!agr) return `Agreement #${p.agreement_id}`;
                      const prop = properties.find(pr => pr.id === agr.property_id);
                      return `Agreement #${p.agreement_id} - ${prop?.name || ''}`;
                    })()}
                  </TableCell>
                  <TableCell>{new Date(p.payment_date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right font-medium text-green-600 dark:text-green-400">+${Number(p.amount).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
