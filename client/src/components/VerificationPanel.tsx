import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { trpc } from '@/utils/trpc';
import type { AgreementWithVerifications, UserRole, VerifyDraftInput } from '../../../server/src/schema';

interface VerificationPanelProps {
  agreement: AgreementWithVerifications;
  currentUserRole: UserRole;
  onSuccess: () => void;
  getRoleDisplayName: (role: UserRole) => string;
}

export function VerificationPanel({ 
  agreement, 
  currentUserRole, 
  onSuccess, 
  getRoleDisplayName 
}: VerificationPanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const verificationOrder: UserRole[] = ['PIC_PROCUREMENT', 'PIC_TAX', 'PIC_OFFICE_MANAGER'];
  
  // Find current user's verification
  const userVerification = agreement.verifications.find(
    (v) => v.verifier_role === currentUserRole
  );
  
  // Check if user can verify (hasn't verified yet and it's their turn in order)
  const canVerify = () => {
    if (userVerification && userVerification.status !== 'PENDING') {
      return false; // Already verified
    }
    
    if (!verificationOrder.includes(currentUserRole)) {
      return false; // Not a verifier role
    }

    // Check if previous roles in order have approved
    const userOrderIndex = verificationOrder.indexOf(currentUserRole);
    for (let i = 0; i < userOrderIndex; i++) {
      const prevRole = verificationOrder[i];
      const prevVerification = agreement.verifications.find(v => v.verifier_role === prevRole);
      if (!prevVerification || prevVerification.status !== 'APPROVED') {
        return false; // Previous role hasn't approved yet
      }
    }
    
    return true;
  };

  const handleVerification = async (approved: boolean) => {
    setError(null);
    setIsSubmitting(true);

    const verificationData: VerifyDraftInput = {
      agreement_request_id: agreement.agreement.id,
      verifier_role: currentUserRole,
      approved,
      notes: notes.trim() || undefined
    };

    try {
      await trpc.verifyDraft.mutate(verificationData);
      setNotes('');
      onSuccess();
    } catch (error) {
      console.error('Failed to submit verification:', error);
      setError(error instanceof Error ? error.message : 'Failed to submit verification');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getVerificationProgress = () => {
    const approvedCount = agreement.verifications.filter(v => v.status === 'APPROVED').length;
    return (approvedCount / verificationOrder.length) * 100;
  };

  const getVerificationStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'DECLINED':
        return 'bg-red-100 text-red-800';
      case 'PENDING':
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">✅ Draft Verification</CardTitle>
        <CardDescription>
          {agreement.agreement.draft_agreement_attachment && (
            <span className="text-blue-600">📎 {agreement.agreement.draft_agreement_attachment}</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Verification Progress */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label className="text-sm font-medium">Verification Progress</Label>
            <span className="text-sm text-gray-600">
              {agreement.verifications.filter(v => v.status === 'APPROVED').length} of {verificationOrder.length} approved
            </span>
          </div>
          <Progress value={getVerificationProgress()} className="w-full" />
        </div>

        {/* Verification Status by Role */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Verification Status (In Order)</Label>
          <div className="space-y-2">
            {verificationOrder.map((role: UserRole, index: number) => {
              const verification = agreement.verifications.find(v => v.verifier_role === role);
              const status = verification?.status || 'PENDING';
              const isCurrentUser = role === currentUserRole;
              
              return (
                <div 
                  key={role} 
                  className={`flex justify-between items-center p-3 rounded-md border ${
                    isCurrentUser ? 'border-blue-200 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-700">
                      {index + 1}. {getRoleDisplayName(role)}
                    </span>
                    {isCurrentUser && (
                      <Badge variant="outline" className="text-xs">You</Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getVerificationStatusColor(status)}>
                      {status === 'PENDING' ? '⏳ Pending' : 
                       status === 'APPROVED' ? '✅ Approved' : '❌ Declined'}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* User's Verification Action */}
        {canVerify() ? (
          <div className="space-y-4 pt-4 border-t">
            <div className="bg-blue-50 p-3 rounded-md">
              <p className="text-blue-800 text-sm font-medium">
                🎯 It's your turn to verify this draft agreement
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="verification_notes">📝 Verification Notes (Optional)</Label>
              <Textarea
                id="verification_notes"
                value={notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                placeholder="Add any comments about the draft agreement..."
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => handleVerification(true)}
                disabled={isSubmitting}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? '⏳ Processing...' : '✅ Approve Draft'}
              </Button>
              <Button
                onClick={() => handleVerification(false)}
                disabled={isSubmitting}
                variant="destructive"
                className="flex-1"
              >
                {isSubmitting ? '⏳ Processing...' : '❌ Decline Draft'}
              </Button>
            </div>
          </div>
        ) : userVerification && userVerification.status !== 'PENDING' ? (
          <div className="pt-4 border-t">
            <div className={`p-3 rounded-md ${
              userVerification.status === 'APPROVED' ? 'bg-green-50' : 'bg-red-50'
            }`}>
              <p className={`text-sm font-medium ${
                userVerification.status === 'APPROVED' ? 'text-green-800' : 'text-red-800'
              }`}>
                {userVerification.status === 'APPROVED' ? '✅ You have approved this draft' : '❌ You have declined this draft'}
              </p>
              {userVerification.notes && (
                <p className={`text-sm mt-1 ${
                  userVerification.status === 'APPROVED' ? 'text-green-700' : 'text-red-700'
                }`}>
                  Notes: {userVerification.notes}
                </p>
              )}
              {userVerification.verified_at && (
                <p className={`text-xs mt-1 ${
                  userVerification.status === 'APPROVED' ? 'text-green-600' : 'text-red-600'
                }`}>
                  Verified at: {userVerification.verified_at.toLocaleString()}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="pt-4 border-t">
            <div className="bg-gray-50 p-3 rounded-md">
              <p className="text-gray-700 text-sm">
                ⏳ Waiting for verification from roles ahead of you in the approval sequence
              </p>
            </div>
          </div>
        )}

        <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
          <p className="font-medium mb-1">📋 Verification Order:</p>
          <p className="text-xs">
            Draft agreements must be verified in this specific order: 
            {verificationOrder.map(getRoleDisplayName).join(' → ')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}