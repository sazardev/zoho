import * as vscode from "vscode";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

/**
 * Gestiona la autenticación con Zoho Projects mediante OAuth 2.0
 */
export class ZohoAuthenticationProvider {
  private static readonly AUTH_TYPE = "zoho-projects";
  private static readonly AUTH_NAME = "Zoho Projects";
  private static readonly SCOPES =
    "ZohoProjects.portals.READ,ZohoProjects.projects.READ,ZohoProjects.tasks.READ,ZohoProjects.tasks.CREATE,ZohoProjects.timesheets.READ,ZohoProjects.timesheets.CREATE,ZohoProjects.timesheets.UPDATE,ZohoProjects.timesheets.DELETE";

  // Variable para el manejador de URI
  private static uriHandlerRegistration: vscode.Disposable | undefined;

  private authenticationSession: vscode.AuthenticationSession | undefined;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Inicia el proceso de autenticación
   */
  public async login(): Promise<vscode.AuthenticationSession | undefined> {
    try {
      console.log("Iniciando proceso de autenticación con Zoho Projects");

      // Verificar si ya hay un proceso de autenticación en curso
      if (ZohoAuthenticationProvider.uriHandlerRegistration) {
        console.log(
          "Proceso de autenticación ya en curso, deteniendo intento adicional"
        );
        vscode.window.showInformationMessage(
          "Ya hay un proceso de autenticación en curso. Por favor, completa ese proceso primero."
        );
        return undefined;
      }

      // Obtener configuración
      const config = vscode.workspace.getConfiguration("zohoProjects");
      const clientId = config.get<string>("clientId");
      const clientSecret = config.get<string>("clientSecret");
      const apiDomain =
        config.get<string>("apiDomain") || "https://projectsapi.zoho.com";

      console.log("Configuración cargada. API Domain:", apiDomain);
      console.log("Client ID configurado:", clientId ? "Sí" : "No");
      console.log("Client Secret configurado:", clientSecret ? "Sí" : "No");
      if (!clientId || !clientSecret) {
        console.log(
          "Credenciales no configuradas. Mostrando diálogo al usuario."
        );
        const configureNow = "Configurar ahora";
        const showSettings = "Mostrar valores actuales";
        const response = await vscode.window.showErrorMessage(
          "Necesitas configurar el Client ID y Client Secret para OAuth de Zoho Projects",
          configureNow,
          showSettings
        );

        if (response === configureNow) {
          await vscode.commands.executeCommand(
            "workbench.action.openSettings",
            "zohoProjects"
          );
        } else if (response === showSettings) {
          const currentSettings = {
            clientId: clientId || "(no configurado)",
            clientSecret: clientSecret
              ? "(configurado pero oculto)"
              : "(no configurado)",
            apiDomain: apiDomain,
          };

          vscode.window.showInformationMessage(
            `Configuración actual: 
            - API Domain: ${currentSettings.apiDomain}
            - Client ID: ${currentSettings.clientId}
            - Client Secret: ${currentSettings.clientSecret}`
          );
        }
        return undefined;
      } // Generar estado para prevenir CSRF
      const state = uuidv4();
      // URI de redirección usando el protocolo específico de VS Code
      // IMPORTANTE: Esta URI debe coincidir EXACTAMENTE con la configurada en la consola de Zoho
      const callbackUri = `vscode://zoho-projects-time-tracker/auth-callback`;
      console.log(`URI de redirección configurado como: ${callbackUri}`);

      // Crear URL para la autorización
      const authUrl = new URL("https://accounts.zoho.com/oauth/v2/auth");
      authUrl.searchParams.append("response_type", "code");
      authUrl.searchParams.append("client_id", clientId);
      authUrl.searchParams.append("scope", ZohoAuthenticationProvider.SCOPES);
      authUrl.searchParams.append("redirect_uri", callbackUri);
      authUrl.searchParams.append("state", state);
      authUrl.searchParams.append("access_type", "offline");
      authUrl.searchParams.append("prompt", "consent");

      console.log(
        "Configurando manejador de URI para capturar la redirección OAuth..."
      );
      const authPromise = this.setupUriHandler(
        state,
        clientId,
        clientSecret,
        apiDomain
      );

      // Log de la URL a la que intentamos redirigir
      console.log(
        `Intentando abrir URL de autorización: ${authUrl.toString()}`
      );

      try {
        // Abrir el navegador para la autorización
        await vscode.env.openExternal(vscode.Uri.parse(authUrl.toString()));
        console.log("Navegador abierto con éxito");

        vscode.window.showInformationMessage(
          "Se ha abierto una ventana del navegador para iniciar sesión en Zoho Projects. Por favor, completa el proceso en tu navegador."
        );
      } catch (openError) {
        console.error("Error al abrir navegador:", openError);
        vscode.window.showErrorMessage(
          `Error al abrir el navegador: ${
            openError instanceof Error ? openError.message : "Error desconocido"
          }`
        );
        this.clearUriHandler();
        return undefined;
      }

      // Esperamos a que se complete la autenticación
      console.log("Esperando a que se complete el proceso de autenticación...");
      const authSession = await authPromise;

      return authSession;
    } catch (error) {
      console.error("Error en el proceso de autenticación:", error);
      this.clearUriHandler();
      vscode.window.showErrorMessage(
        `Error de autenticación: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
      return undefined;
    }
  }
  /**
   * Configura el manejador de URI para capturar la redirección después de la autenticación
   */
  private setupUriHandler(
    state: string,
    clientId: string,
    clientSecret: string,
    apiDomain: string
  ): Promise<vscode.AuthenticationSession> {
    return new Promise((resolve, reject) => {
      // Asegurarnos de que no haya un manejador anterior
      this.clearUriHandler();

      console.log(
        `Registrando manejador URI para esquema: ${vscode.env.uriScheme}`
      );
      console.log(
        `Esperando redirección a: ${vscode.env.uriScheme}://zoho-projects-time-tracker/auth-callback`
      );

      // Crear un timeout para rechazar la promesa si no se recibe respuesta en 10 minutos
      const timeoutId = setTimeout(() => {
        console.log("Tiempo de espera agotado para la autenticación");
        vscode.window
          .showWarningMessage(
            "La autenticación ha expirado. Por favor, inténtalo de nuevo.",
            "Ver instrucciones"
          )
          .then((selection) => {
            if (selection === "Ver instrucciones") {
              vscode.commands.executeCommand(
                "zoho-projects-time-tracker.showAuthInstructions"
              );
            }
          });
        this.clearUriHandler();
        reject(new Error("Tiempo de espera de autenticación agotado"));
      }, 10 * 60 * 1000); // 10 minutos

      // Registrar un nuevo manejador de URI
      ZohoAuthenticationProvider.uriHandlerRegistration =
        vscode.window.registerUriHandler({
          handleUri: async (uri: vscode.Uri) => {
            // Limpiar el timeout ya que recibimos una respuesta
            clearTimeout(timeoutId);

            console.log(`URI recibido: ${uri.toString()}`);
            console.log(
              `Esquema: ${uri.scheme}, Autoridad: ${uri.authority}, Ruta: ${uri.path}, Consulta: ${uri.query}`
            );

            try {
              // Extraer code y state del URI (maneja correctamente URIs malformados)
              const { code, state: returnedState } =
                this.extractQueryParams(uri);

              console.log(`Código recibido: ${code ? "Sí" : "No"}`);
              console.log(`Estado recibido: ${returnedState}`);
              console.log(`Estado esperado: ${state}`);

              // Verificar estado para seguridad
              if (returnedState !== state) {
                console.error("El estado no coincide");
                vscode.window.showErrorMessage(
                  "Error de seguridad: El estado de la solicitud no coincide"
                );
                this.clearUriHandler();
                reject(new Error("El estado no coincide"));
                return;
              }

              if (!code) {
                console.error("No se recibió código de autorización");
                vscode.window.showErrorMessage(
                  "Error de autenticación: No se recibió el código de autorización"
                );
                this.clearUriHandler();
                reject(new Error("No se recibió código de autorización"));
                return;
              }

              vscode.window.showInformationMessage(
                "Autenticación en progreso. Procesando credenciales..."
              );

              try {
                console.log("Intercambiando código por tokens...");
                // Intercambiar código por tokens
                const tokenResponse = await axios.post(
                  "https://accounts.zoho.com/oauth/v2/token",
                  null,
                  {
                    params: {
                      grant_type: "authorization_code",
                      client_id: clientId,
                      client_secret: clientSecret,
                      code,
                      redirect_uri: `vscode://zoho-projects-time-tracker/auth-callback`,
                    },
                    headers: {
                      "Content-Type": "application/x-www-form-urlencoded",
                    },
                  }
                );

                console.log("Token recibido correctamente");
                const accessToken = tokenResponse.data.access_token;
                const refreshToken = tokenResponse.data.refresh_token;

                // Guardar tokens en secrets
                await this.context.secrets.store(
                  "zoho-access-token",
                  accessToken
                );
                await this.context.secrets.store(
                  "zoho-refresh-token",
                  refreshToken
                );

                console.log("Obteniendo información del portal...");
                // Obtener información del usuario
                const userResponse = await axios.get(
                  `${apiDomain}/api/v3/portal`,
                  {
                    headers: {
                      Authorization: `Bearer ${accessToken}`,
                    },
                  }
                );

                const userId = userResponse.data.user_id || "unknown";
                const account = userResponse.data.name || "Zoho Account";

                // Crear sesión
                const session: vscode.AuthenticationSession = {
                  accessToken,
                  account: { id: userId, label: account },
                  id: userId,
                  scopes: ZohoAuthenticationProvider.SCOPES.split(","),
                };

                this.authenticationSession = session;

                // Almacenar metadatos importantes
                this.context.globalState.update("zoho-user-id", userId);
                this.context.globalState.update("zoho-account-name", account);

                vscode.window.showInformationMessage(
                  `Se ha iniciado sesión en Zoho Projects como ${account}`
                );

                // Limpiar el manejador y resolver la promesa
                this.clearUriHandler();
                resolve(session);
              } catch (error) {
                console.error("Error al procesar token:", error); // Comprobar si es un error específico de redirección de URI
                let errorMessage =
                  error instanceof Error ? error.message : "Error desconocido";

                // Comprueba si es un error de URI de redirección no válido
                if (
                  errorMessage.includes("redirect_uri") ||
                  errorMessage.includes("redirect uri") ||
                  errorMessage.includes("redireccionamiento")
                ) {
                  const configureHint =
                    "Asegúrate de que el URI de redirección configurado en Zoho Developer Console coincide EXACTAMENTE con (incluyendo mayúsculas y minúsculas):";
                  const uriToUse = `vscode://zoho-projects-time-tracker/auth-callback`;

                  const openDocs = "Ver instrucciones";
                  const response = await vscode.window.showErrorMessage(
                    `Error en la redirección de OAuth: ${errorMessage}. ${configureHint} ${uriToUse}`,
                    openDocs
                  );

                  if (response === openDocs) {
                    await vscode.env.openExternal(
                      vscode.Uri.file(
                        "c:\\Users\\Usuario\\Documents\\zoho\\AUTENTICACION_VSCODE.md"
                      )
                    );
                  }
                } else {
                  vscode.window.showErrorMessage(
                    `Error al procesar la autenticación: ${errorMessage}`
                  );
                }
                this.clearUriHandler();
                reject(error);
              }
            } catch (error) {
              console.error("Error en el manejador de URI:", error);
              vscode.window.showErrorMessage(
                `Error en el proceso de autenticación: ${
                  error instanceof Error ? error.message : "Error desconocido"
                }`
              );
              this.clearUriHandler();
              reject(error);
            }
          },
        });
    });
  }

  /**
   * Limpia el manejador de URI
   */
  private clearUriHandler(): void {
    if (ZohoAuthenticationProvider.uriHandlerRegistration) {
      ZohoAuthenticationProvider.uriHandlerRegistration.dispose();
      ZohoAuthenticationProvider.uriHandlerRegistration = undefined;
      console.log("Manejador de URI limpiado");
    }
  }

  /**
   * Cierra sesión eliminando tokens y sesión
   */
  public async logout(): Promise<void> {
    try {
      await this.context.secrets.delete("zoho-access-token");
      await this.context.secrets.delete("zoho-refresh-token");
      this.context.globalState.update("zoho-user-id", undefined);
      this.context.globalState.update("zoho-account-name", undefined);
      this.authenticationSession = undefined;

      vscode.window.showInformationMessage(
        "Se ha cerrado la sesión de Zoho Projects"
      );
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      vscode.window.showErrorMessage(
        `Error al cerrar sesión: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
    }
  }

  /**
   * Verifica si hay una sesión activa
   */
  public async isAuthenticated(): Promise<boolean> {
    try {
      const accessToken = await this.context.secrets.get("zoho-access-token");
      return !!accessToken;
    } catch (error) {
      return false;
    }
  }

  /**
   * Obtiene el token de acceso, refrescándolo si es necesario
   */
  public async getAccessToken(): Promise<string | undefined> {
    try {
      const accessToken = await this.context.secrets.get("zoho-access-token");
      if (!accessToken) {
        return undefined;
      }

      // En una implementación completa, aquí verificaríamos si el token ha expirado
      // y lo refrescaríamos usando el refreshToken si es necesario

      return accessToken;
    } catch (error) {
      console.error("Error al obtener access token:", error);
      return undefined;
    }
  }
  /**
   * Extrae los parámetros de consulta de un URI, incluso si está malformado
   * @param uri El URI del que extraer los parámetros
   * @returns Objeto con los parámetros extraídos
   */
  private extractQueryParams(uri: vscode.Uri): {
    code: string | null;
    state: string | null;
  } {
    console.log(`Extrayendo parámetros del URI: ${uri.toString()}`);
    console.log(
      `URI scheme: ${uri.scheme}, authority: ${uri.authority}, path: ${uri.path}, query: ${uri.query}`
    );

    // Intento estándar usando URLSearchParams
    try {
      const query = new URLSearchParams(uri.query);
      const code = query.get("code");
      const state = query.get("state");

      if (code && state) {
        console.log(
          "Parámetros extraídos correctamente usando URLSearchParams"
        );
        return { code, state };
      }
    } catch (error) {
      console.error("Error al usar URLSearchParams:", error);
    }

    // Si falló el método estándar o no se encontraron los parámetros,
    // intentamos extraerlos manualmente de la cadena URI completa
    const uriString = uri.toString();
    console.log("Intentando extracción manual de parámetros");

    // Normalizar la URI para manejar diferentes formatos de redirección
    let normalizedUriString = uriString;

    // Casos comunes de URI malformadas que necesitamos manejar
    if (uriString.startsWith("https://vscode//")) {
      normalizedUriString = uriString.replace("https://vscode//", "vscode://");
      console.log(
        `URI normalizado de https://vscode// a vscode://: ${normalizedUriString}`
      );
    } else if (uriString.startsWith("http://vscode//")) {
      normalizedUriString = uriString.replace("http://vscode//", "vscode://");
      console.log(
        `URI normalizado de http://vscode// a vscode://: ${normalizedUriString}`
      );
    } else if (uriString.includes("vscode:/zoho-projects")) {
      // Manejar caso de un solo slash después de vscode:
      normalizedUriString = uriString.replace("vscode:/", "vscode://");
      console.log(
        `URI normalizado de vscode:/ a vscode://: ${normalizedUriString}`
      );
    } else if (uriString.includes("vscode:///")) {
      // Manejar caso de tres slashes
      normalizedUriString = uriString.replace("vscode:///", "vscode://");
      console.log(
        `URI normalizado de vscode:/// a vscode://: ${normalizedUriString}`
      );
    }

    // Intentar extraer los parámetros usando expresiones regulares
    const codeMatch = normalizedUriString.match(/[?&]code=([^&]+)/);
    const stateMatch = normalizedUriString.match(/[?&]state=([^&]+)/);

    const code = codeMatch ? codeMatch[1] : null;
    const state = stateMatch ? stateMatch[1] : null;

    console.log(
      `Extracción manual - código: ${code ? "encontrado" : "no encontrado"}`
    );
    console.log(
      `Extracción manual - estado: ${state ? "encontrado" : "no encontrado"}`
    );

    return { code, state };
  }
}
