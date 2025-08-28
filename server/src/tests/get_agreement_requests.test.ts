import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { agreementRequestsTable, verificationRecordsTable } from '../db/schema';
import { getAgreementRequests } from '../handlers/get_agreement_requests';
import { type CreateAgreementRequestInput, type UserRole, type VerificationStatus } from '../schema';

// Test data
const testAgreementInput = {
  vendor_name: 'Test Vendor Inc.',
  service_value: 50000.75,
  start_date: new Date('2024-01-01'),
  end_date: new Date('2024-12-31'),
  work_timeline_attachment: '/uploads/timeline.pdf',
  submitted_by: 'PIC_PROCUREMENT' as UserRole
};

const testAgreementInput2 = {
  vendor_name: 'Another Vendor LLC',
  service_value: 25000.50,
  start_date: new Date('2024-02-01'),
  end_date: new Date('2024-11-30'),
  work_timeline_attachment: '/uploads/timeline2.pdf',
  submitted_by: 'PIC_OFFICE_MANAGER' as UserRole
};

describe('getAgreementRequests', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no agreement requests exist', async () => {
    const result = await getAgreementRequests();

    expect(result).toEqual([]);
  });

  it('should return agreement request without verifications', async () => {
    // Create agreement request
    const insertedAgreement = await db.insert(agreementRequestsTable)
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

    const result = await getAgreementRequests();

    expect(result).toHaveLength(1);
    expect(result[0].agreement.id).toEqual(insertedAgreement[0].id);
    expect(result[0].agreement.vendor_name).toEqual('Test Vendor Inc.');
    expect(result[0].agreement.service_value).toEqual(50000.75);
    expect(typeof result[0].agreement.service_value).toEqual('number');
    expect(result[0].agreement.status).toEqual('SUBMITTED');
    expect(result[0].agreement.submitted_by).toEqual('PIC_PROCUREMENT');
    expect(result[0].agreement.created_at).toBeInstanceOf(Date);
    expect(result[0].verifications).toEqual([]);
  });

  it('should return agreement request with verification records', async () => {
    // Create agreement request
    const insertedAgreement = await db.insert(agreementRequestsTable)
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

    // Create verification records
    await db.insert(verificationRecordsTable)
      .values([
        {
          agreement_request_id: insertedAgreement[0].id,
          verifier_role: 'PIC_TAX',
          status: 'APPROVED',
          notes: 'Tax compliance verified',
          verified_at: new Date()
        },
        {
          agreement_request_id: insertedAgreement[0].id,
          verifier_role: 'PIC_OFFICE_MANAGER',
          status: 'PENDING',
          notes: null
        }
      ])
      .execute();

    const result = await getAgreementRequests();

    expect(result).toHaveLength(1);
    expect(result[0].agreement.id).toEqual(insertedAgreement[0].id);
    expect(result[0].agreement.vendor_name).toEqual('Test Vendor Inc.');
    expect(result[0].agreement.service_value).toEqual(50000.75);
    expect(result[0].agreement.status).toEqual('DRAFT_UPLOADED');
    expect(result[0].verifications).toHaveLength(2);
    
    // Check verification records
    const taxVerification = result[0].verifications.find(v => v.verifier_role === 'PIC_TAX');
    expect(taxVerification).toBeDefined();
    expect(taxVerification!.status).toEqual('APPROVED');
    expect(taxVerification!.notes).toEqual('Tax compliance verified');
    expect(taxVerification!.verified_at).toBeInstanceOf(Date);

    const managerVerification = result[0].verifications.find(v => v.verifier_role === 'PIC_OFFICE_MANAGER');
    expect(managerVerification).toBeDefined();
    expect(managerVerification!.status).toEqual('PENDING');
    expect(managerVerification!.notes).toBeNull();
    expect(managerVerification!.verified_at).toBeNull();
  });

  it('should return multiple agreement requests with different verification states', async () => {
    // Create first agreement request
    const agreement1 = await db.insert(agreementRequestsTable)
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

    // Create second agreement request
    const agreement2 = await db.insert(agreementRequestsTable)
      .values({
        vendor_name: testAgreementInput2.vendor_name,
        service_value: testAgreementInput2.service_value.toString(),
        start_date: testAgreementInput2.start_date,
        end_date: testAgreementInput2.end_date,
        work_timeline_attachment: testAgreementInput2.work_timeline_attachment,
        submitted_by: testAgreementInput2.submitted_by,
        status: 'FULLY_APPROVED'
      })
      .returning()
      .execute();

    // Add verification only to second agreement
    await db.insert(verificationRecordsTable)
      .values({
        agreement_request_id: agreement2[0].id,
        verifier_role: 'PIC_LEGAL',
        status: 'APPROVED',
        notes: 'Legal review completed',
        verified_at: new Date()
      })
      .execute();

    const result = await getAgreementRequests();

    expect(result).toHaveLength(2);

    // Find agreements by vendor name
    const vendorInc = result.find(r => r.agreement.vendor_name === 'Test Vendor Inc.');
    const vendorLLC = result.find(r => r.agreement.vendor_name === 'Another Vendor LLC');

    expect(vendorInc).toBeDefined();
    expect(vendorInc!.agreement.service_value).toEqual(50000.75);
    expect(vendorInc!.agreement.status).toEqual('SUBMITTED');
    expect(vendorInc!.verifications).toHaveLength(0);

    expect(vendorLLC).toBeDefined();
    expect(vendorLLC!.agreement.service_value).toEqual(25000.50);
    expect(vendorLLC!.agreement.status).toEqual('FULLY_APPROVED');
    expect(vendorLLC!.verifications).toHaveLength(1);
    expect(vendorLLC!.verifications[0].verifier_role).toEqual('PIC_LEGAL');
    expect(vendorLLC!.verifications[0].status).toEqual('APPROVED');
  });

  it('should handle agreement with multiple verification records for same role', async () => {
    // Create agreement request
    const insertedAgreement = await db.insert(agreementRequestsTable)
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

    // Create multiple verification records (e.g., initial decline, then approval)
    await db.insert(verificationRecordsTable)
      .values([
        {
          agreement_request_id: insertedAgreement[0].id,
          verifier_role: 'PIC_LEGAL',
          status: 'DECLINED',
          notes: 'Initial review - needs changes',
          verified_at: new Date('2024-01-15')
        },
        {
          agreement_request_id: insertedAgreement[0].id,
          verifier_role: 'PIC_LEGAL',
          status: 'APPROVED',
          notes: 'Revised version approved',
          verified_at: new Date('2024-01-20')
        }
      ])
      .execute();

    const result = await getAgreementRequests();

    expect(result).toHaveLength(1);
    expect(result[0].verifications).toHaveLength(2);
    
    // Both verification records should be present
    const legalVerifications = result[0].verifications.filter(v => v.verifier_role === 'PIC_LEGAL');
    expect(legalVerifications).toHaveLength(2);
    
    const declined = legalVerifications.find(v => v.status === 'DECLINED');
    const approved = legalVerifications.find(v => v.status === 'APPROVED');
    
    expect(declined).toBeDefined();
    expect(declined!.notes).toEqual('Initial review - needs changes');
    
    expect(approved).toBeDefined();
    expect(approved!.notes).toEqual('Revised version approved');
  });

  it('should maintain correct data types after database conversion', async () => {
    // Create agreement request
    await db.insert(agreementRequestsTable)
      .values({
        vendor_name: testAgreementInput.vendor_name,
        service_value: testAgreementInput.service_value.toString(),
        start_date: testAgreementInput.start_date,
        end_date: testAgreementInput.end_date,
        work_timeline_attachment: testAgreementInput.work_timeline_attachment,
        submitted_by: testAgreementInput.submitted_by
      })
      .execute();

    const result = await getAgreementRequests();

    expect(result).toHaveLength(1);
    
    // Verify numeric conversion
    expect(typeof result[0].agreement.service_value).toEqual('number');
    expect(result[0].agreement.service_value).toEqual(50000.75);
    
    // Verify date types
    expect(result[0].agreement.start_date).toBeInstanceOf(Date);
    expect(result[0].agreement.end_date).toBeInstanceOf(Date);
    expect(result[0].agreement.created_at).toBeInstanceOf(Date);
    expect(result[0].agreement.updated_at).toBeInstanceOf(Date);
    expect(result[0].agreement.submitted_at).toBeInstanceOf(Date);
    
    // Verify ID is number
    expect(typeof result[0].agreement.id).toEqual('number');
  });
});