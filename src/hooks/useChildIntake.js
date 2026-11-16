import { useEffect, useState } from 'react'
import { getIntakeForm } from '../firebase/firestore'

export function useChildIntake(childId, enabled = true) {
  const [state, setState] = useState({ childId: null, intake: null, error: false })

  useEffect(() => {
    if (!childId || !enabled) return
    let cancelled = false
    getIntakeForm(childId)
      .then((intake) => {
        if (!cancelled) setState({ childId, intake, error: false })
      })
      .catch((err) => {
        console.error('Could not check the intake form:', err)
        if (!cancelled) setState({ childId, intake: null, error: true })
      })
    return () => {
      cancelled = true
    }
  }, [childId, enabled])

  const ready = state.childId === childId
  return {
    intake: ready ? state.intake : null,
    loading: enabled && !!childId && !ready,
    error: ready && state.error,
  }
}