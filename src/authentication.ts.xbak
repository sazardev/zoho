import * as vscode from "vscode";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { LocalAuthServer } from "./local-auth-server";

/**
 * Gestiona la autenticación con Zoho Projects mediante OAuth 2.0
 */
export class ZohoAuthenticationProvider {
  private static readonly AUTH_TYPE = "zoho-projects";
  private static readonly AUTH_NAME = "Zoho Projects";
  private static readonly SCOPES =
    "ZohoProjects.portals.READ,ZohoProjects.projects.READ,ZohoProjects.tasks.READ,ZohoProjects.tasks.CREATE,ZohoProjects.timesheets.READ,ZohoProjects.timesheets.CREATE,ZohoProjects.timesheets.UPDATE,ZohoProjects.timesheets.DELETE";

  // Variable para el servidor local
  private localAuthServer: LocalAuthServer | null = null;

  private authenticationSession: vscode.AuthenticationSession | undefined;
  private context: vscode.ExtensionContext;
  private isAuthenticating = false;

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

      // Generar estado para prevenir CSRF
      const state = uuidv4();

      // Iniciar servidor local para OAuth
      this.localAuthServer = new LocalAuthServer();
      await this.localAuthServer.start();

      // URI de redirección usando localhost
      const callbackUri = this.localAuthServer.getRedirectUri();
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
        await this.cleanupLocalServer();
        this.isAuthenticating = false;
        return undefined;
      }

      // Esperamos a que se complete la autenticación
      console.log("Esperando a que se complete el proceso de autenticación...");
      try {
        const { code, state: returnedState } =
          await this.localAuthServer.waitForAuthCode();

        console.log(`Código recibido: ${code ? "Sí" : "No"}`);
        console.log(`Estado recibido: ${returnedState}`);
        console.log(`Estado esperado: ${state}`);

        // Verificar estado para seguridad
        if (returnedState !== state) {
          console.error("El estado no coincide");
          vscode.window.showErrorMessage(
            "Error de seguridad: El estado de la solicitud no coincide"
          );
          await this.cleanupLocalServer();
          this.isAuthenticating = false;
          return undefined;
        }

        if (!code) {
          console.error("No se recibió código de autorización");
          vscode.window.showErrorMessage(
            "Error de autenticación: No se recibió el código de autorización"
          );
          await this.cleanupLocalServer();
          this.isAuthenticating = false;
          return undefined;
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
                redirect_uri: callbackUri,
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

          await this.cleanupLocalServer();
          this.isAuthenticating = false;
          return session;
        } catch (error) {
          console.error("Error al procesar token:", error);
          // Comprobar si es un error específico de redirección de URI
          let errorMessage =
            error instanceof Error ? error.message : "Error desconocido";

          // Comprueba si es un error de URI de redirección no válido
          if (
            errorMessage.includes("redirect_uri") ||
            errorMessage.includes("redirect uri")
          ) {
            vscode.window.showErrorMessage(
              `Error en la redirección de OAuth: ${errorMessage}. Asegúrate de que el URI de redirección configurado en Zoho Developer Console coincide exactamente con: ${callbackUri}`
            );
          } else {
            vscode.window.showErrorMessage(
              `Error al procesar la autenticación: ${errorMessage}`
            );
          }

          await this.cleanupLocalServer();
          this.isAuthenticating = false;
          return undefined;
        }
      } catch (error) {
        console.error("Error durante el proceso de autenticación:", error);
        vscode.window.showErrorMessage(
          `Error en el proceso de autenticación: ${
            error instanceof Error ? error.message : "Error desconocido"
          }`
        );
        await this.cleanupLocalServer();
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
   * Limpia el servidor local
   */
  private async cleanupLocalServer(): Promise<void> {
    if (this.localAuthServer) {
      await this.localAuthServer.stop();
      this.localAuthServer = null;
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
