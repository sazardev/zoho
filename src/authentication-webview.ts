import * as vscode from "vscode";
import axios from "axios";
import { AuthWebviewProvider } from "./auth-webview-provider";

/**
 * Gestiona la autenticación con Zoho Projects mediante OAuth 2.0 usando WebView
 */
export class ZohoAuthenticationProvider {
  private static readonly AUTH_TYPE = "zoho-projects";
  private static readonly AUTH_NAME = "Zoho Projects";
  private static readonly SCOPES =
    "ZohoProjects.portals.READ,ZohoProjects.projects.READ,ZohoProjects.tasks.READ,ZohoProjects.tasks.CREATE,ZohoProjects.timesheets.READ,ZohoProjects.timesheets.CREATE,ZohoProjects.timesheets.UPDATE,ZohoProjects.timesheets.DELETE";

  private authenticationSession: vscode.AuthenticationSession | undefined;
  private context: vscode.ExtensionContext;
  private webviewProvider: AuthWebviewProvider;
  private isAuthenticating: boolean = false;

  constructor(
    context: vscode.ExtensionContext,
    webviewProvider: AuthWebviewProvider
  ) {
    this.context = context;
    this.webviewProvider = webviewProvider;
  }

  /**
   * Inicia el proceso de autenticación usando WebView
   */
  public async login(): Promise<vscode.AuthenticationSession | undefined> {
    try {
      console.log(
        "Iniciando proceso de autenticación con Zoho Projects (WebView)"
      );

      // Verificar si ya hay un proceso de autenticación en curso
      if (this.isAuthenticating) {
        console.log(
          "Proceso de autenticación ya en curso, deteniendo intento adicional"
        );
        vscode.window.showInformationMessage(
          "Ya hay un proceso de autenticación en curso. Por favor, completa ese proceso primero."
        );
        return undefined;
      }

      this.isAuthenticating = true;

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

        this.isAuthenticating = false;
        return undefined;
      }

      try {
        console.log("Iniciando autenticación manual con WebView");
        vscode.window.showInformationMessage(
          "Se abrirá una vista para autenticación manual con Zoho Projects. Sigue las instrucciones para completar el proceso."
        ); // Usar el webview provider para iniciar el proceso de autenticación
        const { code, state } = await this.webviewProvider.startAuth(clientId);

        console.log(`Código de autorización recibido: ${code ? "Sí" : "No"}`);
        console.log(`Estado recibido: ${state}`);

        if (!code) {
          throw new Error("No se recibió código de autorización");
        }
        console.log("Intercambiando código por tokens..."); // URI de redirección que se envía a Zoho (debe coincidir EXACTAMENTE con lo configurado en la consola de desarrollador)
        // Esto es crucial: debe ser exactamente el mismo valor que se configuró en la consola de Zoho Developer
        const redirectUri = `vscode://zoho-projects-time-tracker/auth-callback`;

        console.log(
          `Usando URI de redirección para intercambio de token: ${redirectUri}`
        );

        // Intercambiar código por tokens
        console.log("Realizando solicitud de token...");

        const tokenResponse = await axios.post(
          "https://accounts.zoho.com/oauth/v2/token",
          null,
          {
            params: {
              grant_type: "authorization_code",
              client_id: clientId,
              client_secret: clientSecret,
              code,
              redirect_uri: redirectUri,
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
        await this.context.secrets.store("zoho-access-token", accessToken);
        await this.context.secrets.store("zoho-refresh-token", refreshToken);

        console.log("Obteniendo información del portal...");
        // Obtener información del usuario
        const userResponse = await axios.get(`${apiDomain}/api/v3/portal`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

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

        this.isAuthenticating = false;
        return session;
      } catch (error) {
        console.error("Error durante el proceso de autenticación:", error);

        let errorMessage =
          error instanceof Error ? error.message : "Error desconocido";

        // Comprobar si es un error específico de redirección de URI
        if (
          errorMessage.includes("redirect_uri") ||
          errorMessage.includes("redirect uri") ||
          errorMessage.includes("redireccionamiento")
        ) {
          vscode.window.showErrorMessage(
            `Error en la redirección de OAuth: ${errorMessage}. Asegúrate de que el URI de redirección configurado en Zoho Developer Console coincide exactamente con: vscode://zoho-projects-time-tracker/auth-callback`
          );
        } else {
          vscode.window.showErrorMessage(
            `Error en el proceso de autenticación: ${errorMessage}`
          );
        }

        this.isAuthenticating = false;
        return undefined;
      }
    } catch (error) {
      console.error("Error en el proceso de autenticación:", error);
      vscode.window.showErrorMessage(
        `Error de autenticación: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
      this.isAuthenticating = false;
      return undefined;
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
}
