export interface NotesAssessment {
  total: number;
  privateCount: number;
  largeCount: number;
  parentBreakdown: Record<string, number>;
}

export interface AttachmentsAssessment {
  total: number;
  totalBytes: number;
  largeCount: number;
  parentBreakdown: Record<string, number>;
}

export interface FilesAssessment {
  total: number;
  totalBytes: number;
}

export interface LimitsAssessment {
  dataStorageUsedMB: number;
  dataStorageMaxMB: number;
  fileStorageUsedMB: number;
  fileStorageMaxMB: number;
  apiRequestsUsed: number;
  apiRequestsMax: number;
  apiRequestsRemaining: number;
}

export interface PermissionEntry {
  name: string;
  type: string;
  sObjectType: string;
}

export interface CreationControlsAssessment {
  noteCreateable: boolean;
  attachCreateable: boolean;
  permissions: PermissionEntry[];
}

export interface AssessmentResult {
  notes: NotesAssessment | null;
  attachments: AttachmentsAssessment | null;
  files: FilesAssessment | null;
  limits: LimitsAssessment | null;
  creationControls: CreationControlsAssessment | null;
}

export interface AuthStatus {
  authenticated: boolean;
  instanceUrl: string | null;
  orgId: string | null;
  orgName: string | null;
  orgType: string | null;
  isSandbox: boolean;
  instanceName: string | null;
}

// Known Salesforce object key prefixes
export const OBJECT_PREFIX_MAP: Record<string, string> = {
  '001': 'Account',
  '003': 'Contact',
  '500': 'Case',
  '006': 'Opportunity',
  '00Q': 'Lead',
  '00T': 'Task',
  '00U': 'Event',
  '701': 'Campaign',
  '00a': 'Contract',
  '0YL': 'Asset',
};
