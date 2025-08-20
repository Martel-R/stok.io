
// src/lib/logging.ts
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { User } from './types';

interface LogDetails {
  [key: string]: any;
}

interface LogEntry {
  userId: string;
  userName: string;
  organizationId: string;
  branchId?: string;
  action: string; // e.g., 'product_created', 'login_success'
  details?: LogDetails;
  timestamp: any;
}

/**
 * Logs a user activity to the 'logs' collection in Firestore.
 * @param logData - The data for the log entry, excluding the timestamp.
 */
export const logUserActivity = async (logData: Omit<LogEntry, 'timestamp'>) => {
  if (!logData.userId || !logData.organizationId) {
    console.warn("Log attempt with missing userId or organizationId", logData);
    return;
  }
  try {
    const logWithTimestamp: LogEntry = {
      ...logData,
      timestamp: serverTimestamp(),
    };
    await addDoc(collection(db, 'logs'), logWithTimestamp);
  } catch (error) {
    console.error("Error logging user activity:", error);
    // In a real-world scenario, you might want to send this error to a monitoring service.
  }
};
