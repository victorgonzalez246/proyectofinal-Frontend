const fs = require('fs');
let code = fs.readFileSync('src/pages/MemberPortalPage.jsx', 'utf8');

// 1. Remove the entire <script>...</script> block
code = code.replace(/<script>[\s\S]*?<\/script>/, '');

// 2. Add useState import
if (!code.includes('useState')) {
    code = code.replace("import React from 'react';", "import React, { useState } from 'react';");
}

// 3. Add state variables inside the component
code = code.replace(
    '  const navigate = useNavigate();\n',
    "  const navigate = useNavigate();\n  const [sliderVal, setSliderVal] = useState(50);\n  const [activeView, setActiveView] = useState('frontal');\n"
);

// 4. Update the angle buttons
// btn-frontal
code = code.replace(
    /id="btn-frontal" type="button">/g,
    `onClick={() => setActiveView('frontal')} className={activeView === 'frontal' ? "px-4 py-2 rounded-md bg-surface-container-lowest text-primary font-label-md text-label-md uppercase tracking-wider font-semibold shadow-xs" : "px-4 py-2 rounded-md text-on-surface-variant hover:text-on-surface font-label-md text-label-md uppercase tracking-wider transition-colors"} type="button">`
).replace(/className="px-4 py-2 rounded-md bg-surface-container-lowest text-primary font-label-md text-label-md uppercase tracking-wider font-semibold shadow-xs" onClick/g, 'onClick'); // Clean up old class if any

// btn-perfil-izq
code = code.replace(
    /id="btn-perfil-izq" type="button">/g,
    `onClick={() => setActiveView('izq')} className={activeView === 'izq' ? "px-4 py-2 rounded-md bg-surface-container-lowest text-primary font-label-md text-label-md uppercase tracking-wider font-semibold shadow-xs" : "px-4 py-2 rounded-md text-on-surface-variant hover:text-on-surface font-label-md text-label-md uppercase tracking-wider transition-colors"} type="button">`
).replace(/className="px-4 py-2 rounded-md text-on-surface-variant hover:text-on-surface font-label-md text-label-md uppercase tracking-wider transition-colors" onClick/g, 'onClick');

// btn-perfil-der
code = code.replace(
    /id="btn-perfil-der" type="button">/g,
    `onClick={() => setActiveView('der')} className={activeView === 'der' ? "px-4 py-2 rounded-md bg-surface-container-lowest text-primary font-label-md text-label-md uppercase tracking-wider font-semibold shadow-xs" : "px-4 py-2 rounded-md text-on-surface-variant hover:text-on-surface font-label-md text-label-md uppercase tracking-wider transition-colors"} type="button">`
).replace(/className="px-4 py-2 rounded-md text-on-surface-variant hover:text-on-surface font-label-md text-label-md uppercase tracking-wider transition-colors" onClick/g, 'onClick');


// 5. Update the slider input and dynamic styles
// input
code = code.replace(
    /value="50" \/>/g,
    `value={sliderVal} onChange={(e) => setSliderVal(e.target.value)} />`
);

// before-layer style
code = code.replace(
    /id="before-layer" style={{width:'50%',backgroundImage:`url\('([^']+)'\)`}}/g,
    `id="before-layer" style={{width: \`\${sliderVal}%\`, backgroundImage: \`url('$1')\`}}`
);

// slider-handle style
code = code.replace(
    /id="slider-handle" style={{left:'50%'}}/g,
    `id="slider-handle" style={{left: \`\${sliderVal}%\`}}`
);

fs.writeFileSync('src/pages/MemberPortalPage.jsx', code);
console.log('Fixed JSX Script and State');
