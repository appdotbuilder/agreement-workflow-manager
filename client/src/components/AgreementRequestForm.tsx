import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/utils/trpc';
import type { CreateAgreementRequestInput, UserRole } from '../../../server/src/schema';

interface AgreementRequestFormProps {
  onSuccess: () => void;
  currentUserRole: UserRole;
}

export function AgreementRequestForm({ onSuccess, currentUserRole }: AgreementRequestFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateAgreementRequestInput>({
    vendor_name: '',
    service_value: 0,
    start_date: new Date(),
    end_date: new Date(),
    work_timeline_attachment: '',
    submitted_by: currentUserRole
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await trpc.createAgreementRequest.mutate(formData);
      
      // Reset form
      setFormData({
        vendor_name: '',
        service_value: 0,
        start_date: new Date(),
        end_date: new Date(),
        work_timeline_attachment: '',
        submitted_by: currentUserRole
      });

      onSuccess();
    } catch (error) {
      console.error('Failed to create agreement request:', error);
      setError(error instanceof Error ? error.message : 'Failed to create agreement request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof CreateAgreementRequestInput, value: any) => {
    setFormData((prev: CreateAgreementRequestInput) => ({
      ...prev,
      [field]: value
    }));
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">📝 New Agreement Request</CardTitle>
        <CardDescription>
          Submit a new vendor agreement request for legal review
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="vendor_name">🏢 Vendor Name</Label>
            <Input
              id="vendor_name"
              value={formData.vendor_name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleInputChange('vendor_name', e.target.value)
              }
              placeholder="Enter vendor company name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="service_value">💰 Service Value ($)</Label>
            <Input
              id="service_value"
              type="number"
              value={formData.service_value}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleInputChange('service_value', parseFloat(e.target.value) || 0)
              }
              placeholder="0.00"
              step="0.01"
              min="0"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">📅 Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date.toISOString().split('T')[0]}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleInputChange('start_date', new Date(e.target.value))
                }
                min={today}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">📅 End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date.toISOString().split('T')[0]}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleInputChange('end_date', new Date(e.target.value))
                }
                min={formData.start_date.toISOString().split('T')[0]}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="work_timeline">📎 Work Timeline Attachment</Label>
            <Input
              id="work_timeline"
              value={formData.work_timeline_attachment}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleInputChange('work_timeline_attachment', e.target.value)
              }
              placeholder="Enter file path or URL for work timeline document"
              required
            />
            <p className="text-xs text-gray-500">
              Note: In a real implementation, this would be a file upload component
            </p>
          </div>

          <div className="pt-4">
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? '⏳ Submitting...' : '📋 Submit Agreement Request'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}