import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { AgreementWithVerifications, UserRole } from '../../../server/src/schema';

interface AgreementListProps {
  agreements: AgreementWithVerifications[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  getStatusBadgeColor: (status: string) => string;
  getRoleDisplayName: (role: UserRole) => string;
}

export function AgreementList({ 
  agreements, 
  selectedId, 
  onSelect, 
  getStatusBadgeColor, 
  getRoleDisplayName 
}: AgreementListProps) {
  if (agreements.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-gray-500">
            <p className="text-lg mb-2">📂 No agreements yet</p>
            <p className="text-sm">
              Create a new agreement request to get started
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">📋 Agreement Requests</CardTitle>
        <CardDescription>
          {agreements.length} agreement{agreements.length !== 1 ? 's' : ''} in the system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-3">
            {agreements.map((item: AgreementWithVerifications) => (
              <div
                key={item.agreement.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-gray-50 ${
                  selectedId === item.agreement.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200'
                }`}
                onClick={() => onSelect(item.agreement.id)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium text-gray-900">
                      🏢 {item.agreement.vendor_name}
                    </h4>
                    <p className="text-sm text-gray-600">
                      #{item.agreement.id} • ${item.agreement.service_value.toLocaleString()}
                    </p>
                  </div>
                  <Badge className={getStatusBadgeColor(item.agreement.status)}>
                    {item.agreement.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
                
                <div className="flex justify-between text-xs text-gray-500">
                  <span>
                    📅 {item.agreement.start_date.toLocaleDateString()} - {item.agreement.end_date.toLocaleDateString()}
                  </span>
                  <span>
                    👤 {getRoleDisplayName(item.agreement.submitted_by)}
                  </span>
                </div>

                {/* Verification Status Indicators */}
                {item.agreement.status === 'DRAFT_UPLOADED' && item.verifications.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <div className="flex flex-wrap gap-1">
                      {['PIC_PROCUREMENT', 'PIC_TAX', 'PIC_OFFICE_MANAGER'].map((role: string) => {
                        const verification = item.verifications.find(
                          (v) => v.verifier_role === role
                        );
                        const status = verification?.status || 'PENDING';
                        const badgeColor = status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                         status === 'DECLINED' ? 'bg-red-100 text-red-700' :
                                         'bg-gray-100 text-gray-600';
                        
                        return (
                          <Badge key={role} className={`${badgeColor} text-xs`}>
                            {role.split('_').pop()}: {status}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}