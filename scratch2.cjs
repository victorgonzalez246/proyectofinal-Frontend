const fs = require('fs');
let c = fs.readFileSync('../dasboard_extracted/code.html', 'utf8');
let b = c.match(/<body[^>]*>([\s\S]*?)<\/body>/i)[1];
b = b.replace(/class=/g, 'className=')
     .replace(/for=/g, 'htmlFor=')
     .replace(/tabindex=/g, 'tabIndex=')
     .replace(/stroke-width=/g, 'strokeWidth=')
     .replace(/stroke-linecap=/g, 'strokeLinecap=')
     .replace(/stroke-linejoin=/g, 'strokeLinejoin=')
     .replace(/fill-rule=/g, 'fillRule=')
     .replace(/clip-rule=/g, 'clipRule=')
     .replace(/font-variation-settings:\s*'FILL'\s*1;/g, 'fontVariationSettings: "\\\'FILL\\\' 1"')
     .replace(/style="([^"]*)"/g, (m, p1) => {
         const s = p1.split(';').filter(x => x.trim()).map(x => {
             const p = x.split(':');
             if (p.length < 2) return '';
             let k = p[0].trim().replace(/-([a-z])/g, g => g[1].toUpperCase());
             let v = p.slice(1).join(':').trim();
             if (k === 'backgroundImage' && v.includes('url(')) {
                 v = v.replace(/url\('([^']+)'\)/, "`url('$1')`");
                 return `${k}:${v}`;
             }
             if (k === 'fontVariationSettings') return `fontVariationSettings:"'FILL' 1"`;
             return `${k}:'${v}'`;
         }).filter(x => x).join(',');
         return `style={{${s}}}`;
     });

b = b.replace(/<img([^>]*)>/g, '<img$1 />')
     .replace(/<input([^>]*)>/g, '<input$1 />')
     .replace(/<br>/g, '<br />')
     .replace(/<hr>/g, '<hr />');

// Removes "Mensajes Concierge" link
b = b.replace(/<a[^>]*>Mensajes Concierge<\/a>/g, '');

// Adjust Waze Link
b = b.replace(/Instrucciones Llegada<\/span>/g, 'Instrucciones Llegada (Waze)</span>')
     .replace(/<button[^>]*>[\s\S]*?navigation[\s\S]*?Instrucciones Llegada \(Waze\)<\/span>[\s\S]*?<\/button>/g, '<a href="https://waze.com/ul" target="_blank" rel="noreferrer" className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md uppercase tracking-wider hover:bg-surface-container transition-colors"><span className="material-symbols-outlined text-[18px] text-primary">navigation</span><span>Instrucciones Llegada (Waze)</span></a>');

// Empty Protocol section
const m1 = b.match(/<div className="space-y-4">[\s\S]*?Limpieza Activa[\s\S]*?(?=<\/div>\s*<\/div>\s*<!-- Rutina Nocturna -->|<\/div>\s*<\/div>\s*<\/div>\s*<\/section>)/);
if (m1) b = b.replace(m1[0], `<div className="space-y-4"><div className="py-8 bg-surface-container-lowest rounded-xl border border-outline-variant/40 border-dashed"><p className="text-[13px] text-on-surface-variant font-sans text-center">Protocolo pendiente de asignación médica.</p></div></div>`);

const m2 = b.match(/<div className="space-y-4">[\s\S]*?Doble Limpieza[\s\S]*?(?=<\/div>\s*<\/div>\s*<\/div>\s*<\/section>)/);
if (m2) b = b.replace(m2[0], `<div className="space-y-4"><div className="py-8 bg-surface-container-lowest rounded-xl border border-outline-variant/40 border-dashed"><p className="text-[13px] text-on-surface-variant font-sans text-center">Protocolo pendiente de asignación médica.</p></div></div>`);

// Replace HTML comments
b = b.replace(/<!--([\s\S]*?)-->/g, '{/*$1*/}');

let f = `import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

export default function MemberPortalPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (<>
${b}
</>);
}
`;

fs.writeFileSync('src/pages/MemberPortalPage.jsx', f);
console.log('done');
