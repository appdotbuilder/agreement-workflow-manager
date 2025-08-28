import { db } from '../db';
import { agreementRequestsTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type UserRole } from '../schema';

export interface DownloadResponse {
  fileUrl: string;
  fileName: string;
  contentType: string;
}

export const downloadSignedAgreement = async (agreementId: number, userRole: UserRole): Promise<DownloadResponse | null> => {
  try {
    // Check if user has permission to download signed agreements
    const allowedRoles: UserRole[] = ['PIC_PROCUREMENT', 'PIC_TAX', 'PIC_OFFICE_MANAGER'];
    
    if (!allowedRoles.includes(userRole)) {
      return null; // Unauthorized
    }

    // Find the agreement request
    const agreements = await db.select()
      .from(agreementRequestsTable)
      .where(eq(agreementRequestsTable.id, agreementId))
      .execute();

    if (agreements.length === 0) {
      return null; // Agreement not found
    }

    const agreement = agreements[0];

    // Check if signed agreement is available
    if (!agreement.signed_agreement_attachment) {
      return null; // No signed agreement available
    }

    // Only allow download if agreement is in SIGNED_UPLOADED status
    if (agreement.status !== 'SIGNED_UPLOADED') {
      return null; // Agreement not yet signed
    }

    // Return download information
    return {
      fileUrl: agreement.signed_agreement_attachment,
      fileName: `signed-agreement-${agreement.vendor_name}-${agreementId}.pdf`,
      contentType: 'application/pdf'
    };
  } catch (error) {
    console.error('Download signed agreement failed:', error);
    throw error;
  }
};