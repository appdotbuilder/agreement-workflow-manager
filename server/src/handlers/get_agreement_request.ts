import { db } from '../db';
import { agreementRequestsTable, verificationRecordsTable } from '../db/schema';
import { type AgreementWithVerifications } from '../schema';
import { eq } from 'drizzle-orm';

export const getAgreementRequest = async (id: number): Promise<AgreementWithVerifications | null> => {
  try {
    // First, get the agreement request
    const agreementResults = await db.select()
      .from(agreementRequestsTable)
      .where(eq(agreementRequestsTable.id, id))
      .execute();

    if (agreementResults.length === 0) {
      return null;
    }

    const agreementRecord = agreementResults[0];

    // Convert numeric fields back to numbers
    const agreement = {
      ...agreementRecord,
      service_value: parseFloat(agreementRecord.service_value)
    };

    // Get all verification records for this agreement request
    const verificationResults = await db.select()
      .from(verificationRecordsTable)
      .where(eq(verificationRecordsTable.agreement_request_id, id))
      .execute();

    // No numeric conversions needed for verification records
    const verifications = verificationResults;

    return {
      agreement,
      verifications
    };
  } catch (error) {
    console.error('Agreement request fetch failed:', error);
    throw error;
  }
};