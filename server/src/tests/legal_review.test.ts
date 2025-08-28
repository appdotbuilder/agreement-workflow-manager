import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { agreementRequestsTable } from '../db/schema';
import { type LegalReviewInput, type CreateAgreementRequestInput } from '../schema';
import { legalReview } from '../handlers/legal_review';
import { eq } from 'drizzle-orm';

// Helper function to create a test agreement request
const createTestAgreementRequest = async (): Promise<number> => {
  const testRequest: CreateAgreementRequestInput = {
    vendor_name: 'Test Vendor Corp',
    service_value: 50000.00,
    start_date: new Date('2024-02-01'),
    end_date: new Date('2024-12-31'),
    work_timeline_attachment: '/attachments/timeline.pdf',
    submitted_by: 'PIC_PROCUREMENT'
  };

  const result = await db.insert(agreementRequestsTable)
    .values({
      vendor_name: testRequest.vendor_name,
      service_value: testRequest.service_value.toString(),
      start_date: testRequest.start_date,
      end_date: testRequest.end_date,
      work_timeline_attachment: testRequest.work_timeline_attachment,
      submitted_by: testRequest.submitted_by,
      status: 'SUBMITTED'
    })
    .returning()
    .execute();

  return result[0].id;
};

describe('legalReview', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should approve agreement request with notes', async () => {
    const agreementId = await createTestAgreementRequest();

    const input: LegalReviewInput = {
      agreement_request_id: agreementId,
      approved: true,
      notes: 'Agreement terms are acceptable. Minor revisions needed in clause 3.'
    };

    const result = await legalReview(input);

    // Verify returned data
    expect(result.id).toEqual(agreementId);
    expect(result.status).toEqual('APPROVED_BY_LEGAL');
    expect(result.legal_review_notes).toEqual(input.notes ?? null);
    expect(result.legal_reviewed_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.service_value).toEqual(50000.00);
    expect(typeof result.service_value).toBe('number');
    
    // Verify other fields remain unchanged
    expect(result.vendor_name).toEqual('Test Vendor Corp');
    expect(result.submitted_by).toEqual('PIC_PROCUREMENT');
  });

  it('should decline agreement request with notes', async () => {
    const agreementId = await createTestAgreementRequest();

    const input: LegalReviewInput = {
      agreement_request_id: agreementId,
      approved: false,
      notes: 'Contract terms are not acceptable. Liability clause needs major revision.'
    };

    const result = await legalReview(input);

    expect(result.id).toEqual(agreementId);
    expect(result.status).toEqual('DECLINED_BY_LEGAL');
    expect(result.legal_review_notes).toEqual(input.notes ?? null);
    expect(result.legal_reviewed_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should approve agreement request without notes', async () => {
    const agreementId = await createTestAgreementRequest();

    const input: LegalReviewInput = {
      agreement_request_id: agreementId,
      approved: true
    };

    const result = await legalReview(input);

    expect(result.status).toEqual('APPROVED_BY_LEGAL');
    expect(result.legal_review_notes).toBeNull();
    expect(result.legal_reviewed_at).toBeInstanceOf(Date);
  });

  it('should update database record correctly', async () => {
    const agreementId = await createTestAgreementRequest();
    const beforeUpdate = new Date();

    const input: LegalReviewInput = {
      agreement_request_id: agreementId,
      approved: true,
      notes: 'Database update test'
    };

    await legalReview(input);

    // Query database directly to verify changes
    const updatedRequest = await db.select()
      .from(agreementRequestsTable)
      .where(eq(agreementRequestsTable.id, agreementId))
      .execute();

    expect(updatedRequest).toHaveLength(1);
    const record = updatedRequest[0];
    expect(record.status).toEqual('APPROVED_BY_LEGAL');
    expect(record.legal_review_notes).toEqual('Database update test');
    expect(record.legal_reviewed_at).toBeInstanceOf(Date);
    expect(record.legal_reviewed_at!.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    expect(record.updated_at).toBeInstanceOf(Date);
    expect(record.updated_at.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
  });

  it('should throw error for non-existent agreement request', async () => {
    const input: LegalReviewInput = {
      agreement_request_id: 99999,
      approved: true,
      notes: 'This should fail'
    };

    await expect(legalReview(input)).rejects.toThrow(/Agreement request with id 99999 not found/i);
  });

  it('should throw error for agreement not in SUBMITTED status', async () => {
    const agreementId = await createTestAgreementRequest();

    // First approve the request
    await legalReview({
      agreement_request_id: agreementId,
      approved: true,
      notes: 'First approval'
    });

    // Try to review again - should fail
    const input: LegalReviewInput = {
      agreement_request_id: agreementId,
      approved: false,
      notes: 'This should fail'
    };

    await expect(legalReview(input)).rejects.toThrow(/is not in SUBMITTED status/i);
  });

  it('should handle agreement with different submitted_by roles', async () => {
    // Create agreement submitted by different role
    const result = await db.insert(agreementRequestsTable)
      .values({
        vendor_name: 'Different Role Vendor',
        service_value: '25000.50',
        start_date: new Date('2024-03-01'),
        end_date: new Date('2024-11-30'),
        work_timeline_attachment: '/attachments/different.pdf',
        submitted_by: 'PIC_OFFICE_MANAGER',
        status: 'SUBMITTED'
      })
      .returning()
      .execute();

    const agreementId = result[0].id;

    const input: LegalReviewInput = {
      agreement_request_id: agreementId,
      approved: true,
      notes: 'Approved for office manager submission'
    };

    const reviewResult = await legalReview(input);

    expect(reviewResult.status).toEqual('APPROVED_BY_LEGAL');
    expect(reviewResult.submitted_by).toEqual('PIC_OFFICE_MANAGER');
    expect(reviewResult.service_value).toEqual(25000.50);
    expect(typeof reviewResult.service_value).toBe('number');
  });

  it('should preserve all original data when updating', async () => {
    const agreementId = await createTestAgreementRequest();

    const input: LegalReviewInput = {
      agreement_request_id: agreementId,
      approved: true,
      notes: 'Preserve original data test'
    };

    const result = await legalReview(input);

    // Verify all original fields are preserved
    expect(result.vendor_name).toEqual('Test Vendor Corp');
    expect(result.service_value).toEqual(50000.00);
    expect(result.start_date).toEqual(new Date('2024-02-01'));
    expect(result.end_date).toEqual(new Date('2024-12-31'));
    expect(result.work_timeline_attachment).toEqual('/attachments/timeline.pdf');
    expect(result.submitted_by).toEqual('PIC_PROCUREMENT');
    expect(result.submitted_at).toBeInstanceOf(Date);
    expect(result.created_at).toBeInstanceOf(Date);

    // Verify new fields are set
    expect(result.status).toEqual('APPROVED_BY_LEGAL');
    expect(result.legal_review_notes).toEqual('Preserve original data test');
    expect(result.legal_reviewed_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify fields not yet used remain null
    expect(result.draft_agreement_attachment).toBeNull();
    expect(result.draft_uploaded_at).toBeNull();
    expect(result.signed_agreement_attachment).toBeNull();
    expect(result.signed_uploaded_at).toBeNull();
  });
});