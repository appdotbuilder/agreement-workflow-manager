import { db } from '../db';
import { agreementRequestsTable } from '../db/schema';
import { type CreateAgreementRequestInput, type AgreementRequest } from '../schema';

export const createAgreementRequest = async (input: CreateAgreementRequestInput): Promise<AgreementRequest> => {
  try {
    // Insert agreement request record
    const result = await db.insert(agreementRequestsTable)
      .values({
        vendor_name: input.vendor_name,
        service_value: input.service_value.toString(), // Convert number to string for numeric column
        start_date: input.start_date,
        end_date: input.end_date,
        work_timeline_attachment: input.work_timeline_attachment,
        status: 'SUBMITTED',
        submitted_by: input.submitted_by
        // submitted_at, created_at, and updated_at will be set by database defaults
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const agreementRequest = result[0];
    return {
      ...agreementRequest,
      service_value: parseFloat(agreementRequest.service_value) // Convert string back to number
    };
  } catch (error) {
    console.error('Agreement request creation failed:', error);
    throw error;
  }
};