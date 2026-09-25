const fs = require('fs');

const code = `import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

export default function MemberPortalPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sliderVal, setSliderVal] = useState(50);
  const [activeView, setActiveView] = useState('frontal');
  const [activeTab, setActiveTab] = useState('mi-pasaporte-facial');

  const navItems = [
    { id: 'mi-pasaporte-facial', label: 'Mi Pasaporte Facial', icon: 'health_and_beauty' },
    { id: 'proximas-citas', label: 'Próximas Citas', icon: 'calendar_month' },
    { id: 'evolucion-y-fotos', label: 'Evolución & Fotos', icon: 'photo_library' },
    { id: 'plan-dermocosmetico', label: 'Plan Dermocosmético', icon: 'prescriptions' },
  ];

  return (
    <div className="min-h-screen bg-background flex w-full font-sans text-on-surface">
      {/* SIDEBAR NAVIGATION */}
      <aside className="hidden lg:flex flex-col w-72 fixed top-0 left-0 bottom-0 bg-surface-container-lowest border-r border-outline-variant/30 z-40">
        <div className="p-8 flex flex-col items-center border-b border-outline-variant/20">
          <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center border border-outline-variant/40 text-primary font-headline-md mb-4 shadow-sm">L</div>
          <h2 className="font-headline-sm text-center text-on-surface tracking-tight">Dra. Lau Jiménez</h2>
          <span className="font-label-sm uppercase tracking-widest text-primary text-[10px] mt-1 text-center">Medicina Estética de Precisión</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-8 px-4 space-y-2">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={\`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all \${activeTab === item.id ? 'bg-primary/5 text-primary font-semibold shadow-[0_2px_10px_rgba(179,142,93,0.05)]' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'}\`}
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span className="font-label-md tracking-wider uppercase text-[11px]">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-outline-variant/20">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low cursor-pointer hover:bg-surface-container transition-colors">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="font-body-sm font-semibold truncate text-on-surface">{user?.name || 'Elena Morales'}</span>
              <span className="font-label-sm uppercase tracking-widest text-primary text-[9px]">VIP Diamond</span>
            </div>
          </div>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-surface-container-lowest border-b border-outline-variant/30 flex items-center justify-between px-4 z-50 shadow-sm">
        <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center border border-outline-variant/40 text-primary font-headline-sm">L</div>
        <span className="font-headline-sm text-on-surface">Dra. Lau Jiménez</span>
        <button className="text-on-surface-variant"><span className="material-symbols-outlined">menu</span></button>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 lg:ml-72 pt-16 lg:pt-0 pb-20 lg:pb-12 min-h-screen">
        
        {/* TOP UTILITY BAR (Desktop) */}
        <div className="hidden lg:flex items-center justify-end px-10 h-20 border-b border-outline-variant/20 bg-surface/50 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <a href="https://wa.me/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container-lowest text-primary border border-outline-variant/40 hover:bg-primary hover:text-on-primary hover:border-primary transition-all shadow-sm">
              <span className="material-symbols-outlined text-[18px]">support_agent</span>
              <span className="font-label-sm uppercase tracking-wider font-semibold">WhatsApp Concierge</span>
            </a>
            <button className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container-lowest border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors shadow-sm relative">
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-error ring-2 ring-surface-container-lowest"></span>
            </button>
          </div>
        </div>

        <div className="max-w-[1100px] mx-auto p-6 lg:p-10 space-y-12">
          
          {/* WELCOME / DASHBOARD SUMMARY */}
          <section className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-3 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary font-label-sm uppercase tracking-widest text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                  Expediente #LJ-8842
                </div>
                <h1 className="font-headline-xl text-[40px] leading-[1.1] text-on-surface tracking-tight">
                  Bienvenida, <span className="italic font-normal text-primary">{user?.name?.split(' ')[0] || 'Elena'}</span>
                </h1>
                <p className="font-body-md text-on-surface-variant leading-relaxed">
                  Tu plan de preservación facial está activo. Todos los registros fotográficos multiespectrales y certificados de trazabilidad se conservan bajo cifrado clínico.
                </p>
              </div>
              <div className="flex gap-3">
                 <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-on-surface hover:bg-surface-container transition-colors shadow-sm font-label-sm uppercase tracking-wider font-semibold">
                  <span className="material-symbols-outlined text-[18px] text-primary">download</span>
                  <span>Certificados</span>
                </button>
              </div>
            </div>

            {/* METRICS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 shadow-sm flex flex-col gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined">timelapse</span>
                </div>
                <div>
                  <span className="font-label-sm uppercase tracking-widest text-on-surface-variant block mb-1">Próximo Retoque</span>
                  <div className="font-title-md font-semibold text-on-surface">Armonización Media</div>
                  <span className="font-body-sm text-primary">Ventana de 45 días</span>
                </div>
              </div>
              <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 shadow-sm flex flex-col gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined">verified</span>
                </div>
                <div>
                  <span className="font-label-sm uppercase tracking-widest text-on-surface-variant block mb-1">Salud Cutánea</span>
                  <div className="font-title-md font-semibold text-on-surface">98% Adherencia</div>
                  <span className="font-body-sm text-on-surface-variant">Rutina AM/PM activa</span>
                </div>
              </div>
              <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 shadow-sm flex flex-col gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined">medical_services</span>
                </div>
                <div>
                  <span className="font-label-sm uppercase tracking-widest text-on-surface-variant block mb-1">Especialista</span>
                  <div className="font-title-md font-semibold text-on-surface">Dra. Lau Jiménez</div>
                  <span className="font-body-sm text-on-surface-variant">Master Inyectables</span>
                </div>
              </div>
            </div>
          </section>

          {/* NEXT APPOINTMENT & PROTOCOL */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/20 shadow-sm flex flex-col justify-between">
              <div className="space-y-6">
                <div>
                  <span className="inline-block px-3 py-1 rounded-md bg-surface-container-low text-primary font-label-sm uppercase tracking-widest font-semibold mb-4">Cita Confirmada</span>
                  <h2 className="font-headline-lg text-on-surface leading-tight">Sesión de Bioestimulación y Perfilado</h2>
                  <p className="font-body-md text-on-surface-variant mt-3 leading-relaxed">Enfoque en bioinducción de colágeno Tipo I y III mediante cánula atraumática 25G, complementado con definición hidratante en bermellón.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-surface-container-low/50 border border-outline-variant/10">
                    <span className="material-symbols-outlined text-primary mb-2">event</span>
                    <span className="font-label-sm uppercase tracking-widest text-on-surface-variant block">Fecha</span>
                    <span className="font-title-md text-on-surface block mt-1">24 Oct, 10:30 AM</span>
                  </div>
                  <div className="p-4 rounded-xl bg-surface-container-low/50 border border-outline-variant/10">
                    <span className="material-symbols-outlined text-primary mb-2">pin_drop</span>
                    <span className="font-label-sm uppercase tracking-widest text-on-surface-variant block">Lugar</span>
                    <span className="font-title-md text-on-surface block mt-1">Suite 402, Pinares</span>
                  </div>
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-outline-variant/20 flex gap-3">
                <a href="https://waze.com/ul" target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-on-surface text-surface font-label-sm uppercase tracking-wider hover:bg-on-surface/90 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">navigation</span>
                  <span>Waze</span>
                </a>
                <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-container-low text-on-surface font-label-sm uppercase tracking-wider hover:bg-surface-container transition-colors">
                  <span className="material-symbols-outlined text-[18px]">edit_calendar</span>
                  <span>Reprogramar</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-5 bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/20 shadow-sm flex flex-col">
              <span className="font-label-sm uppercase tracking-widest text-primary font-semibold mb-6">Protocolo de Preparación</span>
              <div className="space-y-4 flex-1">
                <div className="flex items-start gap-4 p-4 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0]">
                  <span className="material-symbols-outlined text-[#166534] shrink-0 mt-0.5">check_circle</span>
                  <div>
                    <p className="font-body-sm text-[#166534] font-medium leading-snug">Evitar AINES, aspirina y suplementos 48h antes</p>
                    <span className="font-label-sm uppercase text-[#166534]/70 mt-1 block">Completado</span>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 rounded-xl bg-[#FEF9C3] border border-[#FEF08A]">
                  <span className="material-symbols-outlined text-[#854D0E] shrink-0 mt-0.5">hourglass_top</span>
                  <div>
                    <p className="font-body-sm text-[#854D0E] font-medium leading-snug">Consumo de 2L agua/día para turgencia tisular</p>
                    <span className="font-label-sm uppercase text-[#854D0E]/70 mt-1 block">En Curso</span>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 rounded-xl bg-surface-container-low border border-outline-variant/20">
                  <span className="material-symbols-outlined text-on-surface-variant shrink-0 mt-0.5">radio_button_unchecked</span>
                  <div>
                    <p className="font-body-sm text-on-surface font-medium leading-snug">Suspender retinol y ácidos directos 72h previas</p>
                    <span className="font-label-sm uppercase text-on-surface-variant mt-1 block">Pendiente</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* FACIAL PASSPORT / CLINICAL HISTORY */}
          <section className="space-y-6 pt-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-end pb-4 border-b border-outline-variant/30 gap-4">
              <div>
                <h2 className="font-headline-lg text-on-surface">Mi Pasaporte Facial</h2>
                <span className="font-label-sm uppercase tracking-widest text-on-surface-variant mt-1 block">Trazabilidad de Tratamientos e Inyectables</span>
              </div>
              <div className="flex items-center gap-2 text-primary bg-primary/10 px-4 py-2 rounded-full">
                <span className="material-symbols-outlined text-[16px]">security</span>
                <span className="font-label-sm uppercase tracking-wider">Lotes Verificados</span>
              </div>
            </div>

            <div className="space-y-4">
              {/* Record 1 */}
              <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/20 shadow-sm flex flex-col md:flex-row md:items-center gap-6">
                 <div className="flex items-center justify-center w-14 h-14 rounded-full bg-surface-container-low text-primary font-headline-md shrink-0">01</div>
                 <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    <div className="md:col-span-5">
                      <span className="font-label-sm uppercase tracking-widest text-on-surface-variant">15 Mayo 2025</span>
                      <h3 className="font-title-lg text-on-surface mt-1 mb-2">Armonización Full Face</h3>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded bg-[#F0FDF4] text-[#166534] font-label-sm uppercase tracking-wider text-[9px] border border-[#BBF7D0]">15 Días: Conforme</span>
                        <span className="px-2 py-1 rounded bg-surface-container-low text-on-surface-variant font-label-sm uppercase tracking-wider text-[9px]">Lote #AB89341</span>
                      </div>
                    </div>
                    <div className="md:col-span-7 bg-surface-container-low/50 p-4 rounded-xl border border-outline-variant/10">
                      <span className="font-label-sm uppercase tracking-widest text-primary block mb-1">Nota Clínica</span>
                      <p className="font-body-sm text-on-surface-variant leading-relaxed">Excelente bio-integración dérmica con Juvéderm Voluma 2.0ml + Volbella 1.0ml. Restauración del volumen en pómulo sin ensanchamiento lateral.</p>
                    </div>
                 </div>
              </div>
              {/* Record 2 */}
              <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/20 shadow-sm flex flex-col md:flex-row md:items-center gap-6">
                 <div className="flex items-center justify-center w-14 h-14 rounded-full bg-surface-container-low text-primary font-headline-md shrink-0">02</div>
                 <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    <div className="md:col-span-5">
                      <span className="font-label-sm uppercase tracking-widest text-on-surface-variant">10 Enero 2025</span>
                      <h3 className="font-title-lg text-on-surface mt-1 mb-2">Botox Preventivo</h3>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded bg-[#F0FDF4] text-[#166534] font-label-sm uppercase tracking-wider text-[9px] border border-[#BBF7D0]">Evolución Positiva</span>
                        <span className="px-2 py-1 rounded bg-surface-container-low text-on-surface-variant font-label-sm uppercase tracking-wider text-[9px]">Lote #BX5542</span>
                      </div>
                    </div>
                    <div className="md:col-span-7 bg-surface-container-low/50 p-4 rounded-xl border border-outline-variant/10">
                      <span className="font-label-sm uppercase tracking-widest text-primary block mb-1">Nota Clínica</span>
                      <p className="font-body-sm text-on-surface-variant leading-relaxed">Modulación neuromuscular del tercio superior. Reducción de líneas dinámicas preservando la expresividad natural.</p>
                    </div>
                 </div>
              </div>
            </div>
          </section>

          {/* EVOLUCION FOTOGRAFICA (BEFORE/AFTER) */}
          <section className="space-y-6 pt-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="font-headline-lg text-on-surface">Evolución Clínica</h2>
                <span className="font-label-sm uppercase tracking-widest text-on-surface-variant mt-1 block">Galería Fotográfica Médica</span>
              </div>
              <div className="flex items-center bg-surface-container-lowest border border-outline-variant/20 rounded-lg p-1 shadow-sm">
                <button onClick={() => setActiveView('frontal')} className={\`px-4 py-2 rounded-md font-label-sm uppercase tracking-wider transition-colors \${activeView === 'frontal' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}\`}>Frontal</button>
                <button onClick={() => setActiveView('izq')} className={\`px-4 py-2 rounded-md font-label-sm uppercase tracking-wider transition-colors \${activeView === 'izq' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}\`}>Perf. Izq</button>
                <button onClick={() => setActiveView('der')} className={\`px-4 py-2 rounded-md font-label-sm uppercase tracking-wider transition-colors \${activeView === 'der' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}\`}>Perf. Der</button>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl p-4 lg:p-6 border border-outline-variant/20 shadow-sm relative">
              <div className="relative w-full h-[500px] lg:h-[600px] rounded-xl overflow-hidden bg-surface-container-high shadow-inner">
                {/* After Image */}
                <div className="absolute inset-0 w-full h-full bg-cover bg-center" style={{backgroundImage:\`url('https://lh3.googleusercontent.com/aida-public/AB6AXuAa1pLs8pmfqRvl9ROfu4r7oCUqlf-pOBorel0FjBu9NvTFo7ChMofcg4q07oTrtlM68i0Jh1W8TgQ4dxeHnTm9KaYuRBp5bQ6DCbVJG_jgXj8rKf_e_yguXdm-ey1iR2B5r6TH2ans6q3wmZN96elslw_iegjqPQ7VwbvkTvyNhWnbOfxe4b2qfEpvEZezTGU7qGhSvfQ_-LukzjTPfamhgUjpTnSBfBSUHNX2-h8FAUabA8oKiRlfcQ')\`}}>
                  <div className="absolute top-6 right-6 px-4 py-2 rounded-full bg-surface/90 backdrop-blur-md shadow-sm border border-surface/50">
                    <span className="font-label-sm uppercase tracking-widest text-primary font-bold text-[10px]">15 Días Post-Tratamiento</span>
                  </div>
                </div>
                {/* Before Image */}
                <div className="absolute inset-0 h-full overflow-hidden bg-cover bg-center border-r-2 border-surface" style={{width: \`\${sliderVal}%\`, backgroundImage: \`url('https://lh3.googleusercontent.com/aida-public/AB6AXuD3SFLJRl1-8aUR6-ann5qHV2hFjwgsEf2bMZP_WKXMZYcb2gOD-0XXOHXWGFENNKztuYio9h0mbg_W0D4pnK9xkcfC2lPeuyBuNjTIKj419Rx41P5m6XFW60d_Ks_oxU4eXlryJIdUWRk_b09NjurWmCPVe76DYRNtXxf8_LGlTBnLZKXXWY5ujxwGdILiNuJjKjAy6tBP3ootUY78f2ydqzCx1rmzbrgE8y0dDqIgI0xqL4TmxLkyug')\`}}>
                  <div className="absolute top-6 left-6 px-4 py-2 rounded-full bg-on-surface/80 backdrop-blur-md shadow-sm border border-on-surface/50">
                    <span className="font-label-sm uppercase tracking-widest text-surface font-bold text-[10px]">Basal (Pre-Tratamiento)</span>
                  </div>
                </div>
                {/* Slider Handle */}
                <div className="absolute top-0 bottom-0 w-0.5 bg-surface cursor-ew-resize flex items-center justify-center pointer-events-none z-10" style={{left: \`\${sliderVal}%\`}}>
                  <div className="w-10 h-10 rounded-full bg-surface shadow-[0_2px_12px_rgba(0,0,0,0.15)] flex items-center justify-center text-primary border border-outline-variant/10 transition-transform scale-100 hover:scale-110">
                    <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
                  </div>
                </div>
                {/* Input Range */}
                <input aria-label="Control deslizante antes y después" className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20" max="100" min="0" type="range" value={sliderVal} onChange={(e) => setSliderVal(e.target.value)} />
              </div>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
`;

fs.writeFileSync('src/pages/MemberPortalPage.jsx', code);
console.log('MemberPortalPage rewritten to Sidebar Layout.');
