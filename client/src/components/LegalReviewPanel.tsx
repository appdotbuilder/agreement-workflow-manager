import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/utils/trpc';
import type { LegalReviewInput } from '../../../server/src/schema';

interface LegalReviewPanelProps {
  agreementId: number;
  onSuccess: () => void;
}

export function LegalReviewPanel({ agreementId, onSuccess }: LegalReviewPanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleReview = async (approved: boolean) => {
    setError(null);
    setIsSubmitting(true);

    const reviewData: LegalReviewInput = {
      agreement_request_id: agreementId,
      approved,
      notes: notes.trim() || undefined
    };

    try {
      await trpc.legalReview.mutate(reviewData);
      setNotes('');
      onSuccess();
    } catch (error) {
      console.error('Failed to submit legal review:', error);
      setError(error instanceof Error ? error.message : 'Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">⚖️ Legal Review</CardTitle>
        <CardDescription>
          Review the agreement request and provide your decision
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="review_notes">📝 Review Notes (Optional)</Label>
          <Textarea
            id="review_notes"
            value={notes}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
            placeholder="Add any comments about the agreement request..."
            rows={4}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            onClick={() => handleReview(true)}
            disabled={isSubmitting}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? '⏳ Processing...' : '✅ Approve'}
          </Button>
          <Button
            onClick={() => handleReview(false)}
            disabled={isSubmitting}
            variant="destructive"
            className="flex-1"
          >
            {isSubmitting ? '⏳ Processing...' : '❌ Decline'}
          </Button>
        </div>

        <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
          <p className="font-medium mb-1">📋 Review Guidelines:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Verify vendor information and service details</li>
            <li>Ensure service value is reasonable and justified</li>
            <li>Check that timeline is realistic and achievable</li>
            <li>Approve to proceed with draft creation, or decline to send back for revisions</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}