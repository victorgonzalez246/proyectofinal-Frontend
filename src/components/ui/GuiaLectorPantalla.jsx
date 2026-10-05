import './accesibilidad.css';

/**
 * Guía breve para usar el sitio con TalkBack (Android) o VoiceOver (iPhone).
 * <details> nativo: TalkBack lo anuncia como "contraído / expandido" sin JavaScript.
 */
export default function GuiaLectorPantalla() {
  return (
    <details className="guia-lp">
      <summary>Usar con TalkBack o VoiceOver</summary>
      <div className="guia-lp__cuerpo">
        <p><strong>Activar TalkBack (Android):</strong> Ajustes → Accesibilidad → TalkBack → activar. Atajo: mantén pulsadas las dos teclas de volumen 3 segundos.</p>
        <p><strong>Activar VoiceOver (iPhone):</strong> Ajustes → Accesibilidad → VoiceOver, o pídeselo a Siri.</p>
        <ul>
          <li>Desliza a la derecha o a la izquierda para pasar de un elemento a otro; toca dos veces para activarlo.</li>
          <li>Usa el menú de TalkBack para saltar por <strong>encabezados</strong>: cada sección tiene uno.</li>
          <li>Al cambiar de sección, la página anuncia su nombre y lleva el foco al contenido.</li>
          <li>Con TalkBack encendido no necesitas «Leer página»: TalkBack ya lee todo. Si usas los dos a la vez, se escuchan las dos voces.</li>
          <li>También puedes pedirle a Aura, en el chat: «activa el modo protanopia», «lee la página» o «detén la lectura».</li>
        </ul>
      </div>
    </details>
  );
}
