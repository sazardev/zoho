import * as vscode from "vscode";
import * as moment from "moment";
import { ZohoApiClient, ZohoTask, ZohoProject, ZohoTimeLog } from "./api";

/**
 * Maneja las tareas y el registro de tiempo
 */
export class TasksManager {
  private apiClient: ZohoApiClient | undefined;
  private portalId: string | undefined;
  private projects: ZohoProject[] = [];
  private tasks: ZohoTask[] = [];
  private currentTimer:
    | {
        taskId: string;
        projectId: string;
        startTime: Date;
        isPaused: boolean;
        pausedAt?: Date;
        totalPausedMs: number;
      }
    | undefined;

  constructor() {}

  /**
   * Inicializa el cliente de API con un token de acceso
   */
  public initialize(accessToken: string): void {
    this.apiClient = new ZohoApiClient(accessToken);
  }

  /**
   * Carga la información inicial del portal y los proyectos
   */
  public async loadInitialData(): Promise<boolean> {
    if (!this.apiClient) {
      vscode.window.showErrorMessage("No se ha inicializado el cliente de API");
      return false;
    }

    try {
      // Obtener portales
      const portals = await this.apiClient.getPortals();
      if (!portals || portals.length === 0) {
        vscode.window.showWarningMessage(
          "No se encontraron portales disponibles"
        );
        return false;
      }

      // Si hay más de un portal, mostrar selector
      if (portals.length > 1) {
        const portalOptions = portals.map((p) => ({
          label: p.name,
          detail: p.id,
          id: p.id,
        }));

        const selectedPortal = await vscode.window.showQuickPick(
          portalOptions,
          {
            placeHolder: "Selecciona un portal",
          }
        );

        if (!selectedPortal) {
          return false;
        }

        this.portalId = selectedPortal.id;
      } else {
        this.portalId = portals[0].id;
      }

      // Cargar proyectos del portal
      if (this.portalId) {
        this.projects = await this.apiClient.getProjects(this.portalId);
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error al cargar datos iniciales:", error);
      vscode.window.showErrorMessage(
        `Error al cargar datos iniciales: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
      return false;
    }
  }

  /**
   * Carga las tareas asignadas al usuario actual
   */
  public async loadMyTasks(): Promise<ZohoTask[]> {
    if (!this.apiClient || !this.portalId) {
      vscode.window.showErrorMessage("No se ha inicializado correctamente");
      return [];
    }

    try {
      this.tasks = await this.apiClient.getMyTasks(this.portalId);
      return this.tasks;
    } catch (error) {
      console.error("Error al cargar tareas:", error);
      vscode.window.showErrorMessage(
        `Error al cargar tareas: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
      return [];
    }
  }

  /**
   * Obtiene los proyectos cargados
   */
  public getProjects(): ZohoProject[] {
    return this.projects;
  }

  /**
   * Obtiene las tareas cargadas
   */
  public getTasks(): ZohoTask[] {
    return this.tasks;
  }

  /**
   * Inicia un temporizador para una tarea
   */
  public async startTimer(taskId: string): Promise<boolean> {
    if (!this.apiClient || !this.portalId) {
      vscode.window.showErrorMessage("No se ha inicializado correctamente");
      return false;
    }

    try {
      // Buscar la tarea y su proyecto
      const task = this.findTaskById(taskId);
      if (!task) {
        vscode.window.showErrorMessage("No se encontró la tarea seleccionada");
        return false;
      }

      const projectId = task.project.id;

      // Si hay un temporizador existente pausado, reanudar
      if (
        this.currentTimer &&
        this.currentTimer.taskId === taskId &&
        this.currentTimer.isPaused
      ) {
        this.currentTimer.isPaused = false;
        if (this.currentTimer.pausedAt) {
          this.currentTimer.totalPausedMs +=
            new Date().getTime() - this.currentTimer.pausedAt.getTime();
          this.currentTimer.pausedAt = undefined;
        }
        return true;
      }

      // Iniciar nuevo temporizador
      const result = await this.apiClient.startTimer(
        this.portalId,
        projectId,
        taskId
      );
      if (result) {
        this.currentTimer = {
          taskId,
          projectId,
          startTime: new Date(),
          isPaused: false,
          totalPausedMs: 0,
        };
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error al iniciar temporizador:", error);
      vscode.window.showErrorMessage(
        `Error al iniciar temporizador: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
      return false;
    }
  }

  /**
   * Pausa el temporizador actual
   */
  public async pauseTimer(): Promise<boolean> {
    if (!this.apiClient || !this.portalId || !this.currentTimer) {
      vscode.window.showErrorMessage("No hay un temporizador activo");
      return false;
    }

    if (this.currentTimer.isPaused) {
      vscode.window.showWarningMessage("El temporizador ya está pausado");
      return false;
    }

    try {
      const result = await this.apiClient.pauseTimer(
        this.portalId,
        this.currentTimer.projectId,
        this.currentTimer.taskId
      );

      if (result) {
        this.currentTimer.isPaused = true;
        this.currentTimer.pausedAt = new Date();
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error al pausar temporizador:", error);
      vscode.window.showErrorMessage(
        `Error al pausar temporizador: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
      return false;
    }
  }

  /**
   * Detiene el temporizador actual y registra el tiempo
   */
  public async stopTimer(): Promise<boolean> {
    if (!this.apiClient || !this.portalId || !this.currentTimer) {
      vscode.window.showErrorMessage("No hay un temporizador activo");
      return false;
    }

    try {
      const result = await this.apiClient.stopTimer(
        this.portalId,
        this.currentTimer.projectId,
        this.currentTimer.taskId
      );

      if (result) {
        // Calcular tiempo transcurrido
        const now = new Date();
        const totalMs =
          now.getTime() -
          this.currentTimer.startTime.getTime() -
          this.currentTimer.totalPausedMs;
        const totalMinutes = Math.floor(totalMs / (1000 * 60));

        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60; // Registrar el tiempo
        const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD formato

        const timeLog: ZohoTimeLog = {
          task_id: this.currentTimer.taskId,
          hours,
          minutes,
          work_date: today,
          bill_status: "Billable",
          notes: `Tiempo registrado automáticamente por VS Code Extension`,
        };

        await this.apiClient.logTime(
          this.portalId,
          this.currentTimer.projectId,
          timeLog
        );

        // Limpiar temporizador
        this.currentTimer = undefined;

        return true;
      }

      return false;
    } catch (error) {
      console.error("Error al detener temporizador:", error);
      vscode.window.showErrorMessage(
        `Error al detener temporizador: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
      return false;
    }
  }

  /**
   * Obtiene el tiempo transcurrido del temporizador actual en formato HH:MM:SS
   */
  public getCurrentTimerElapsed(): string {
    if (!this.currentTimer) {
      return "00:00:00";
    }

    const now = new Date();
    let totalMs =
      now.getTime() -
      this.currentTimer.startTime.getTime() -
      this.currentTimer.totalPausedMs;

    if (this.currentTimer.isPaused && this.currentTimer.pausedAt) {
      totalMs -= now.getTime() - this.currentTimer.pausedAt.getTime();
    }

    const totalSeconds = Math.floor(totalMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  /**
   * Obtiene la tarea actual del temporizador
   */
  public getCurrentTimerTask(): ZohoTask | undefined {
    if (!this.currentTimer) {
      return undefined;
    }

    return this.findTaskById(this.currentTimer.taskId);
  }

  /**
   * Estado del temporizador
   */
  public getTimerStatus(): "running" | "paused" | "stopped" {
    if (!this.currentTimer) {
      return "stopped";
    }

    return this.currentTimer.isPaused ? "paused" : "running";
  }

  /**
   * Busca una tarea por su ID
   */
  private findTaskById(taskId: string): ZohoTask | undefined {
    // Buscar en tareas principales
    const task = this.tasks.find((t) => t.id === taskId);
    if (task) {
      return task;
    }

    // Buscar en subtareas
    for (const parentTask of this.tasks) {
      if (parentTask.subtasks) {
        const subtask = parentTask.subtasks.find((st) => st.id === taskId);
        if (subtask) {
          return subtask;
        }
      }
    }

    return undefined;
  }
}
