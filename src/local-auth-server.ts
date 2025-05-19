import * as http from "http";
import * as url from "url";
import { EventEmitter } from "events";
import * as vscode from "vscode";

/**
 * Clase para gestionar un servidor HTTP local para la autenticación OAuth
 */
export class LocalAuthServer {
  private server: http.Server | null = null;
  private readonly port: number;
  private authCodeEmitter = new EventEmitter();

  constructor(port: number = 3000) {
    this.port = port;
  }

  /**
   * Inicia el servidor HTTP local
   */
  public start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.server) {
        resolve();
        return;
      }

      this.server = http.createServer((req, res) =>
        this.handleRequest(req, res)
      );

      this.server.on("error", (err) => {
        console.error("Error al iniciar el servidor HTTP local:", err);
        reject(err);
      });

      this.server.listen(this.port, () => {
        console.log(`Servidor HTTP local escuchando en el puerto ${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Detiene el servidor HTTP local
   */
  public stop(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close(() => {
        console.log("Servidor HTTP local detenido");
        this.server = null;
        resolve();
      });
    });
  }

  /**
   * Maneja las solicitudes HTTP
   */
  private handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): void {
    console.log(`Solicitud recibida: ${req.url || ""}`);

    // Parsear la URL para obtener los parámetros
    const parsedUrl = url.parse(req.url || "", true);
    const { code, state } = parsedUrl.query;

    // Devolver una página de éxito y cerrar la ventana del navegador automáticamente
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Autenticación completada</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              max-width: 500px;
              margin: 0 auto;
              padding: 20px;
              text-align: center;
              display: flex;
              flex-direction: column;
              justify-content: center;
              height: 90vh;
            }
            h1 { color: #4caf50; }
            p { font-size: 16px; line-height: 1.5; }
            .icon {
              font-size: 64px;
              margin-bottom: 20px;
            }
          </style>
        </head>
        <body>
          <div>
            <div class="icon">✅</div>
            <h1>Autenticación completada</h1>
            <p>Has iniciado sesión correctamente en Zoho Projects. Puedes cerrar esta ventana y volver a VS Code.</p>
          </div>
          <script>
            // Cerrar esta ventana automáticamente después de 3 segundos
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
      </html>
    `);

    // Emitir el código de autorización para que el proceso de autenticación continúe
    if (code && state) {
      this.authCodeEmitter.emit("authCode", {
        code: code.toString(),
        state: state.toString(),
      });
    } else {
      console.error("No se recibió código de autorización o estado");
      this.authCodeEmitter.emit(
        "error",
        new Error("No se recibió código de autorización o estado")
      );
    }
  }

  /**
   * Espera a recibir el código de autorización
   */
  public waitForAuthCode(): Promise<{ code: string; state: string }> {
    return new Promise<{ code: string; state: string }>((resolve, reject) => {
      this.authCodeEmitter.once("authCode", resolve);
      this.authCodeEmitter.once("error", reject);
    });
  }

  /**
   * Obtiene la URL de redirección para la autenticación OAuth
   */
  public getRedirectUri(): string {
    return `http://localhost:${this.port}/auth-callback`;
  }
}
