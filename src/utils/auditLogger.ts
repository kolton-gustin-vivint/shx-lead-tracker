import { logAuditEvent as logAuditEventEndpoint } from '@/lib/api';

interface AuditLogEntry {
  userEmail: string;
  userName: string;
  action: 'View Lead' | 'Update Lead' | 'Create Activity' | 'Delete Compensation' | 'Reset Lead';
  leadId?: string;
  details?: string;
}

export const logAuditEvent = async (entry: AuditLogEntry): Promise<void> => {
  // Validate required fields before attempting to log
  if (!entry.userEmail || !entry.userName || !entry.action) {
    console.warn('Audit logging skipped due to missing required fields:', {
      hasEmail: !!entry.userEmail,
      hasUserName: !!entry.userName,
      hasAction: !!entry.action,
      entry
    });
    return;
  }

  try {
    await logAuditEventEndpoint({
      userEmail: entry.userEmail,
      userName: entry.userName,
      action: entry.action,
      leadId: entry.leadId,
      details: entry.details
    });
    
    console.log('Audit event logged successfully:', {
      action: entry.action,
      userEmail: entry.userEmail,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    // Enhanced error logging with more context
    const errorDetails = {
      error: error instanceof Error ? error.message : String(error),
      entry: entry,
      timestamp: new Date().toISOString(),
      errorType: error instanceof Error ? error.constructor.name : 'Unknown'
    };
    
    // Check for specific error types to provide better debugging info
    if (error instanceof Error) {
      if (error.message.includes('invalid json response body')) {
        console.error('Audit logging failed - JSON parsing error (likely server-side issue):', errorDetails);
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        console.error('Audit logging failed - Network error:', errorDetails);
      } else if (error.message.includes('unauthorized') || error.message.includes('403')) {
        console.error('Audit logging failed - Authorization error:', errorDetails);
      } else {
        console.error('Audit logging failed - General error:', errorDetails);
      }
    } else {
      console.error('Audit logging failed - Unknown error type:', errorDetails);
    }
    
    // Don't throw the error to prevent it from breaking the main functionality
    // Audit logging should be non-blocking and fail silently
  }
};

export default logAuditEvent;
