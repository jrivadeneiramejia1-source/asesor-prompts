// Datos fijos: modelos, esfuerzos, la escalera que usa el aprendizaje y los tipos de tarea.
// Precios de lista en USD por millón de tokens (entrada / salida), al 2026-10-06.

export const VERSION = '1.0.0';

// Tablas sin prototipo: así un valor importado como «constructor» o «toString» no cuenta como modelo, tipo ni valoración.
const sinProto = (o) => Object.assign(Object.create(null), o);

export const MODELOS = sinProto({
  haiku:  { nombre: 'Haiku 5.5',  costo: 0.05, usd: '$0,10 / $0,50', uso: 'tareas simples y rápidas' },
  sonnet: { nombre: 'Sonnet 5.5', costo: 1,    usd: '$2 / $10',      uso: 'trabajo de todos los días' },
  opus:   { nombre: 'Opus 5.5',   costo: 2,    usd: '$4 / $20',      uso: 'tareas difíciles' },
  fable:  { nombre: 'Fable 5.1',  costo: 5,    usd: '$10 / $50',     uso: 'lo más difícil y largo' }
});

export const ESFUERZOS = [
  { id: 'low',    es: 'Bajo' },
  { id: 'medium', es: 'Medio' },
  { id: 'high',   es: 'Alto' },
  { id: 'xhigh',  es: 'Muy alto' },
  { id: 'max',    es: 'Máximo' }
];

// De más barato a más caro. El aprendizaje sube o baja de a un peldaño.
// Fable es de escalada manual: el motor nunca pasa del peldaño 7 por su cuenta.
export const ESCALERA = [
  { modelo: 'haiku',  esfuerzo: 'low' },
  { modelo: 'haiku',  esfuerzo: 'medium' },
  { modelo: 'sonnet', esfuerzo: 'low' },
  { modelo: 'sonnet', esfuerzo: 'medium' },
  { modelo: 'sonnet', esfuerzo: 'high' },
  { modelo: 'opus',   esfuerzo: 'medium' },
  { modelo: 'opus',   esfuerzo: 'high' },
  { modelo: 'opus',   esfuerzo: 'xhigh' },
  { modelo: 'fable',  esfuerzo: 'high' }
];
export const TOPE_AUTOMATICO = 7;

export const RESULTADOS = sinProto({ justo: 'Justo', corto: 'Quedó corto', sobro: 'Sobró' });

export const PERFIL_BASE =
  'Soy Jeiler, aprendiz del SENA en soporte técnico y mantenimiento de equipos (Colombia). ' +
  'Trabajo con n8n, scripts en PowerShell 7 en Windows, IA y soporte técnico. ' +
  'Quiero respuestas en español, breves y directas, con el porqué en 1 a 3 frases. ' +
  'Los scripts deben venir auditados y probados, con comandos listos para copiar. ' +
  'Avísame antes de cualquier acción que no se pueda deshacer. Nunca me pidas claves, tokens ni contraseñas.';

