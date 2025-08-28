import { db } from '../db';
import { agreementRequestsTable, verificationRecordsTable } from '../db/schema';
import { type VerifyDraftInput, type VerificationRecord } from '../schema';
import { eq, and } from 'drizzle-orm';

export const verifyDraft = async (input: VerifyDraftInput): Promise<VerificationRecord> => {
  try {
    // First, verify the agreement request exists and is in DRAFT_UPLOADED status
    const agreements = await db.select()
      .from(agreementRequestsTable)
      .where(eq(agreementRequestsTable.id, input.agreement_request_id))
      .execute();

    if (agreements.length === 0) {
      throw new Error('Agreement request not found');
    }

    const agreement = agreements[0];
    if (agreement.status !== 'DRAFT_UPLOADED') {
      throw new Error('Agreement must be in DRAFT_UPLOADED status to be verified');
    }

    // Check if this verifier has already verified this agreement
    const existingVerifications = await db.select()
      .from(verificationRecordsTable)
      .where(and(
        eq(verificationRecordsTable.agreement_request_id, input.agreement_request_id),
        eq(verificationRecordsTable.verifier_role, input.verifier_role)
      ))
      .execute();

    if (existingVerifications.length > 0) {
      throw new Error('This verifier has already provided verification for this agreement');
    }

    // Create the verification record
    const verificationResult = await db.insert(verificationRecordsTable)
      .values({
        agreement_request_id: input.agreement_request_id,
        verifier_role: input.verifier_role,
        status: input.approved ? 'APPROVED' : 'DECLINED',
        notes: input.notes || null,
        verified_at: new Date()
      })
      .returning()
      .execute();

    const verification = verificationResult[0];

    // If declined, we don't need to check for full approval
    if (!input.approved) {
      return verification;
    }

    // If approved, check if all required verifiers have approved
    // Required verifiers: PIC_PROCUREMENT, PIC_TAX, PIC_OFFICE_MANAGER
    const allVerifications = await db.select()
      .from(verificationRecordsTable)
      .where(eq(verificationRecordsTable.agreement_request_id, input.agreement_request_id))
      .execute();

    const approvedVerifiers = allVerifications
      .filter(v => v.status === 'APPROVED')
      .map(v => v.verifier_role);

    const requiredVerifiers = ['PIC_PROCUREMENT', 'PIC_TAX', 'PIC_OFFICE_MANAGER'] as const;
    const allApproved = requiredVerifiers.every(role => approvedVerifiers.includes(role));

    // If all required verifiers have approved, update agreement status to FULLY_APPROVED
    if (allApproved) {
      await db.update(agreementRequestsTable)
        .set({
          status: 'FULLY_APPROVED',
          updated_at: new Date()
        })
        .where(eq(agreementRequestsTable.id, input.agreement_request_id))
        .execute();
    }

    return verification;
  } catch (error) {
    console.error('Draft verification failed:', error);
    throw error;
  }
};