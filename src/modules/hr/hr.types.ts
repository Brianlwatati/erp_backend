export type Employee = {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email?: string | undefined;
  phone?: string | undefined;
  departmentId?: number | undefined;
  jobTitleId?: number | undefined;
  hireDate?: string | undefined;
  salary?: number | undefined;
};
