import * as vscode from "vscode";
import { EventEmitter } from "events";

/**
 * Proveedor de WebView para autenticación OAuth con Zoho Projects
 */
export class AuthWebviewProvider {
  private panel: vscode.WebviewPanel | undefined;
  private authResultEmitter = new EventEmitter();
  private disposables: vscode.Disposable[] = [];

  /**
   * Inicia el proceso de autenticación mediante WebView
   * @param clientId El client ID de la aplicación OAuth
   * @returns Promesa que se resolverá con el código de autorización y el estado
   */
  public async startAuth(
    clientId: string
  ): Promise<{ code: string | null; state: string | null }> {
    // Crear el panel de WebView si no existe
    if (this.panel) {
      this.panel.reveal();
    } else {
      this.panel = vscode.window.createWebviewPanel(
        "zohoProjectsAuth",
        "Autenticación de Zoho Projects",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [],
        }
      ); // Limpiar recursos cuando se cierra el panel
      this.panel.onDidDispose(
        () => {
          this.cleanup();
        },
        null,
        this.disposables
      );

      // Manejar mensajes desde el WebView
      this.panel.webview.onDidReceiveMessage(
        (message) => {
          console.log("Mensaje recibido desde WebView:", message);

          switch (message.command) {
            case "auth-result":
              console.log(
                "Resultado de autenticación recibido - Código:",
                message.code ? message.code.substring(0, 5) + "..." : "null"
              );
              console.log(
                "Resultado de autenticación recibido - Estado:",
                message.state ? message.state.substring(0, 5) + "..." : "null"
              );

              this.authResultEmitter.emit("auth-result", {
                code: message.code,
                state: message.state,
              });
              this.panel?.dispose();
              break;
            case "auth-error":
              this.authResultEmitter.emit(
                "auth-error",
                new Error(message.error)
              );
              this.panel?.dispose();
              break;
            case "open-external":
              if (message.url) {
                vscode.env.openExternal(vscode.Uri.parse(message.url)).then(
                  () => {
                    console.log("Navegador abierto con URL de autorización");
                  },
                  (error: Error) => {
                    console.error("Error al abrir navegador externo:", error);
                    if (this.panel) {
                      this.panel.webview.postMessage({
                        command: "browser-error",
                        message:
                          error.message ||
                          "Error desconocido al abrir el navegador",
                      });
                    }
                  }
                );
              }
              break;
            case "log":
              console.log("WebView log:", message.text);
              break;
          }
        },
        undefined,
        this.disposables
      );
    } // Generar un estado aleatorio para seguridad CSRF
    const state = this.generateRandomState();

    // URI de redirección (debe coincidir exactamente con la configurada en la consola de Zoho)
    const redirectUri = "vscode://zoho-projects-time-tracker/auth-callback";

    // Crear URL de autorización
    const authUrl = new URL("https://accounts.zoho.com/oauth/v2/auth");
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("client_id", clientId);
    authUrl.searchParams.append(
      "scope",
      "ZohoProjects.portals.READ,ZohoProjects.projects.READ,ZohoProjects.tasks.READ,ZohoProjects.tasks.CREATE,ZohoProjects.timesheets.READ,ZohoProjects.timesheets.CREATE,ZohoProjects.timesheets.UPDATE,ZohoProjects.timesheets.DELETE"
    );
    authUrl.searchParams.append("redirect_uri", redirectUri);
    authUrl.searchParams.append("state", state);
    authUrl.searchParams.append("access_type", "offline");
    authUrl.searchParams.append("prompt", "consent");

    console.log(`URL de autorización generada: ${authUrl.toString()}`);
    console.log(`URI de redirección configurado: ${redirectUri}`);
    console.log(`Estado generado: ${state}`);

    // Actualizar el contenido del WebView con la página de autenticación
    this.panel.webview.html = this.getWebviewContent(
      authUrl.toString(),
      redirectUri,
      state
    );

