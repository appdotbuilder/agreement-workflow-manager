import { db } from '../db';
import { agreementRequestsTable, verificationRecordsTable } from '../db/schema';
import { type UploadDraftInput, type AgreementRequest } from '../schema';
import { eq } from 'drizzle-orm';

export const uploadDraftAgreement = async (input: UploadDraftInput): Promise<AgreementRequest> => {
  try {
    // First, verify the agreement request exists and has the correct status
    const existingRequest = await db.select()
      .from(agreementRequestsTable)
      .where(eq(agreementRequestsTable.id, input.agreement_request_id))
      .execute();

    if (existingRequest.length === 0) {
      throw new Error(`Agreement request with id ${input.agreement_request_id} not found`);
    }

    const request = existingRequest[0];
    
    // Verify the request has been approved by legal
    if (request.status !== 'APPROVED_BY_LEGAL') {
      throw new Error('Agreement request must be approved by legal before uploading draft');
    }

    // Update the agreement request with draft attachment and status
    const updatedRequest = await db.update(agreementRequestsTable)
      .set({
        draft_agreement_attachment: input.draft_agreement_attachment,
        draft_uploaded_at: new Date(),
        status: 'DRAFT_UPLOADED',
        updated_at: new Date()
      })
      .where(eq(agreementRequestsTable.id, input.agreement_request_id))
      .returning()
      .execute();

    // Create verification records for the required roles in the specified order
    const verificationRoles = ['PIC_PROCUREMENT', 'PIC_TAX', 'PIC_OFFICE_MANAGER'] as const;
    
    await db.insert(verificationRecordsTable)
      .values(verificationRoles.map(role => ({
        agreement_request_id: input.agreement_request_id,
        verifier_role: role,
        status: 'PENDING' as const,
        created_at: new Date(),
        updated_at: new Date()
      })))
      .execute();

    // Convert numeric fields back to numbers before returning
    const result = updatedRequest[0];
    return {
      ...result,
      service_value: parseFloat(result.service_value)
    };
  } catch (error) {
    console.error('Draft agreement upload failed:', error);
    throw error;
  }
};