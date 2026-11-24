// Student anonymization utilities for tutor interface
// This ensures tutors never see real student names or universities

export function generateStudentAlias(studentId?: string | null): string {
  if (!studentId) return "Cliente";
  // Generate a consistent alias based on student ID
  const hash = studentId.replace(/-/g, '').substring(0, 8);
  const numericHash = parseInt(hash, 16) % 100000;
  return `Cliente ${numericHash.toString().padStart(5, "0")}`;
}

export function anonymizeStudentData(originalData: any, currentUserType: string): any {
  // Only anonymize if current user is a tutor
  if (currentUserType !== 'tutor' || !originalData) {
    return originalData || { name: "Cliente" };
  }

  // Anonymize student information
  return {
    ...originalData,
    studentName: generateStudentAlias(originalData.studentId || originalData.userId || originalData.id),
    university: "Universidad Privada", // Generic university name
    name: originalData.name ? generateStudentAlias(originalData.studentId || originalData.userId || originalData.id) : "Cliente",
  };
}

export function getGenericUniversity(): string {
  return "Universidad Privada";
}