// Cada tipo de tarea: peldaño de partida, palabras que lo delatan (sin tildes), qué datos suelen faltar y cómo cerrar el prompt.
// claves: [expresión, peso]. faltan: { texto, tiene } (tiene = si el borrador ya lo trae). perfil: palabras del perfil que dan contexto.
export const CATEGORIAS = [
  {
    id: 'powershell', nombre: 'Script de PowerShell o Windows', base: 3,
    claves: [[/powershell|pwsh|\.ps1/, 4], [/\bscript\b/, 2], [/\.bat\b|\bcmd\b|batch|robocopy|registro de windows|tarea programada/, 3], [/carpeta|usb|copiar archivos|disco/, 1]],
    faltan: [
      { texto: 'Ruta exacta de origen y de destino', tiene: /[a-z]:\\|\\\\|~\/|%\w+%|\$env:|\/(home|users?|mnt|var)\//i },
      { texto: 'Versión de PowerShell y de Windows', tiene: /powershell\s*\d|pwsh|windows\s*(10|11|server)|\bwin\s?1[01]\b/, perfil: /powershell\s*7/ },
      { texto: 'Qué debe pasar si algo falla (parar, seguir o avisar)', tiene: /si (algo )?(falla|sale mal)|fallar|errores?|try|manejo/ },
      { texto: 'Cómo comprobar que funcionó', tiene: /comprobar|verificar|prueba|probar|resultado esperado|debe (mostrar|dar|crear)/ }
    ],
    perfilClaves: /powershell|windows|scripts?/,
    formato: 'Archivo completo listo para copiar si es grande; si es un cambio pequeño, solo el fragmento y dónde va.',
    comprobar: 'Dime el comando exacto para ejecutarlo y qué debería ver si salió bien.',
    riesgo: 'Puede fallar al manejar errores o rutas con espacios.'
  },
  {
    id: 'n8n', nombre: 'Flujo de n8n', base: 3,
    claves: [[/\bn8n\b/, 5], [/workflow|flujo|webhook|\bnodo\b|\bnodos\b|trigger|credencial/, 2], [/telegram|whatsapp|gmail|google sheets|http request/, 1]],
    faltan: [
      { texto: 'Nombre del nodo que falla o el paso del flujo', tiene: /nodo|node|webhook|http request|\bcode\b|\bset\b|\bif\b|switch|trigger/ },
      { texto: 'Texto exacto del error de n8n (no el cartel genérico)', tiene: /(error|exception)[^\n]{0,30}:\s*\S|\b[45]\d\d\b|status code|message:/ },
      { texto: 'Versión de n8n y cómo lo ejecutas', tiene: /n8n\s*v?\d|versi[oó]n|docker|npm/, perfil: /n8n/ }
    ],
    perfilClaves: /n8n|windows|automat/,
    formato: 'Pasos numerados y literales: qué nodo abrir, qué campo cambiar y qué valor poner.',
    comprobar: 'Dime cómo probar el flujo y qué salida debería ver en cada nodo.',
    riesgo: 'Puede inventar un campo o nodo que no existe en tu versión.'
  },
  {
    id: 'depuracion', nombre: 'Depurar un error', base: 3,
    claves: [[/\berror(es)?\b|exception|traceback|stack ?trace|no funciona|no sirve|se cae|se traba|pantalla azul/, 3], [/\bfalla\b|\bfallo\b|\bfallan\b|\bfallaron\b/, 1], [/bug|depurar|arreglar|solucionar|corregir/, 2], [/otra vez|sigue fallando|ya probe|ya intente|sin exito/, 2]],
    faltan: [
      { texto: 'Texto exacto y completo del error', tiene: /(error|exception|fallo|failed)[^\n]{0,30}:\s*\S|0x[0-9a-f]{4,}|\bcode\s*\d+|\b[45]\d\d\b|\n.*\bat\b.*\(/i },
      { texto: 'Qué ya probaste y qué pasó', tiene: /ya (prob|intent)|probe|intente|sin exito|no sirvio/ },
      { texto: 'Qué esperabas que pasara', tiene: /deberia|esperaba|quiero que|espero|lo normal/ }
    ],
    perfilClaves: /windows|powershell|n8n/,
    formato: 'Primero la causa más probable en una frase y luego los pasos para arreglarlo, uno por vez.',
    comprobar: 'Dime cómo comprobar que el error desapareció.',
    riesgo: 'Puede quedarse en la causa equivocada si el error es raro.'
  },
  {
    id: 'soporte', nombre: 'Soporte técnico de equipos', base: 2,
    claves: [[/impresora|computador|portatil|laptop|\bpc\b|monitor|teclado|mouse|disco duro|memoria ram|fuente de poder|ensamblar|formatear|mantenimiento|driver|bios|wifi|red local|router|switch/, 3], [/instalar windows|actualizar|virus|lento|no enciende|no prende|pitidos/, 2]],
    faltan: [
      { texto: 'Marca, modelo y sistema operativo del equipo', tiene: /(hp|dell|lenovo|acer|asus|samsung|epson|canon|brother|toshiba|msi)\b|windows\s*\d+|modelo/ },
      { texto: 'Síntomas exactos y desde cuándo ocurren', tiene: /desde|empez|ayer|hoy|semana|de repente|cuando/ },
      { texto: 'Qué ya probaste', tiene: /ya (prob|intent|revis)|probe|reinici|cambi/ }
    ],
    perfilClaves: /soporte|equipos|windows/,
    formato: 'Lista de revisión ordenada de lo más simple a lo más complejo, con el resultado esperado de cada paso.',
    comprobar: 'Dime cómo saber si el problema quedó resuelto y cuándo conviene llamar a un técnico.',
    riesgo: 'Puede pasar por alto una causa de hardware.'
  },
  {
    id: 'arquitectura', nombre: 'Diseño o arquitectura', base: 6,
    claves: [[/arquitectura|disen(o|ar|ame)|estructura del proyecto|escalable|patron de diseno|base de datos|modelo de datos|esquema/, 4], [/migrar|migracion|refactor|rehacer|varios (archivos|modulos|servicios)|todo el (repo|proyecto)|desde cero/, 3], [/comparar opciones|que me conviene|pros y contras|trade-?off/, 2]],
    faltan: [
      { texto: 'Qué problema concreto resuelve y para quién', tiene: /para (que|quien)|problema|objetivo|necesito que/ },
      { texto: 'Restricciones: presupuesto, plazo y herramientas que ya usas', tiene: /presupuesto|plazo|gratis|sin costo|ya uso|ya tengo|limite/ },
      { texto: 'Qué cambiaría o dañaría si sale mal', tiene: /si sale mal|riesgo|no puedo perder|respaldo|backup/ }
    ],
    perfilClaves: /.*/,
    formato: 'Primero tu recomendación en 3 líneas; luego alternativas con pros y contras; al final un plan por pasos.',
    comprobar: 'Dime qué prueba pequeña haría antes de comprometerme con todo el diseño.',
    riesgo: 'Puede quedarse en un diseño genérico y pasar por alto tus restricciones.'
  },
  {
    id: 'seguridad', nombre: 'Seguridad o auditoría', base: 6,
    claves: [[/seguridad|vulnerabilidad|auditar|auditoria|pentest|hackeo|hackear|cifrar|cifrado|permisos|ataque|malware|phishing|contrasena segura/, 4], [/clave|token|credencial/, 1]],
    faltan: [
      { texto: 'Qué sistema o activo quieres proteger', tiene: /proteger|sistema|servidor|cuenta|app|aplicacion|red/ },
      { texto: 'Qué amenazas te preocupan', tiene: /amenaza|ataque|robo|filtracion|perder|riesgo/ },
      { texto: 'Qué medidas ya tienes', tiene: /ya tengo|ya uso|ya configure|ya activ|firewall|antivirus|2fa/ }
    ],
    perfilClaves: /.*/,
    formato: 'Lista priorizada de riesgos (alto, medio, bajo) con el arreglo concreto de cada uno.',
    comprobar: 'Dime cómo verificar que cada arreglo quedó aplicado.',
    riesgo: 'Un hallazgo que se escape aquí puede salir caro.'
  },
  {
    id: 'codigo', nombre: 'Código o app web', base: 3,
    claves: [[/javascript|typescript|python|html|css|react|node|\bapi\b|funcion|clase|componente|programa|aplicacion|\bapp\b|pagina web|sql|github|repositorio/, 3], [/codigo|programar|implementar|pruebas unitarias|test/, 2]],
    faltan: [
      { texto: 'Lenguaje, versión y dónde corre', tiene: /javascript|typescript|python|node|html|css|react|java|php|sql|versi[oó]n/ },
      { texto: 'Ejemplo de entrada y de salida esperada', tiene: /ejemplo|entrada|salida|debe devolver|resultado/ },
      { texto: 'Código o archivo con el que ya cuentas', tiene: /```|function|const |def |class |<\w+>/ }
    ],
    perfilClaves: /.*/,
    formato: 'Archivo completo si es nuevo; si es un cambio pequeño, solo el fragmento y dónde va.',
    comprobar: 'Dime cómo probarlo y qué casos de borde conviene revisar.',
    riesgo: 'Puede dejar un caso de borde sin cubrir.'
  },
  {
    id: 'agentes', nombre: 'Prompts, agentes o IA', base: 3,
    claves: [[/prompt|agente|\bia\b|gemini|claude|chatgpt|modelo de lenguaje|\bllm\b|embedding|\brag\b|skill|mcp/, 3], [/automatizar con ia|chatbot|asistente/, 2]],
    faltan: [
      { texto: 'Qué herramientas o permisos tiene el agente', tiene: /herramienta|permiso|acceso|api|n8n|telegram|gmail/ },
      { texto: 'Qué NO debe hacer nunca', tiene: /nunca|no debe|prohibido|sin permiso|confirmar/ },
      { texto: 'Cómo medirás si responde bien', tiene: /probar|prueba|medir|evaluar|casos/ }
    ],
    perfilClaves: /ia|n8n|gemini/,
    formato: 'Prompt listo para pegar, con rol, reglas, formato de salida y 3 ejemplos de prueba (uno normal y uno engañoso).',
    comprobar: 'Dame 5 mensajes de prueba, incluidos 2 que intenten engañarlo, y la salida esperada de cada uno.',
    riesgo: 'Puede dejar huecos ante mensajes que intenten engañar al agente.'
  },
  {
    id: 'analisis', nombre: 'Analizar datos o documentos', base: 3,
    claves: [[/analiz|analisis|excel|hoja de calculo|csv|tabla|datos|informe|reporte|documento|pdf|estadistica|grafica|promedio|porcentaje/, 3], [/conclusion|hallazgo|tendencia/, 2]],
    faltan: [
      { texto: 'Los datos o el archivo (pégalos o describe las columnas)', tiene: /columnas?|filas?|adjunto|pego|\n.*[,;\t].*[,;\t]/ },
      { texto: 'Qué decisión o respuesta necesitas al final', tiene: /para (decidir|saber|elegir|presentar)|conclusi|recomend|necesito saber/ }
    ],
    perfilClaves: /.*/,
    formato: 'Primero las conclusiones en 3 líneas, luego la tabla o el detalle que las respalda.',
    comprobar: 'Dime qué datos usaste y qué supuestos hiciste, para yo poder verificarlo.',
    riesgo: 'Puede perder un detalle de los datos o equivocarse en un cálculo.'
  },
  {
    id: 'redaccion', nombre: 'Redacción', base: 2,
    claves: [[/redacta|redactar|escribe (un|una)|carta|correo|email|mensaje para|informe formal|presentacion|discurso|publicacion|resena|descripcion del producto|oficio|asunto/, 3], [/formal|cordial|profesional|tono/, 1]],
    faltan: [
      { texto: 'Para quién es y qué tono usar', tiene: /para (mi|el|la|un|una|los|las)\b|tono|formal|informal|cordial|profesional|destinatari|cliente|jefe|instructor/ },
      { texto: 'Largo aproximado', tiene: /\b\d+\s*(palabras|lineas|parrafos|renglones)|breve|corto|una pagina|extenso/ }
    ],
    perfilClaves: /espanol|breves/,
    formato: 'Solo el texto final, sin explicaciones antes ni después.',
    comprobar: 'Al final, una línea con lo que supuse y debería confirmar contigo.',
    riesgo: 'Puede sonar genérico; ajusta el tono con un ejemplo tuyo.'
  },
  {
    id: 'traduccion', nombre: 'Traducir, resumir o dar formato', base: 1,
    claves: [[/traduc|resum|corrige|ortograf|reescribe|parafrasea|formato|clasific|extrae|convierte|pasa a (json|tabla|lista)/, 4]],
    faltan: [
      { texto: 'Idioma de destino o formato de salida', tiene: /al (ingles|espanol|frances|portugues|aleman)|a (ingles|espanol)|english|spanish|json|tabla|lista|csv/ }
    ],
    perfilClaves: /espanol/,
    formato: 'Solo el resultado, sin explicaciones.',
    comprobar: '',
    riesgo: 'Puede cambiar un matiz del texto original.'
  },
  {
    id: 'rapida', nombre: 'Consulta rápida', base: 0,
    claves: [[/^(que|cual|como|cuanto|cuando|donde|quien|por que)\b[^\n]{0,80}\??$/, 3], [/\bdime\b|\bdefine\b|significa|diferencia entre|para que sirve|comando para/, 2]],
    faltan: [],
    perfilClaves: /espanol/,
    formato: 'Respuesta directa en una o dos líneas.',
    comprobar: '',
    riesgo: 'Puede quedarse corto si la pregunta tenía un matiz.'
  },
  {
    id: 'general', nombre: 'Consulta general', base: 3,
    claves: [],
    faltan: [
      { texto: 'Qué resultado esperas ver al final', tiene: /quiero|necesito|espero|resultado|objetivo|para (que|poder)/ }
    ],
    perfilClaves: /espanol/,
    formato: 'Respuesta breve y directa; si hace falta, pasos numerados.',
    comprobar: '',
    riesgo: 'Puede quedarse corto si la tarea era más difícil de lo que parecía.'
  }
];

export const CATEGORIA = sinProto(Object.fromEntries(CATEGORIAS.map((c) => [c.id, c])));
