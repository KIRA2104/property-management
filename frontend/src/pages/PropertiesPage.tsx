import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Building, MapPin, IndianRupee, Trash2, ShieldAlert } from 'lucide-react';
import api from '@/services/api';

export interface Property {
  id: string;
  name: string;
  address: string;
  monthly_rent: number;
  is_available: boolean;
}

export function PropertiesPage() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', address: '', monthly_rent: '' });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [occupancyFilter, setOccupancyFilter] = useState<'all' | 'vacant' | 'rented'>('all');

  const { data: properties = [], isLoading } = useQuery<Property[]>({
    queryKey: ['properties'],
    queryFn: () => api.get('/properties/').then(res => res.data.items)
  });

  const safeProperties = Array.isArray(properties) ? properties : [];
  const filteredProperties = safeProperties.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.address.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (occupancyFilter === 'vacant') {
      return matchesSearch && p.is_available;
    }
    if (occupancyFilter === 'rented') {
      return matchesSearch && !p.is_available;
    }
    return matchesSearch;
  });

  const createMutation = useMutation({
    mutationFn: (newProperty: Omit<Property, 'id' | 'is_available'>) => api.post('/properties/', newProperty),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsOpen(false);
      setFormData({ name: '', address: '', monthly_rent: '' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/properties/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setDeleteId(null);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      monthly_rent: parseFloat(formData.monthly_rent)
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Properties</h2>
          <p className="text-muted-foreground">Manage your real estate portfolio.</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="hover:scale-105 transition-transform"><Plus className="mr-2 h-4 w-4" /> Add Property</Button>
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
                <Label htmlFor="monthly_rent">Monthly Rent (₹)</Label>
                <Input id="monthly_rent" type="number" step="0.01" value={formData.monthly_rent} onChange={e => setFormData({...formData, monthly_rent: e.target.value})} required />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saving...' : 'Save Property'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : properties.length === 0 ? (
        <div className="border-dashed border-2 border-primary/20 bg-primary/5 flex flex-col items-center justify-center p-12 text-center space-y-4 rounded-3xl">
          <Building className="h-16 w-16 text-primary/30 animate-pulse" />
          <h3 className="text-xl font-bold">No Properties Registered</h3>
          <p className="text-sm text-muted-foreground max-w-sm">Get started by entering your first property to manage tenants and agreements.</p>
          <Button onClick={() => setIsOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create First Property
          </Button>
        </div>
      ) : (
        <>
          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-card/30 backdrop-blur-sm p-3 rounded-2xl border border-border/20 shadow-sm">
            <div className="relative w-full md:w-80">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                <Building className="h-4 w-4" />
              </span>
              <Input 
                type="text" 
                placeholder="Search properties..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                className="pl-9 w-full"
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              {(['all', 'vacant', 'rented'] as const).map((filter) => (
                <Button
                  key={filter}
                  variant={occupancyFilter === filter ? 'default' : 'outline'}
                  onClick={() => setOccupancyFilter(filter)}
                  size="sm"
                  className="capitalize flex-1 md:flex-initial"
                >
                  {filter}
                </Button>
              ))}
            </div>
          </div>

          {filteredProperties.length === 0 ? (
            <div className="border-dashed border-2 border-muted bg-muted/5 flex flex-col items-center justify-center p-12 text-center space-y-4 rounded-2xl">
              <Building className="h-12 w-12 text-muted-foreground/30" />
              <h3 className="text-lg font-bold">No Match Found</h3>
              <p className="text-sm text-muted-foreground">Try adjusting your filters or search keywords.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30 bg-card/20 backdrop-blur-sm rounded-2xl border border-border/20 overflow-hidden shadow-sm">
              {filteredProperties.map((p) => (
                <div 
                  key={p.id} 
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 hover:bg-muted/10 transition-all duration-300 group"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="p-3 bg-primary/5 text-primary rounded-2xl group-hover:scale-110 transition-transform duration-300 shrink-0">
                      <Building className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <h3 className="text-base font-bold tracking-tight text-foreground truncate">{p.name}</h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" /> {p.address}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0">
                    {/* Rent */}
                    <div className="text-right sm:min-w-[120px]">
                      <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Monthly Rent</span>
                      <span className="text-base font-bold text-primary flex items-center justify-end">
                        <IndianRupee className="h-3.5 w-3.5 shrink-0" />
                        {Number(p.monthly_rent).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Status */}
                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider ${
                      p.is_available 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400' 
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400'
                    }`}>
                      {p.is_available ? 'Vacant' : 'Rented'}
                    </span>

                    {/* Actions */}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive rounded-xl shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      onClick={() => setDeleteId(p.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
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
              Are you absolutely sure you want to delete this property? This action is permanent and will archive the record.
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
