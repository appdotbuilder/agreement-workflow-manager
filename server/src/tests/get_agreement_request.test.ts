import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { agreementRequestsTable, verificationRecordsTable } from '../db/schema';
import { type CreateAgreementRequestInput } from '../schema';
import { getAgreementRequest } from '../handlers/get_agreement_request';

// Test data for agreement request
const testAgreementInput: CreateAgreementRequestInput = {
  vendor_name: 'Test Vendor Inc.',
  service_value: 25000.50,
  start_date: new Date('2024-01-15'),
  end_date: new Date('2024-12-31'),
  work_timeline_attachment: '/uploads/timeline.pdf',
  submitted_by: 'PIC_PROCUREMENT'
};

describe('getAgreementRequest', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null for non-existent agreement request', async () => {
    const result = await getAgreementRequest(999);
    expect(result).toBeNull();
  });

  it('should retrieve agreement request without verification records', async () => {
    // Create test agreement request
    const agreementResults = await db.insert(agreementRequestsTable)
      .values({
        vendor_name: testAgreementInput.vendor_name,
        service_value: testAgreementInput.service_value.toString(),
        start_date: testAgreementInput.start_date,
        end_date: testAgreementInput.end_date,
        work_timeline_attachment: testAgreementInput.work_timeline_attachment,
        submitted_by: testAgreementInput.submitted_by
      })
      .returning()
      .execute();

    const createdAgreement = agreementResults[0];
    const result = await getAgreementRequest(createdAgreement.id);

    expect(result).not.toBeNull();
    expect(result!.agreement.id).toEqual(createdAgreement.id);
    expect(result!.agreement.vendor_name).toEqual('Test Vendor Inc.');
    expect(result!.agreement.service_value).toEqual(25000.50);
    expect(typeof result!.agreement.service_value).toBe('number');
    expect(result!.agreement.start_date).toBeInstanceOf(Date);
    expect(result!.agreement.end_date).toBeInstanceOf(Date);
    expect(result!.agreement.status).toEqual('SUBMITTED');
    expect(result!.agreement.submitted_by).toEqual('PIC_PROCUREMENT');
    expect(result!.verifications).toEqual([]);
  });

  it('should retrieve agreement request with verification records', async () => {
    // Create test agreement request
    const agreementResults = await db.insert(agreementRequestsTable)
      .values({
        vendor_name: testAgreementInput.vendor_name,
        service_value: testAgreementInput.service_value.toString(),
        start_date: testAgreementInput.start_date,
        end_date: testAgreementInput.end_date,
        work_timeline_attachment: testAgreementInput.work_timeline_attachment,
        submitted_by: testAgreementInput.submitted_by,
        status: 'DRAFT_UPLOADED'
      })
      .returning()
      .execute();

    const createdAgreement = agreementResults[0];

    // Create verification records
    const verificationData = [
      {
        agreement_request_id: createdAgreement.id,
        verifier_role: 'PIC_TAX' as const,
        status: 'APPROVED' as const,
        notes: 'Tax compliance verified',
        verified_at: new Date('2024-02-01T10:00:00Z')
      },
      {
        agreement_request_id: createdAgreement.id,
        verifier_role: 'PIC_OFFICE_MANAGER' as const,
        status: 'PENDING' as const,
        notes: null,
        verified_at: null
      }
    ];

    await db.insert(verificationRecordsTable)
      .values(verificationData)
      .execute();

    const result = await getAgreementRequest(createdAgreement.id);

    expect(result).not.toBeNull();
    expect(result!.agreement.id).toEqual(createdAgreement.id);
    expect(result!.agreement.vendor_name).toEqual('Test Vendor Inc.');
    expect(result!.agreement.service_value).toEqual(25000.50);
    expect(result!.agreement.status).toEqual('DRAFT_UPLOADED');
    
    // Check verification records
    expect(result!.verifications).toHaveLength(2);
    
    const taxVerification = result!.verifications.find(v => v.verifier_role === 'PIC_TAX');
    expect(taxVerification).toBeDefined();
    expect(taxVerification!.status).toEqual('APPROVED');
    expect(taxVerification!.notes).toEqual('Tax compliance verified');
    expect(taxVerification!.verified_at).toBeInstanceOf(Date);
    
    const managerVerification = result!.verifications.find(v => v.verifier_role === 'PIC_OFFICE_MANAGER');
    expect(managerVerification).toBeDefined();
    expect(managerVerification!.status).toEqual('PENDING');
    expect(managerVerification!.notes).toBeNull();
    expect(managerVerification!.verified_at).toBeNull();
  });

  it('should handle complex agreement request with all optional fields populated', async () => {
    const currentDate = new Date();
    
    // Create agreement request with all optional fields
    const agreementResults = await db.insert(agreementRequestsTable)
      .values({
        vendor_name: 'Complex Vendor LLC',
        service_value: '150000.75',
        start_date: new Date('2024-03-01'),
        end_date: new Date('2024-11-30'),
        work_timeline_attachment: '/uploads/complex-timeline.pdf',
        submitted_by: 'PIC_LEGAL',
        status: 'FULLY_APPROVED',
        legal_review_notes: 'All legal requirements met',
        legal_reviewed_at: currentDate,
        draft_agreement_attachment: '/uploads/draft-agreement.pdf',
        draft_uploaded_at: currentDate,
        signed_agreement_attachment: '/uploads/signed-agreement.pdf',
        signed_uploaded_at: currentDate
      })
      .returning()
      .execute();

    const createdAgreement = agreementResults[0];

    // Create multiple verification records
    await db.insert(verificationRecordsTable)
      .values([
        {
          agreement_request_id: createdAgreement.id,
          verifier_role: 'PIC_TAX',
          status: 'APPROVED',
          notes: 'Tax verification complete',
          verified_at: currentDate
        },
        {
          agreement_request_id: createdAgreement.id,
          verifier_role: 'PIC_OFFICE_MANAGER',
          status: 'APPROVED',
          notes: 'Office manager approval granted',
          verified_at: currentDate
        },
        {
          agreement_request_id: createdAgreement.id,
          verifier_role: 'PIC_PROCUREMENT',
          status: 'DECLINED',
          notes: 'Budget concerns identified',
          verified_at: currentDate
        }
      ])
      .execute();

    const result = await getAgreementRequest(createdAgreement.id);

    expect(result).not.toBeNull();
    expect(result!.agreement.id).toEqual(createdAgreement.id);
    expect(result!.agreement.vendor_name).toEqual('Complex Vendor LLC');
    expect(result!.agreement.service_value).toEqual(150000.75);
    expect(typeof result!.agreement.service_value).toBe('number');
    expect(result!.agreement.status).toEqual('FULLY_APPROVED');
    expect(result!.agreement.legal_review_notes).toEqual('All legal requirements met');
    expect(result!.agreement.legal_reviewed_at).toBeInstanceOf(Date);
    expect(result!.agreement.draft_agreement_attachment).toEqual('/uploads/draft-agreement.pdf');
    expect(result!.agreement.signed_agreement_attachment).toEqual('/uploads/signed-agreement.pdf');
    
    // Verify all verification records
    expect(result!.verifications).toHaveLength(3);
    
    const approvedVerifications = result!.verifications.filter(v => v.status === 'APPROVED');
    const declinedVerifications = result!.verifications.filter(v => v.status === 'DECLINED');
    
    expect(approvedVerifications).toHaveLength(2);
    expect(declinedVerifications).toHaveLength(1);
    
    const declinedVerification = declinedVerifications[0];
    expect(declinedVerification.verifier_role).toEqual('PIC_PROCUREMENT');
    expect(declinedVerification.notes).toEqual('Budget concerns identified');
    expect(declinedVerification.verified_at).toBeInstanceOf(Date);
  });

  it('should return agreement request with empty verifications array when no verifications exist', async () => {
    // Create minimal agreement request
    const agreementResults = await db.insert(agreementRequestsTable)
      .values({
        vendor_name: 'Simple Vendor',
        service_value: '1000.00',
        start_date: new Date('2024-06-01'),
        end_date: new Date('2024-08-01'),
        work_timeline_attachment: '/uploads/simple-timeline.pdf',
        submitted_by: 'PIC_PROCUREMENT'
      })
      .returning()
      .execute();

    const createdAgreement = agreementResults[0];
    const result = await getAgreementRequest(createdAgreement.id);

    expect(result).not.toBeNull();
    expect(result!.agreement.id).toEqual(createdAgreement.id);
    expect(result!.verifications).toEqual([]);
    expect(Array.isArray(result!.verifications)).toBe(true);
  });
});