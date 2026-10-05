import { Suspense, lazy } from 'react'

// Los avisos (sonner) no hacen falta para pintar la landing: se cargan aparte
const Toaster = lazy(() => import('sonner').then((m) => ({ default: m.Toaster })))

export default function Avisos() {
  return (
    <Suspense fallback={null}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            fontFamily: "'Montserrat', sans-serif",
            borderRadius: '12px',
          },
        }}
        richColors
        closeButton
      />
    </Suspense>
  )
}
