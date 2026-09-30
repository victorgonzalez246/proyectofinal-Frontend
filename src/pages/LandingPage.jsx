import Navbar from '../components/landing/Navbar.jsx'
import HeroSection from '../components/landing/HeroSection.jsx'
import PhilosophySection from '../components/landing/PhilosophySection.jsx'
import TreatmentsSection from '../components/landing/TreatmentsSection.jsx'
import ClimaSection from '../components/landing/ClimaSection.jsx'
import CasesSection from '../components/landing/CasesSection.jsx'
import DoctorSection from '../components/landing/DoctorSection.jsx'
import AppointmentSection from '../components/landing/AppointmentSection.jsx'
import Footer from '../components/landing/Footer.jsx'
import AsistenteVirtual from '../components/asistente/AsistenteVirtual.jsx'
import AccesibilidadLanding from '../components/ui/AccesibilidadLanding.jsx'

export default function LandingPage() {
  return (
    <AccesibilidadLanding>
      <a href="#contenido" className="skip-link">Saltar al contenido</a>
      <Navbar />
      <main id="contenido" tabIndex={-1}>
        <HeroSection />
        <PhilosophySection />
        <TreatmentsSection />
        <ClimaSection />
        <CasesSection />
        <DoctorSection />
        <AppointmentSection />
      </main>
      <Footer />
      <AsistenteVirtual variante="landing" />
    </AccesibilidadLanding>
  )
}
