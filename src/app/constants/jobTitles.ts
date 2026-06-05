export const EMPLOYEE_JOB_TITLES = [
  "CEO",
  "GM",
  "Department manager",
  "Manager",
  "Supervisor",
  "Coordinator",
] as const;

export type EmployeeJobTitle = (typeof EMPLOYEE_JOB_TITLES)[number];

export const resolveEmployeeJobTitleOptions = (currentJobTitle: string | null | undefined): string[] => {
  const normalizedCurrent = currentJobTitle?.trim() ?? "";

  if (!normalizedCurrent) {
    return [...EMPLOYEE_JOB_TITLES];
  }

  if (EMPLOYEE_JOB_TITLES.includes(normalizedCurrent as EmployeeJobTitle)) {
    return [...EMPLOYEE_JOB_TITLES];
  }

  return [...EMPLOYEE_JOB_TITLES, normalizedCurrent];
};
