import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/utils/trpc';
import type { UserRole } from '../../../server/src/schema';

interface SignedAgreementPanelProps {
  agreementId: number;
  currentUserRole: UserRole;
  signedAttachment: string | null;
}

export function SignedAgreementPanel({ 
  agreementId, 
  currentUserRole, 
  signedAttachment 
}: SignedAgreementPanelProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDownload = ['PIC_PROCUREMENT', 'PIC_TAX', 'PIC_OFFICE_MANAGER'].includes(currentUserRole);

  const handleDownload = async () => {
    if (!canDownload) return;

    setError(null);
    setIsDownloading(true);

    try {
      const result = await trpc.downloadSignedAgreement.query({
        agreementId,
        userRole: currentUserRole
      });
      
      // In a real implementation, this would handle the file download
      console.log('Download result:', result);
      
      // Simulate download for demo purposes
      alert('Download started! (This is a demo - actual file download would happen here)');
    } catch (error) {
      console.error('Failed to download signed agreement:', error);
      setError(error instanceof Error ? error.message : 'Failed to download agreement');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">✍️ Signed Agreement</CardTitle>
        <CardDescription>
          The fully executed agreement is ready for download
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm">✓</span>
              </div>
            </div>
            <div className="flex-1">
              <h4 className="text-green-800 font-medium">Agreement Fully Executed</h4>
              <p className="text-green-700 text-sm mt-1">
                The agreement has been signed and is now legally binding. All authorized parties can download the final document.
              </p>
            </div>
          </div>
        </div>

        {signedAttachment && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">📄</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">Signed Agreement</p>
                  <p className="text-xs text-gray-600">{signedAttachment}</p>
                </div>
              </div>
              {canDownload && (
                <Button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  size="sm"
                >
                  {isDownloading ? '⏳ Downloading...' : '📥 Download'}
                </Button>
              )}
            </div>

            {!canDownload && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-yellow-800 text-sm">
                  ⚠️ Your role ({currentUserRole.replace(/_/g, ' ')}) does not have download permissions for signed agreements.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
          <p className="font-medium mb-1">📋 Download Access:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>PIC Procurement: Full access to download signed agreements</li>
            <li>PIC Tax: Can download for tax compliance and record keeping</li>
            <li>PIC Office Manager: Can download for administrative purposes</li>
            <li>PIC Legal: Upload rights only (no download access shown here)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}