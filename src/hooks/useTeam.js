import { useContext } from 'react'
import { TeamContext } from '../context/TeamContext'

export default function useTeam() {
  const teamContext = useContext(TeamContext)
  if (!teamContext) throw new Error('useTeam must be used inside TeamProvider')
  return teamContext
}
