import { useSwipeable } from 'react-swipeable'
import { BackButton, useGoBack } from './BackButton'

// Le geste ne part QUE du bord gauche, comme sur iOS. C'est ce qui le rend
// inoffensif : un glissement commencé au milieu du texte reste une sélection,
// et un tableau large reste défilable horizontalement dans l'article.
const BORD_PX = 32
// En deçà, le geste est trop proche d'un appui qui a glissé pour valoir un
// retour — quitter un article par erreur est plus coûteux que devoir recommencer.
const SEUIL_PX = 64

/**
 * Le volet de détail d'un article, avec ses deux sorties.
 *
 * En PWA `display: standalone`, iOS ne fournit AUCUN geste de retour par le bord
 * (la barre d'adresse et sa flèche n'existent pas), et l'app n'en proposait pas
 * non plus : la seule issue était un texte de 11 px en haut à gauche. Ce geste
 * rétablit le chemin attendu, et il repasse par le même `useGoBack` que le
 * bouton — donc par l'historique, donc avec la position de lecture restaurée et
 * la transition `nav-back` en miroir de l'ouverture.
 *
 * Pas de `touch-action` ici, volontairement : sans `preventScrollOnSwipe`, le
 * navigateur garde la main sur le défilement et react-swipeable se contente
 * d'observer. Rien n'est retiré au lecteur.
 */
export function DetailPane({
  fallback,
  showBack,
  label = 'Back',
  children,
}: {
  fallback: () => void
  showBack: boolean
  label?: string
  children: React.ReactNode
}) {
  const goBack = useGoBack(fallback)
  const handlers = useSwipeable({
    onSwipedRight: (e) => {
      if (!showBack) return
      if (e.initial[0] > BORD_PX) return
      if (e.absX < SEUIL_PX) return
      goBack()
    },
    delta: 12,
    preventScrollOnSwipe: false,
    trackTouch: true,
    trackMouse: false,
  })

  return (
    <div {...handlers}>
      {showBack && (
        <div className="px-4 pt-2 lg:hidden">
          <BackButton onBack={goBack}>{label}</BackButton>
        </div>
      )}
      {children}
    </div>
  )
}
