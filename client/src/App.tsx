import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/utils/trpc';
import { AgreementRequestForm } from '@/components/AgreementRequestForm';
import { AgreementList } from '@/components/AgreementList';
import { LegalReviewPanel } from '@/components/LegalReviewPanel';
import { VerificationPanel } from '@/components/VerificationPanel';
import { SignedAgreementPanel } from '@/components/SignedAgreementPanel';
import type { UserRole, AgreementWithVerifications } from '../../server/src/schema';

function App() {
  const [agreements, setAgreements] = useState<AgreementWithVerifications[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('PIC_PROCUREMENT');
  const [selectedAgreementId, setSelectedAgreementId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadAgreements = useCallback(async () => {
    try {
      const result = await trpc.getAgreementRequests.query();
      setAgreements(result);
    } catch (error) {
      console.error('Failed to load agreements:', error);
    }
  }, []);

  useEffect(() => {
    loadAgreements();
  }, [loadAgreements]);

  const handleAgreementCreated = useCallback(() => {
    loadAgreements();
  }, [loadAgreements]);

  const handleAgreementUpdated = useCallback(() => {
    loadAgreements();
  }, [loadAgreements]);

  const selectedAgreement = selectedAgreementId 
    ? agreements.find((a: AgreementWithVerifications) => a.agreement.id === selectedAgreementId) 
    : null;

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return 'bg-blue-100 text-blue-800';
      case 'APPROVED_BY_LEGAL':
        return 'bg-green-100 text-green-800';
      case 'DECLINED_BY_LEGAL':
        return 'bg-red-100 text-red-800';
      case 'DRAFT_UPLOADED':
        return 'bg-orange-100 text-orange-800';
      case 'FULLY_APPROVED':
        return 'bg-purple-100 text-purple-800';
      case 'SIGNED_UPLOADED':
        return 'bg-emerald-100 text-emerald-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleDisplayName = (role: UserRole) => {
    switch (role) {
      case 'PIC_PROCUREMENT':
        return 'PIC Procurement';
      case 'PIC_LEGAL':
        return 'PIC Legal';
      case 'PIC_TAX':
        return 'PIC Tax';
      case 'PIC_OFFICE_MANAGER':
        return 'PIC Office Manager';
      default:
        return role;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">📋 Agreement Management System</h1>
          <p className="text-gray-600">Manage vendor agreements through the complete approval workflow</p>
        </div>

        {/* Role Selector */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">👤 Current User Role</CardTitle>
            <CardDescription>
              Select your role to access relevant features and view appropriate information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select 
              value={currentUserRole} 
              onValueChange={(value: UserRole) => setCurrentUserRole(value)}
            >
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PIC_PROCUREMENT">👨‍💼 PIC Procurement</SelectItem>
                <SelectItem value="PIC_LEGAL">⚖️ PIC Legal</SelectItem>
                <SelectItem value="PIC_TAX">💰 PIC Tax</SelectItem>
                <SelectItem value="PIC_OFFICE_MANAGER">🏢 PIC Office Manager</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Agreement List and Actions */}
          <div className="space-y-6">
            <Tabs defaultValue="list" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="list">📂 All Agreements</TabsTrigger>
                <TabsTrigger 
                  value="create" 
                  disabled={currentUserRole !== 'PIC_PROCUREMENT'}
                >
                  ➕ New Request
                </TabsTrigger>
              </TabsList>

              <TabsContent value="list" className="mt-4">
                <AgreementList
                  agreements={agreements}
                  selectedId={selectedAgreementId}
                  onSelect={setSelectedAgreementId}
                  getStatusBadgeColor={getStatusBadgeColor}
                  getRoleDisplayName={getRoleDisplayName}
                />
              </TabsContent>

              <TabsContent value="create" className="mt-4">
                {currentUserRole === 'PIC_PROCUREMENT' ? (
                  <AgreementRequestForm
                    onSuccess={handleAgreementCreated}
                    currentUserRole={currentUserRole}
                  />
                ) : (
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-gray-500 text-center">
                        Only PIC Procurement can create new agreement requests
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Panel - Agreement Details and Actions */}
          <div className="space-y-6">
            {selectedAgreement ? (
              <>
                {/* Agreement Details */}
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-xl">
                          🏢 {selectedAgreement.agreement.vendor_name}
                        </CardTitle>
                        <CardDescription>
                          Agreement Request #{selectedAgreement.agreement.id}
                        </CardDescription>
                      </div>
                      <Badge className={getStatusBadgeColor(selectedAgreement.agreement.status)}>
                        {selectedAgreement.agreement.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Service Value</p>
                        <p className="text-lg font-semibold text-green-600">
                          ${selectedAgreement.agreement.service_value.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">Submitted By</p>
                        <p className="text-sm text-gray-900">
                          {getRoleDisplayName(selectedAgreement.agreement.submitted_by)}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Start Date</p>
                        <p className="text-sm text-gray-900">
                          {selectedAgreement.agreement.start_date.toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">End Date</p>
                        <p className="text-sm text-gray-900">
                          {selectedAgreement.agreement.end_date.toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Work Timeline Attachment</p>
                      <p className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer">
                        📎 {selectedAgreement.agreement.work_timeline_attachment}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Submitted At</p>
                      <p className="text-sm text-gray-500">
                        {selectedAgreement.agreement.submitted_at.toLocaleString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Action Panels based on status and role */}
                {selectedAgreement.agreement.status === 'SUBMITTED' && currentUserRole === 'PIC_LEGAL' && (
                  <LegalReviewPanel
                    agreementId={selectedAgreement.agreement.id}
                    onSuccess={handleAgreementUpdated}
                  />
                )}

                {selectedAgreement.agreement.status === 'APPROVED_BY_LEGAL' && currentUserRole === 'PIC_LEGAL' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">📝 Upload Draft Agreement</CardTitle>
                      <CardDescription>
                        Upload the draft agreement for verification by other departments
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {/* Draft upload component would go here */}
                      <p className="text-gray-500 italic">Draft upload functionality - to be implemented</p>
                    </CardContent>
                  </Card>
                )}

                {selectedAgreement.agreement.status === 'DRAFT_UPLOADED' && (
                  <VerificationPanel
                    agreement={selectedAgreement}
                    currentUserRole={currentUserRole}
                    onSuccess={handleAgreementUpdated}
                    getRoleDisplayName={getRoleDisplayName}
                  />
                )}

                {selectedAgreement.agreement.status === 'FULLY_APPROVED' && currentUserRole === 'PIC_LEGAL' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">✍️ Upload Signed Agreement</CardTitle>
                      <CardDescription>
                        Upload the fully signed agreement
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {/* Signed upload component would go here */}
                      <p className="text-gray-500 italic">Signed agreement upload functionality - to be implemented</p>
                    </CardContent>
                  </Card>
                )}

                {selectedAgreement.agreement.status === 'SIGNED_UPLOADED' && (
                  <SignedAgreementPanel
                    agreementId={selectedAgreement.agreement.id}
                    currentUserRole={currentUserRole}
                    signedAttachment={selectedAgreement.agreement.signed_agreement_attachment}
                  />
                )}
              </>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-gray-500 text-center">
                    Select an agreement from the list to view details and take actions
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;