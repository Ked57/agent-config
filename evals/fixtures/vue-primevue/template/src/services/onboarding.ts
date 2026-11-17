// Onboarding data source: fixed seed data for the workspace setup wizard, shaped like an API response.
// The account step is already done when the wizard opens; `submitWorkspace` and `sendInvites` resolve
// without persisting anything.

export interface WizardStep {
  id: 'account' | 'workspace' | 'team' | 'billing'
  label: string
}

export interface UseCase {
  id: 'clients' | 'operations' | 'product' | 'other'
  label: string
  description: string
}

export type InviteRole = 'Admin' | 'Member' | 'Viewer'

export interface Onboarding {
  steps: WizardStep[]
  /** Index of the first step that is not done yet. */
  currentStep: number
  workspaceName: string
  useCases: UseCase[]
  teamSizes: string[]
  inviteRoles: InviteRole[]
  trialDays: number
}

const steps: WizardStep[] = [
  { id: 'account', label: 'Account' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'team', label: 'Team' },
  { id: 'billing', label: 'Billing' },
]

const useCases: UseCase[] = [
  { id: 'clients', label: 'Client projects', description: 'Track work, hours and invoices for the clients you serve.' },
  { id: 'operations', label: 'Internal operations', description: 'Run recurring processes like hiring, IT requests and purchasing.' },
  { id: 'product', label: 'Product development', description: 'Plan releases, triage bugs and keep a roadmap in one place.' },
  { id: 'other', label: 'Something else', description: 'Start from a blank workspace and set it up your own way.' },
]

export async function fetchOnboarding(): Promise<Onboarding> {
  return {
    steps: steps.map((step) => ({ ...step })),
    currentStep: 1,
    workspaceName: 'Acme Inc.',
    useCases: useCases.map((useCase) => ({ ...useCase })),
    teamSizes: ['Just me', '2–10', '11–50', '51+'],
    inviteRoles: ['Admin', 'Member', 'Viewer'],
    trialDays: 14,
  }
}

export async function submitWorkspace(workspace: { name: string; useCase: UseCase['id']; teamSize: string }): Promise<void> {
  void workspace
}

export async function sendInvites(invites: { email: string; role: InviteRole }[]): Promise<void> {
  void invites
}
