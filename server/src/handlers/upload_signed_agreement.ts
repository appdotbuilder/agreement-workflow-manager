import { db } from '../db';
import { agreementRequestsTable } from '../db/schema';
import { type UploadSignedInput, type AgreementRequest } from '../schema';
import { eq } from 'drizzle-orm';

export const uploadSignedAgreement = async (input: UploadSignedInput): Promise<AgreementRequest> => {
  try {
    // First, verify that the agreement request exists and is in FULLY_APPROVED status
    const existingRequests = await db.select()
      .from(agreementRequestsTable)
      .where(eq(agreementRequestsTable.id, input.agreement_request_id))
      .execute();

    if (existingRequests.length === 0) {
      throw new Error(`Agreement request with ID ${input.agreement_request_id} not found`);
    }

    const existingRequest = existingRequests[0];

    // Verify that the request is in FULLY_APPROVED status
    if (existingRequest.status !== 'FULLY_APPROVED') {
      throw new Error(`Agreement request must be in FULLY_APPROVED status to upload signed agreement. Current status: ${existingRequest.status}`);
    }

    // Update the agreement request with signed agreement details
    const result = await db.update(agreementRequestsTable)
      .set({
        signed_agreement_attachment: input.signed_agreement_attachment,
        signed_uploaded_at: new Date(),
        status: 'SIGNED_UPLOADED',
        updated_at: new Date()
      })
      .where(eq(agreementRequestsTable.id, input.agreement_request_id))
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const updatedRequest = result[0];
    return {
      ...updatedRequest,
      service_value: parseFloat(updatedRequest.service_value)
    };
  } catch (error) {
    console.error('Upload signed agreement failed:', error);
    throw error;
  }
};