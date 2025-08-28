import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { agreementRequestsTable, verificationRecordsTable } from '../db/schema';
import { type VerifyDraftInput, type UserRole } from '../schema';
import { verifyDraft } from '../handlers/verify_draft';
import { eq } from 'drizzle-orm';

// Test data setup
const createTestAgreement = async (status: string = 'DRAFT_UPLOADED') => {
  const result = await db.insert(agreementRequestsTable)
    .values({
      vendor_name: 'Test Vendor',
      service_value: '10000.00',
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-12-31'),
      work_timeline_attachment: 'timeline.pdf',
      status: status as any,
      submitted_by: 'PIC_PROCUREMENT'
    })
    .returning()
    .execute();
  
  return result[0];
};

const createTestVerification = async (agreementId: number, verifierRole: UserRole, status: string = 'APPROVED') => {
  const result = await db.insert(verificationRecordsTable)
    .values({
      agreement_request_id: agreementId,
      verifier_role: verifierRole,
      status: status as any,
      verified_at: new Date()
    })
    .returning()
    .execute();
  
  return result[0];
};

describe('verifyDraft', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create verification record when approving', async () => {
    const agreement = await createTestAgreement();
    
    const input: VerifyDraftInput = {
      agreement_request_id: agreement.id,
      verifier_role: 'PIC_PROCUREMENT',
      approved: true,
      notes: 'Looks good to me'
    };

    const result = await verifyDraft(input);

    expect(result.agreement_request_id).toEqual(agreement.id);
    expect(result.verifier_role).toEqual('PIC_PROCUREMENT');
    expect(result.status).toEqual('APPROVED');
    expect(result.notes).toEqual('Looks good to me');
    expect(result.verified_at).toBeInstanceOf(Date);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create verification record when declining', async () => {
    const agreement = await createTestAgreement();
    
    const input: VerifyDraftInput = {
      agreement_request_id: agreement.id,
      verifier_role: 'PIC_TAX',
      approved: false,
      notes: 'Needs revision'
    };

    const result = await verifyDraft(input);

    expect(result.verifier_role).toEqual('PIC_TAX');
    expect(result.status).toEqual('DECLINED');
    expect(result.notes).toEqual('Needs revision');
  });

  it('should save verification to database', async () => {
    const agreement = await createTestAgreement();
    
    const input: VerifyDraftInput = {
      agreement_request_id: agreement.id,
      verifier_role: 'PIC_OFFICE_MANAGER',
      approved: true
    };

    const result = await verifyDraft(input);

    const verifications = await db.select()
      .from(verificationRecordsTable)
      .where(eq(verificationRecordsTable.id, result.id))
      .execute();

    expect(verifications).toHaveLength(1);
    expect(verifications[0].agreement_request_id).toEqual(agreement.id);
    expect(verifications[0].verifier_role).toEqual('PIC_OFFICE_MANAGER');
    expect(verifications[0].status).toEqual('APPROVED');
  });

  it('should update agreement status to FULLY_APPROVED when all verifiers approve', async () => {
    const agreement = await createTestAgreement();
    
    // Create verifications for first two verifiers
    await createTestVerification(agreement.id, 'PIC_PROCUREMENT', 'APPROVED');
    await createTestVerification(agreement.id, 'PIC_TAX', 'APPROVED');
    
    // Third and final verification
    const input: VerifyDraftInput = {
      agreement_request_id: agreement.id,
      verifier_role: 'PIC_OFFICE_MANAGER',
      approved: true
    };

    await verifyDraft(input);

    // Check that agreement status was updated
    const updatedAgreements = await db.select()
      .from(agreementRequestsTable)
      .where(eq(agreementRequestsTable.id, agreement.id))
      .execute();

    expect(updatedAgreements[0].status).toEqual('FULLY_APPROVED');
    expect(updatedAgreements[0].updated_at).toBeInstanceOf(Date);
  });

  it('should not update agreement status when not all verifiers have approved', async () => {
    const agreement = await createTestAgreement();
    
    // Only one verification
    const input: VerifyDraftInput = {
      agreement_request_id: agreement.id,
      verifier_role: 'PIC_PROCUREMENT',
      approved: true
    };

    await verifyDraft(input);

    // Check that agreement status was NOT updated
    const updatedAgreements = await db.select()
      .from(agreementRequestsTable)
      .where(eq(agreementRequestsTable.id, agreement.id))
      .execute();

    expect(updatedAgreements[0].status).toEqual('DRAFT_UPLOADED');
  });

  it('should not update agreement status when one verifier declines', async () => {
    const agreement = await createTestAgreement();
    
    // Create one approval
    await createTestVerification(agreement.id, 'PIC_PROCUREMENT', 'APPROVED');
    
    // Decline by second verifier
    const input: VerifyDraftInput = {
      agreement_request_id: agreement.id,
      verifier_role: 'PIC_TAX',
      approved: false,
      notes: 'Tax implications unclear'
    };

    await verifyDraft(input);

    // Check that agreement status was NOT updated
    const updatedAgreements = await db.select()
      .from(agreementRequestsTable)
      .where(eq(agreementRequestsTable.id, agreement.id))
      .execute();

    expect(updatedAgreements[0].status).toEqual('DRAFT_UPLOADED');
  });

  it('should throw error when agreement request does not exist', async () => {
    const input: VerifyDraftInput = {
      agreement_request_id: 999,
      verifier_role: 'PIC_PROCUREMENT',
      approved: true
    };

    expect(verifyDraft(input)).rejects.toThrow(/agreement request not found/i);
  });

  it('should throw error when agreement is not in DRAFT_UPLOADED status', async () => {
    const agreement = await createTestAgreement('SUBMITTED');
    
    const input: VerifyDraftInput = {
      agreement_request_id: agreement.id,
      verifier_role: 'PIC_PROCUREMENT',
      approved: true
    };

    expect(verifyDraft(input)).rejects.toThrow(/must be in draft_uploaded status/i);
  });

  it('should throw error when verifier has already verified', async () => {
    const agreement = await createTestAgreement();
    
    // First verification
    const input: VerifyDraftInput = {
      agreement_request_id: agreement.id,
      verifier_role: 'PIC_PROCUREMENT',
      approved: true
    };

    await verifyDraft(input);

    // Try to verify again with same verifier
    expect(verifyDraft(input)).rejects.toThrow(/already provided verification/i);
  });

  it('should handle verification without notes', async () => {
    const agreement = await createTestAgreement();
    
    const input: VerifyDraftInput = {
      agreement_request_id: agreement.id,
      verifier_role: 'PIC_TAX',
      approved: true
    };

    const result = await verifyDraft(input);

    expect(result.notes).toBeNull();
  });

  it('should handle complex approval workflow correctly', async () => {
    const agreement = await createTestAgreement();
    
    // Verify by PIC_PROCUREMENT
    await verifyDraft({
      agreement_request_id: agreement.id,
      verifier_role: 'PIC_PROCUREMENT',
      approved: true,
      notes: 'Procurement approved'
    });

    // Verify by PIC_TAX  
    await verifyDraft({
      agreement_request_id: agreement.id,
      verifier_role: 'PIC_TAX',
      approved: true,
      notes: 'Tax implications reviewed'
    });

    // Final verification by PIC_OFFICE_MANAGER
    const finalResult = await verifyDraft({
      agreement_request_id: agreement.id,
      verifier_role: 'PIC_OFFICE_MANAGER',
      approved: true,
      notes: 'Final approval given'
    });

    // Check all verifications exist
    const allVerifications = await db.select()
      .from(verificationRecordsTable)
      .where(eq(verificationRecordsTable.agreement_request_id, agreement.id))
      .execute();

    expect(allVerifications).toHaveLength(3);
    expect(allVerifications.every(v => v.status === 'APPROVED')).toBe(true);

    // Check agreement status updated
    const updatedAgreement = await db.select()
      .from(agreementRequestsTable)
      .where(eq(agreementRequestsTable.id, agreement.id))
      .execute();

    expect(updatedAgreement[0].status).toEqual('FULLY_APPROVED');
  });
});