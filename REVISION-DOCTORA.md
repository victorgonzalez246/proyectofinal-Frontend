# Revisión clínica: Dra. Laura Jiménez

Doctora: este documento reúne **todo lo clínico que el sistema le dice a sus pacientes sin que usted intervenga**.
Lo escribimos como ejemplo y necesitamos que lo revise, lo corrija y lo apruebe antes de usarlo con pacientes reales.

Puede editar este mismo archivo (o pedirnos los cambios). Lo que diga aquí es exactamente lo que usará el sistema.

---

## Qué le pedimos

1. **Instrucciones antes de cada tratamiento.** Se envían por WhatsApp 24 horas antes de la cita. ¿Son correctas y completas?
2. **Señales de emergencia.** Si una paciente escribe alguna de estas frases, el sistema la manda al 911 y le avisa a usted de inmediato, **sin pasar por la inteligencia artificial**. ¿Falta alguna? ¿Sobra alguna?
3. **Cuándo la Enfermera Virtual la despierta.** Situaciones en las que la asistente le escribe a usted aunque no sea una emergencia. ¿Está de acuerdo?
4. **Base clínica.** Es lo **único** que la Enfermera Virtual puede responder sobre cuidados. Si una duda no está aquí, la Enfermera no improvisa: le dice a la paciente que usted le responderá y le avisa a usted. Revise cada fila, corrija lo que haga falta y agregue las preguntas que más le hacen sus pacientes.
5. **Cuidados de cada paciente.** Esos no están aquí: usted los escribe en el panel (`/admin` → Pacientes → ficha → Plan). La paciente demo (Valeria Rojas) tiene unos de ejemplo que puede usar como modelo.

Cuando termine, cambie la última línea de este documento a **Aprobado por la doctora: sí**.

---

## Cómo editar (sin romper nada)

- Escriba solo **dentro** de cada sección. No borre las líneas que empiezan con `<!--`: son las marcas que el sistema usa para encontrar cada parte.
- Cada instrucción o señal va en su propia línea, empezando con un guion (`- `).
- En la base clínica, cada fila de la tabla es una pregunta. No use el símbolo `|` dentro del texto. El riesgo solo puede ser **bajo**, **medio** o **alto**.
- Las señales de emergencia se pueden escribir con o sin tildes y basta con el inicio de una palabra (por ejemplo, `desmay` detecta "desmayo", "desmayé" y "me desmayo").

---

## 1. Instrucciones antes de cada tratamiento

Una línea por tratamiento, con el nombre **exacto** del tratamiento, dos puntos y la instrucción. La línea `General` se usa para cualquier tratamiento que no aparezca (por ejemplo, la Valoración General).

<!-- bloque:instrucciones -->
- Armonización Facial: Evita aspirina, ibuprofeno y alcohol 48 h antes y llega con el rostro limpio.
- Bioestimuladores de Colágeno: Evita aspirina, ibuprofeno y alcohol 48 h antes. Avísanos si tomas anticoagulantes.
- Rejuvenecimiento de Mirada: Llega sin maquillaje en ojos y frente y evita el ejercicio intenso ese día.
- Labios de Alta Definición: Evita aspirina, ibuprofeno y alcohol 48 h antes. Avísanos si has tenido herpes labial.
- Skinbooster & Mesoterapia: Llega con la piel limpia y no te exfolies en las 48 h previas.
- Rinomodelación Sin Cirugía: Evita aspirina, ibuprofeno y alcohol 48 h antes.
- General: Llega 10 minutos antes y con el rostro limpio.
<!-- fin -->

## 2. Señales de emergencia (aviso inmediato, sin inteligencia artificial)

<!-- bloque:senales -->
- no puedo respirar
- me ahogo
- me falta el aire
- dificultad para respirar
- se me cierra la garganta
- garganta hinchada
- lengua hinchada
- dolor en el pecho
- no veo
- perdi la vista
- vision borrosa
- veo borroso
- veo doble
- piel morada
- se puso morad
- piel blanca
- se puso blanc
- desmay
- convuls
- sangra mucho
- sangrado abundante
- fiebre alta
<!-- fin -->

## 3. Cuándo la Enfermera Virtual le avisa a usted

La Enfermera la despierta si la paciente menciona cualquiera de estas situaciones:

<!-- bloque:motivos -->
- dolor fuerte o que aumenta
- piel blanca, morada o con manchas en la zona tratada
- ampollas
- fiebre
- secreción
- cambios en la visión
- hinchazón que empeora después de 72 horas
- bultos que duelen
- asimetría marcada
- reacción alérgica
- si está muy angustiada
<!-- fin -->

## 4. Base clínica de la Enfermera Virtual

<!-- bloque:base -->
| Tema | Pregunta | Respuesta | Riesgo |
|---|---|---|---|
| Labios - ácido hialurónico | ¿Es normal que el labio esté hinchado? | Sí, la inflamación es esperable los primeros días y baja por completo entre el día 7 y el 14. Aplica frío y duerme con la cabeza un poco elevada. | bajo |
| Labios - ácido hialurónico | ¿Puedo tomar café o bebidas calientes? | Espera 24 horas antes de tomar bebidas muy calientes y no uses pajilla durante 48 horas. | bajo |
| Labios - ácido hialurónico | Siento pequeños bultitos al tocar el labio | Puede ser parte del proceso de integración del producto. No lo masajees por tu cuenta y avísanos para que la doctora lo revise. | medio |
| Labios - ácido hialurónico | La piel del labio se ve blanca o morada | Esto requiere revisión inmediata de la doctora. Te contactamos ya. | alto |
| Toxina botulínica | ¿Cuándo veré el resultado? | El efecto empieza a notarse entre el día 3 y el 5 y el resultado completo se ve alrededor del día 14. | bajo |
| Toxina botulínica | ¿Puedo acostarme después de la aplicación? | Mantente erguida las primeras 4 horas y no masajees la zona. | bajo |
| Toxina botulínica | Se me cae el párpado | Avísanos para que la doctora te valore. Es poco frecuente y temporal, pero debe revisarse. | medio |
| Bioestimuladores de colágeno | ¿Cuándo se nota el cambio? | El colágeno se forma de manera gradual: los cambios se notan entre la semana 6 y la 12. | bajo |
| General | ¿Puedo hacer ejercicio? | Evita el ejercicio intenso durante las primeras 48 horas después de tu tratamiento. | bajo |
| General | Tengo fiebre o la zona está caliente y muy roja | Esto necesita valoración de la doctora hoy mismo. Te contactamos. | alto |
<!-- fin -->

---

<!-- bloque:aprobado -->
Aprobado por la doctora: no
<!-- fin -->

<!--
Para el equipo técnico (la doctora puede ignorar esto):
  1. npm run generar:n8n      → lee este archivo, lo valida y regenera el cerebro y n8n/base-clinica-ejemplo.csv
  2. En n8n, reimporta el flujo del cerebro (o copia los nodos que cambiaron: "Mensajes: recordatorio 24 h",
     "Red de seguridad clínica" y "Agente IA 1 · Enfermera Virtual").
  3. Copia el CSV en la pestaña BaseClinica de la hoja "Base clínica" de Google.
Si este archivo tiene un error de formato, generar:n8n se detiene y dice qué línea corregir.
-->