    // Esperar a que se reciba el código de autorización o un error
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.cleanup();
        reject(new Error("Tiempo de espera agotado para la autenticación"));
      }, 300000); // 5 minutos de tiempo límite

      this.authResultEmitter.once(
        "auth-result",
        (result: { code: string | null; state: string | null }) => {
          clearTimeout(timeout);
          resolve(result);
        }
      );

      this.authResultEmitter.once("auth-error", (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Genera un HTML del WebView para la autenticación
   */ private getWebviewContent(
    authUrl: string,
    redirectUri: string,
    state: string
  ): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Autenticación de Zoho Projects</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            padding: 0;
            margin: 0;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        .container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            padding: 20px;
            height: 100vh;
        }
        .auth-container {
            width: 100%;
            max-width: 800px;
            margin: 0 auto;
        }
        .two-columns {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }
        @media (min-width: 768px) {
            .two-columns {
                flex-direction: row;
            }
            .left-column, .right-column {
                width: 50%;
            }
        }
        iframe {
            width: 100%;
            height: 500px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }
        h1, h2 {
            margin-bottom: 20px;
            font-weight: normal;
        }
        h2 {
            margin-top: 0;
        }
        .instructions {
            padding: 15px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            margin-bottom: 20px;
        }
        .instructions ol {
            padding-left: 20px;
            margin-bottom: 0;
        }
        .instructions li {
            margin-bottom: 10px;
        }
        .spinner {
            border: 4px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top: 4px solid var(--vscode-button-background);
            width: 20px;
            height: 20px;
            animation: spin 2s linear infinite;
            margin-bottom: 20px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .status {
            margin-top: 20px;
            padding: 10px;
            border-radius: 4px;
        }
        .success {
            background-color: rgba(55, 200, 100, 0.1);
            color: #37c864;
        }
        .error {
            background-color: rgba(240, 71, 71, 0.1);
            color: #f04747;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 12px;
            border-radius: 2px;
            cursor: pointer;
            margin-top: 10px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        button.primary {
            font-size: 1.1em;
            padding: 10px 16px;
        }
        button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        #manualInput {
            margin-top: 20px;
            width: 100%;
        }
        textarea {
            width: 100%;
            height: 80px;
            margin: 10px 0;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 10px;
            font-family: monospace;
            font-size: 14px;
        }
        .info-text {
            font-size: 0.9em;
            margin-bottom: 10px;
            color: var(--vscode-descriptionForeground);
        }
        .highlight {
            background-color: var(--vscode-editor-selectionBackground);
            padding: 2px 4px;
            border-radius: 2px;
            font-family: monospace;
        }
        .open-browser {
            margin-top: 20px;
            text-align: center;
        }
        .copy-link {
            margin-top: 10px;
            margin-bottom: 20px;
        }
        #authLink {
            word-break: break-all;
            background-color: var(--vscode-editor-background);
            padding: 8px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            margin-top: 10px;
            font-family: monospace;
            font-size: 12px;
            display: block;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="auth-container">
            <h1>Autenticación con Zoho Projects</h1>
            
            <div class="instructions">
                <h2>Instrucciones para la autenticación</h2>
                <ol>
                    <li>Haz clic en el botón "Abrir en navegador externo" para iniciar el proceso de autenticación en tu navegador predeterminado.</li>
                    <li>Una vez iniciada la sesión en Zoho, serás redirigido a una página que probablemente mostrará un error.</li>
                    <li>Copia la <strong>URL COMPLETA</strong> de esa página desde la barra de direcciones.</li>
                    <li>Pega esa URL en el campo de texto de abajo y haz clic en "Procesar URL".</li>
                </ol>
            </div>

            <div class="open-browser">
                <button id="openBrowserButton" class="primary">Abrir en navegador externo</button>
                
                <div class="copy-link">
                    <p class="info-text">O copia este enlace y ábrelo manualmente en tu navegador:</p>
                    <div id="authLink">${authUrl}</div>
                    <button id="copyLinkButton" class="secondary">Copiar enlace</button>
                </div>
            </div>
            
            <div id="manualInput">                <h2>Pegar URL de redirección</h2>
                <p class="info-text">Después de iniciar sesión, copia la <span class="highlight">URL COMPLETA</span> de la página a la que fuiste redirigido. La URL se verá como algo así, pero puede mostrar un error:</p>
                <div class="url-example">vscode://zoho-projects-time-tracker/auth-callback?state=...&code=...</div>
                <p class="info-text">Si solo ves parte de la URL o parámetros, también puedes copiar solo la parte con <span class="highlight">code=...</span> y <span class="highlight">state=...</span></p>
                <textarea id="urlInput" placeholder="vscode://zoho-projects-time-tracker/auth-callback?state=...&code=..."></textarea>
                <button id="processUrlButton" class="primary">Procesar URL</button>
            </div>
            
            <div id="statusContainer" class="status" style="display:none;"></div>
        </div>
    </div>
      <script>
        const vscode = acquireVsCodeApi();
        const statusContainer = document.getElementById('statusContainer');
        const urlInput = document.getElementById('urlInput');
        const processUrlButton = document.getElementById('processUrlButton');
        const openBrowserButton = document.getElementById('openBrowserButton');
        const copyLinkButton = document.getElementById('copyLinkButton');
        const authLink = document.getElementById('authLink');
        
        // Estado esperado para verificar
        const expectedState = "${state}";
        // URI de autorización completa
        const authUrl = "${authUrl}";
        
        // Función para enviar mensajes a la extensión
        function log(message) {
            vscode.postMessage({
                command: 'log',
                text: message
            });
        }
        
        // Función para extraer parámetros de cualquier formato de URL
        function getUrlParams(urlString) {
            log('Intentando extraer parámetros de: ' + urlString);
            
            // Primera estrategia: uso de URL y URLSearchParams estándar
            try {
                const parsedUrl = new URL(urlString);
                const searchParams = new URLSearchParams(parsedUrl.search);
                const code = searchParams.get('code');
                const state = searchParams.get('state');
                
                if (code && state) {
                    log('Parámetros extraídos correctamente mediante URL estándar');
                    return { code, state };
                }
            } catch (error) {
                log('Error al parsear URL estándar: ' + error.message);
            }
            
            // Segunda estrategia: búsqueda manual de parámetros en la cadena
            try {
                // Buscar parámetro code= en la cadena
                const codeMatch = urlString.match(/[?&]code=([^&]+)/);
                const stateMatch = urlString.match(/[?&]state=([^&]+)/);
                
                const code = codeMatch ? codeMatch[1] : null;
                const state = stateMatch ? stateMatch[1] : null;
                
                log('Extracción manual - código: ' + (code ? 'encontrado' : 'no encontrado'));
                log('Extracción manual - estado: ' + (state ? 'encontrado' : 'no encontrado'));
                
                if (code && state) {
                    return { code, state };
                }
            } catch (error) {
                log('Error en la extracción manual: ' + error.message);
            }
              // Tercera estrategia: intentar normalizar la URL
            try {
                // Normalizar casos comunes de URL malformadas                let normalizedUrl = urlString;
                
                // Log de depuración
                log('Intentando normalizar URL: ' + urlString);
                
                // Caso específico del problema actual
                if (urlString.includes('state=') && urlString.includes('code=') && urlString.includes('location=us')) {
                    log('Detectada URL con patrón específico que incluye location=us');
                    const stateMatch = urlString.match(/[?&]state=([^&]+)/);
                    const codeMatch = urlString.match(/[?&]code=([^&]+)/);
                    
                    if (stateMatch && codeMatch) {
                        const stateValue = stateMatch[1];
                        const codeValue = codeMatch[1];
                        
                        log('Extrayendo directamente code=' + codeValue.substring(0, 5) + '... y state=' + stateValue);
                        return { code: codeValue, state: stateValue };
                    }
                }
                
                // Manejar los casos específicos que podrían ocurrir
                if (urlString.startsWith('https://vscode//')) {
                    normalizedUrl = urlString.replace('https://vscode//', 'vscode://');
                    log('URL normalizada de https://vscode// a vscode://');
                } else if (urlString.startsWith('https://vscode/')) {
                    normalizedUrl = urlString.replace('https://vscode/', 'vscode://');
                    log('URL normalizada de https://vscode/ a vscode://');
                } else if (!urlString.startsWith('vscode://') && urlString.includes('code=') && urlString.includes('state=')) {
                    // En caso de que el usuario pegue solo los parámetros o una URL parcial
                    normalizedUrl = 'vscode://zoho-projects-time-tracker/auth-callback?' + urlString.split('?').pop();
                    log('Reconstruyendo URL a partir de parámetros: ' + normalizedUrl);
                } else if (urlString.includes('code=') && urlString.includes('state=')) {
                    // Caso donde el usuario ha copiado solo la parte del query string
                    if (!urlString.includes('://') && !urlString.startsWith('http')) {
                        normalizedUrl = 'vscode://zoho-projects-time-tracker/auth-callback?' + urlString;
                        log('Reconstruyendo URL a partir de query string');
                    }
                }
                
                // Intentar extraer nuevamente con expresiones regulares
                const codeMatch = normalizedUrl.match(/[?&]code=([^&]+)/);
                const stateMatch = normalizedUrl.match(/[?&]state=([^&]+)/);
                
                const code = codeMatch ? codeMatch[1] : null;
                const state = stateMatch ? stateMatch[1] : null;
                
                return { code, state };
            } catch (error) {
                log('Error en normalización: ' + error.message);
            }
            
            // Si llegamos aquí, no pudimos extraer los parámetros
            return { code: null, state: null };
        }
          // Función para manejar la respuesta de autenticación
        function handleAuthResponse(url) {
            log('Procesando URL de redirección: ' + url);
            
            // Añadir mensaje de depuración visible para el usuario
            statusContainer.innerHTML = '<strong>Procesando URL...</strong> Por favor espera.';
            statusContainer.className = 'status';
            statusContainer.style.display = 'block';
            
            const { code, state } = getUrlParams(url);
            
            log('Código extraído: ' + (code ? 'Sí (' + code.substring(0, 5) + '...)' : 'No'));
            log('Estado extraído: ' + (state ? 'Sí (' + state.substring(0, 5) + '...)' : 'No'));
            log('Estado esperado: ' + expectedState.substring(0, 5) + '...');
            
            if (code && state) {
                if (state === expectedState) {
                    log('Autenticación exitosa, código recibido: ' + code.substring(0, 5) + '...');
                    statusContainer.innerHTML = '<strong>¡Autenticación exitosa!</strong> Procesando credenciales... Esta ventana se cerrará automáticamente.';
                    statusContainer.className = 'status success';
                    statusContainer.style.display = 'block';
                    
                    // Deshabilitar la entrada y los botones
                    urlInput.disabled = true;
                    processUrlButton.disabled = true;
                    openBrowserButton.disabled = true;
                    
                    // Enviar el código a la extensión
                    vscode.postMessage({
                        command: 'auth-result',
                        code,
                        state
                    });
                } else {
                    log('Error: estado no coincide');
                    statusContainer.innerHTML = '<strong>Error de seguridad:</strong> El estado de la solicitud no coincide. Por favor, intenta nuevamente.';
                    statusContainer.className = 'status error';
                    statusContainer.style.display = 'block';
                }
            } else {
                log('Error: no se recibió código o estado');
                statusContainer.innerHTML = '<strong>Error:</strong> No se pudieron extraer los parámetros necesarios de la URL. Verifica que has copiado la URL completa.';
                statusContainer.className = 'status error';
                statusContainer.style.display = 'block';
            }
        }
          // Configurar la entrada manual
        processUrlButton.addEventListener('click', () => {
            const url = urlInput.value.trim();
            log('Botón Procesar URL clickeado con valor: ' + url);
            
            if (url) {
                try {
                    handleAuthResponse(url);
                } catch (error) {
                    log('Error al procesar URL: ' + error.message);
                    statusContainer.innerHTML = '<strong>Error:</strong> Ocurrió un error al procesar la URL. Por favor, verifica la consola de depuración.';
                    statusContainer.className = 'status error';
                    statusContainer.style.display = 'block';
                }
            } else {
                statusContainer.innerHTML = '<strong>Error:</strong> Por favor, introduce una URL válida.';
                statusContainer.className = 'status error';
                statusContainer.style.display = 'block';
            }
        });
        
        // Configurar el botón para abrir en navegador externo
        openBrowserButton.addEventListener('click', () => {
            vscode.postMessage({
                command: 'open-external',
                url: authUrl
            });
        });
          // Configurar el botón para copiar el enlace
        copyLinkButton.addEventListener('click', () => {
            navigator.clipboard.writeText(authUrl).then(
                () => {
                    copyLinkButton.textContent = '¡Copiado!';
                    setTimeout(() => {
                        copyLinkButton.textContent = 'Copiar enlace';
                    }, 2000);
                },
                (err) => {
                    log('Error al copiar al portapapeles: ' + err);
                    copyLinkButton.textContent = 'Error al copiar';
                    setTimeout(() => {
                        copyLinkButton.textContent = 'Copiar enlace';
                    }, 2000);
                }
            );
        });
        
        // Ejecutar verificación al cargar la página
        document.addEventListener('DOMContentLoaded', () => {
            log('WebView cargado completamente');
            log('Estado esperado: ' + expectedState);
            
            // Verificar que los elementos del DOM existen
            log('Elementos del DOM: ' + 
                'statusContainer=' + (statusContainer ? 'existe' : 'no existe') + ', ' +
                'urlInput=' + (urlInput ? 'existe' : 'no existe') + ', ' +
                'processUrlButton=' + (processUrlButton ? 'existe' : 'no existe'));
        });
        
        log('WebView de autenticación cargado');
    </script>
</body>
</html>`;
  }

  /**
   * Genera un estado aleatorio para protección CSRF
   */
  private generateRandomState(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  /**
   * Limpia recursos cuando se cierra el WebView
   */
  private cleanup(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.panel = undefined;
  }
}
