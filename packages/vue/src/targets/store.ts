import { defineStore } from 'pinia'

export interface TypedTarget {
  target_resource_key: string
  target_role: string
  target_id: string
}

export interface TypedTargetSet {
  target_resource_key: string
  target_role: string
  target_ids: readonly string[]
}

export interface TargetCandidate extends TypedTarget {
  label: string
  owner_label?: string
  status?: string
}

export interface OperationTargetScope {
  moduleKey: string
  resourceKey: string
  operation: string
  targetResourceKey: string
  targetRole: string
  cardinality?: TargetCardinality
}

export type TargetCardinality = 'none' | 'one_required' | 'zero_or_one' | 'many_readable' | 'aggregate_read' | 'policy_publish' | 'bulk_write'

interface TargetEntry {
  scope: OperationTargetScope
  candidates: TargetCandidate[]
  selectedIds: string[]
}

interface TargetStoreState {
  entries: Record<string, TargetEntry>
  generation: number
}

const scopeKey = (scope: OperationTargetScope): string => JSON.stringify([
  scope.moduleKey,
  scope.resourceKey,
  scope.operation,
  scope.targetResourceKey,
  scope.targetRole,
  scope.cardinality ?? 'many_readable',
])

const normalizeCandidates = (
  scope: OperationTargetScope,
  candidates: readonly TargetCandidate[],
): TargetCandidate[] => {
  const ids = new Set<string>()
  return candidates.map(candidate => {
    if (candidate.target_resource_key !== scope.targetResourceKey
      || candidate.target_role !== scope.targetRole
      || candidate.target_id === ''
      || ids.has(candidate.target_id)) {
      throw new Error('TARGET_CANDIDATE_SCOPE_INVALID')
    }
    ids.add(candidate.target_id)
    return { ...candidate }
  })
}

export const useOperationTargets = defineStore('peanut-admin-operation-targets', {
  state: (): TargetStoreState => ({ entries: {}, generation: 0 }),
  actions: {
    replace(scope: OperationTargetScope, candidates: readonly TargetCandidate[]): void {
      const key = scopeKey(scope)
      const normalized = normalizeCandidates(scope, candidates)
      const available = new Set(normalized.map(candidate => candidate.target_id))
      const previous = this.entries[key]?.selectedIds ?? []
      const retained = previous.filter(id => available.has(id))
      this.entries[key] = {
        scope: { ...scope },
        candidates: normalized,
        selectedIds: normalized.length === 1 ? [normalized[0]!.target_id] : retained,
      }
      this.generation += 1
    },
    select(scope: OperationTargetScope, targets: readonly TypedTarget[]): void {
      const key = scopeKey(scope)
      const entry = this.entries[key]
      if (entry === undefined) {
        throw new Error('TARGET_SCOPE_NOT_LOADED')
      }
      const available = new Set(entry.candidates.map(candidate => candidate.target_id))
      const selected = new Set<string>()
      for (const target of targets) {
        if (target.target_resource_key !== scope.targetResourceKey
          || target.target_role !== scope.targetRole
          || !available.has(target.target_id)) {
          throw new Error('TARGET_SELECTION_INVALID')
        }
        selected.add(target.target_id)
      }
      const cardinality = scope.cardinality ?? 'many_readable'
      if ((cardinality === 'none' && selected.size > 0)
        || (cardinality === 'one_required' && selected.size !== 1)
        || (cardinality === 'zero_or_one' && selected.size > 1)
        || cardinality === 'bulk_write') {
        throw new Error('TARGET_SELECTION_CARDINALITY_INVALID')
      }
      entry.selectedIds = [...selected]
      this.generation += 1
    },
    selected(scope: OperationTargetScope): TypedTarget[] {
      const entry = this.entries[scopeKey(scope)]
      return (entry?.selectedIds ?? []).map(targetId => ({
        target_resource_key: scope.targetResourceKey,
        target_role: scope.targetRole,
        target_id: targetId,
      }))
    },
    selectedSet(scope: OperationTargetScope): TypedTargetSet {
      return {
        target_resource_key: scope.targetResourceKey,
        target_role: scope.targetRole,
        target_ids: this.selected(scope).map(target => target.target_id),
      }
    },
    selectionForRequest(scope: OperationTargetScope): TypedTargetSet {
      const selection = this.selectedSet(scope)
      const cardinality = scope.cardinality ?? 'many_readable'
      if ((cardinality === 'one_required' && selection.target_ids.length !== 1)
        || (cardinality === 'zero_or_one' && selection.target_ids.length > 1)
        || (cardinality === 'none' && selection.target_ids.length !== 0)
        || cardinality === 'bulk_write') {
        throw new Error('TARGET_SELECTION_CARDINALITY_INVALID')
      }

      return selection
    },
    clearScope(scope: OperationTargetScope): void {
      delete this.entries[scopeKey(scope)]
      this.generation += 1
    },
    clearModule(moduleKey: string): void {
      this.entries = Object.fromEntries(
        Object.entries(this.entries).filter(([, entry]) => entry.scope.moduleKey !== moduleKey),
      )
      this.generation += 1
    },
    clearAll(): void {
      this.entries = {}
      this.generation += 1
    },
  },
})
