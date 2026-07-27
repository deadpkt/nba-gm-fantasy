import { createContext, useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import useAuth from '../hooks/useAuth'
import { db } from '../lib/firebase'

export const TeamContext = createContext(null)

export function TeamProvider({ children }) {
  const { user, firebaseEnabled } = useAuth()
  const [team, setTeam] = useState([])
  const [record, setRecord] = useState({ wins: 0, losses: 0 })
  const [profileLoading, setProfileLoading] = useState(false)
  const [loadedUserId, setLoadedUserId] = useState(null)

  useEffect(() => {
    if (!user || !firebaseEnabled) { setTeam([]); setRecord({ wins: 0, losses: 0 }); setLoadedUserId(null); return undefined }
    setProfileLoading(true)
    setLoadedUserId(null)
    return onSnapshot(doc(db, 'users', user.uid), async (snapshot) => {
      if (snapshot.exists()) { const data = snapshot.data(); setTeam(data.team || []); setRecord(data.record || { wins: 0, losses: 0 }) }
      else await setDoc(doc(db, 'users', user.uid), { displayName: user.displayName || '', email: user.email, team: [], record: { wins: 0, losses: 0 }, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
      setLoadedUserId(user.uid)
      setProfileLoading(false)
    }, (error) => {
      console.error('Could not load team profile:', error)
      setLoadedUserId(user.uid)
      setProfileLoading(false)
    })
  }, [user, firebaseEnabled])

  useEffect(() => {
    if (!user || profileLoading || loadedUserId !== user.uid || !firebaseEnabled) return
    setDoc(doc(db, 'users', user.uid), { team, record, updatedAt: serverTimestamp() }, { merge: true })
  }, [team, record, user, profileLoading, loadedUserId, firebaseEnabled])

  const value = useMemo(() => ({
    team,
    record,
    profileLoading,
    addPlayer: (player) => setTeam((current) => current.length >= 5 || current.some((item) => item.id === player.id) ? current : [...current, player]),
    removePlayer: (id) => setTeam((current) => current.filter((player) => player.id !== id)),
    saveResult: (won) => setRecord((current) => won ? { ...current, wins: current.wins + 1 } : { ...current, losses: current.losses + 1 }),
  }), [team, record, profileLoading])

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>
}
