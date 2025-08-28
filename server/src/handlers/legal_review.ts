import { db } from '../db';
import { agreementRequestsTable } from '../db/schema';
import { type LegalReviewInput, type AgreementRequest } from '../schema';
import { eq } from 'drizzle-orm';

export const legalReview = async (input: LegalReviewInput): Promise<AgreementRequest> => {
  try {
    // First check if the agreement request exists and is in SUBMITTED status
    const existingRequest = await db.select()
      .from(agreementRequestsTable)
      .where(eq(agreementRequestsTable.id, input.agreement_request_id))
      .execute();

    if (existingRequest.length === 0) {
      throw new Error(`Agreement request with id ${input.agreement_request_id} not found`);
    }

    const currentRequest = existingRequest[0];
    
    if (currentRequest.status !== 'SUBMITTED') {
      throw new Error(`Agreement request ${input.agreement_request_id} is not in SUBMITTED status. Current status: ${currentRequest.status}`);
    }

    // Update the agreement request with legal review decision
    const newStatus = input.approved ? 'APPROVED_BY_LEGAL' : 'DECLINED_BY_LEGAL';
    const reviewTimestamp = new Date();

    const result = await db.update(agreementRequestsTable)
      .set({
        status: newStatus,
        legal_review_notes: input.notes ?? null,
        legal_reviewed_at: reviewTimestamp,
        updated_at: reviewTimestamp
      })
      .where(eq(agreementRequestsTable.id, input.agreement_request_id))
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const updatedRequest = result[0];
    return {
      ...updatedRequest,
      service_value: parseFloat(updatedRequest.service_value) // Convert numeric back to number
    };
  } catch (error) {
    console.error('Legal review failed:', error);
    throw error;
  }
};