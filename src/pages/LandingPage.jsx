import Navbar from '../components/landing/Navbar.jsx'
import HeroSection from '../components/landing/HeroSection.jsx'
import PhilosophySection from '../components/landing/PhilosophySection.jsx'
import TreatmentsSection from '../components/landing/TreatmentsSection.jsx'
import CasesSection from '../components/landing/CasesSection.jsx'
import DoctorSection from '../components/landing/DoctorSection.jsx'
import AppointmentSection from '../components/landing/AppointmentSection.jsx'
import Footer from '../components/landing/Footer.jsx'

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <PhilosophySection />
        <TreatmentsSection />
        <CasesSection />
        <DoctorSection />
        <AppointmentSection />
      </main>
      <Footer />
    </>
  )
}
