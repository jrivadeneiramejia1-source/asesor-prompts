// Pone el tema antes de pintar para que la pantalla no parpadee. app.js lo guarda en 'asesor-prompts.tema'.
// También avisa si abriste el archivo con doble clic (el navegador bloquea los módulos en file://).
(function () {
  try {
    var t = localStorage.getItem('asesor-prompts.tema');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  } catch (e) { /* sin almacenamiento: queda el tema automático */ }
  if (location.protocol === 'file:') {
    document.addEventListener('DOMContentLoaded', function () {
      var a = document.getElementById('sinServidor');
      if (a) a.hidden = false;
    });
  }
})();
