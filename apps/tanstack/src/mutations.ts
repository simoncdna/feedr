import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toggleBookmark } from '@/server/mutations'

// Remplace les revalidatePath() de l'app Next : on invalide les clés que la
// bascule d'un bookmark rend périmées.
// NOTE : version non optimiste. La Task 15 du plan la remplace par une mise à
// jour optimiste du cache (le bookmark doit répondre instantanément au swipe).
export function useToggleBookmark() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: number; bookmarked: boolean }) => toggleBookmark({ data: v }),
    onSettled: (_data, _error, v) => {
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] })
      queryClient.invalidateQueries({ queryKey: ['article', v.id] })
    },
  })
}
