/**
 * Función para probar la extracción de parámetros de una URL
 */
function testUrlParser() {
  // URL de prueba que representa la que está pegando el usuario
  const testUrl =
    "https://vscode//zoho-projects-time-tracker/auth-callback?state=ia3xfzlcbbnzuw8pi6vyph&code=1000.e5f340afa50d49dbf25ff2b248b60b9e.523f198d2656fc99ab34863822970287&location=us&accounts-server=https%3A%2F%2Faccounts.zoho.com&";

  console.log("Probando extracción de parámetros para URL:", testUrl);

  try {
    // Probar URL estándar
    const url = new URL(testUrl);
    console.log("URL parseada correctamente");
    console.log("Protocolo:", url.protocol);
    console.log("Host:", url.host);
    console.log("Pathname:", url.pathname);
    console.log("Params:", url.search);

    const params = new URLSearchParams(url.search);
    console.log("Código:", params.get("code"));
    console.log("Estado:", params.get("state"));
  } catch (error) {
    console.error("Error al parsear URL estándar:", error);
  }

  try {
    // Probar extracción manual con regex
    const codeMatch = testUrl.match(/[?&]code=([^&]+)/);
    const stateMatch = testUrl.match(/[?&]state=([^&]+)/);

    console.log("Extracción manual:");
    console.log("Código:", codeMatch ? codeMatch[1] : "no encontrado");
    console.log("Estado:", stateMatch ? stateMatch[1] : "no encontrado");
  } catch (error) {
    console.error("Error en extracción manual:", error);
  }

  try {
    // Normalización de la URL
    let normalizedUrl = testUrl;

    if (testUrl.startsWith("https://vscode//")) {
      normalizedUrl = testUrl.replace("https://vscode//", "vscode://");
      console.log("URL normalizada:", normalizedUrl);
    }

    // Intentar extraer de la URL normalizada
    const urlNorm = new URL(normalizedUrl);
    const paramsNorm = new URLSearchParams(urlNorm.search);
    console.log("Después de normalizar:");
    console.log("Código:", paramsNorm.get("code"));
    console.log("Estado:", paramsNorm.get("state"));
  } catch (error) {
    console.error("Error al normalizar URL:", error);
  }
}

// Ejecutar la prueba
testUrlParser();
