import { ChecklistState, INITIAL_CHECKLIST_STATE } from '@/types/onboarding'

const STORAGE_KEY = 'ssia.activationChecklist.v1'

export function loadChecklistState(): ChecklistState {
  if (typeof window === 'undefined') {
    return INITIAL_CHECKLIST_STATE
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return INITIAL_CHECKLIST_STATE
    }

    const parsed = JSON.parse(stored) as ChecklistState
    
    if (parsed.version !== 1) {
      console.warn('[Storage] Invalid checklist version, resetting to initial state')
      return INITIAL_CHECKLIST_STATE
    }

    return parsed
  } catch (error) {
    console.error('[Storage] Failed to load checklist state:', error)
    return INITIAL_CHECKLIST_STATE
  }
}

export function saveChecklistState(state: ChecklistState): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const stateWithTimestamp = {
      ...state,
      updatedAt: new Date().toISOString(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateWithTimestamp))
  } catch (error) {
    console.error('[Storage] Failed to save checklist state:', error)
  }
}

export function resetChecklistState(): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.removeItem(STORAGE_KEY)
    console.info('[Storage] Checklist state reset')
  } catch (error) {
    console.error('[Storage] Failed to reset checklist state:', error)
  }
}
