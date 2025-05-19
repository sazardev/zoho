import * as vscode from "vscode";
import axios, { AxiosInstance } from "axios";

/**
 * Interface para proyecto de Zoho
 */
export interface ZohoProject {
  id: string;
  name: string;
  status: string;
}

/**
 * Interface para tarea de Zoho
 */
export interface ZohoTask {
  id: string;
  name: string;
  status: string;
  priority: string;
  project: { id: string; name: string };
  description?: string;
  created_time?: string;
  last_updated_time?: string;
  subtasks?: ZohoTask[];
}

/**
 * Interface para registro de tiempo
 */
export interface ZohoTimeLog {
  id?: string;
  task_id: string;
  hours: number;
  minutes: number;
  work_date: string; // Formato YYYY-MM-DD
  notes?: string;
  bill_status?: "Billable" | "Non Billable";
}

/**
 * Cliente para interactuar con la API de Zoho Projects
 */
export class ZohoApiClient {
  private axiosInstance: AxiosInstance;
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
    const apiDomain =
      vscode.workspace
        .getConfiguration("zohoProjects")
        .get<string>("apiDomain") || "https://projectsapi.zoho.com";

    this.axiosInstance = axios.create({
      baseURL: apiDomain,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Obtiene los portales disponibles
   */
  public async getPortals(): Promise<any[]> {
    try {
      const response = await this.axiosInstance.get("/api/v3/portals");
      return response.data.portals || [];
    } catch (error) {
      this.handleApiError(error, "Error al obtener los portales");
      return [];
    }
  }

  /**
   * Obtiene los proyectos de un portal
   */
  public async getProjects(portalId: string): Promise<ZohoProject[]> {
    try {
      const response = await this.axiosInstance.get(
        `/api/v3/portal/${portalId}/projects`
      );
      return response.data.projects || [];
    } catch (error) {
      this.handleApiError(error, "Error al obtener los proyectos");
      return [];
    }
  }

  /**
   * Obtiene las tareas de un proyecto
   */
  public async getTasks(
    portalId: string,
    projectId: string
  ): Promise<ZohoTask[]> {
    try {
      const response = await this.axiosInstance.get(
        `/api/v3/portal/${portalId}/projects/${projectId}/tasks`
      );
      return response.data.tasks || [];
    } catch (error) {
      this.handleApiError(error, "Error al obtener las tareas");
      return [];
    }
  }

  /**
   * Obtiene las tareas asignadas al usuario actual
   */
  public async getMyTasks(portalId: string): Promise<ZohoTask[]> {
    try {
      const response = await this.axiosInstance.get(
        `/api/v3/portal/${portalId}/tasks`
      );
      return response.data.tasks || [];
    } catch (error) {
      this.handleApiError(error, "Error al obtener mis tareas");
      return [];
    }
  }

  /**
   * Inicia un temporizador para una tarea
   */
  public async startTimer(
    portalId: string,
    projectId: string,
    taskId: string
  ): Promise<any> {
    try {
      const response = await this.axiosInstance.post(
        `/api/v3/portal/${portalId}/projects/${projectId}/tasks/${taskId}/timer`
      );
      return response.data;
    } catch (error) {
      this.handleApiError(error, "Error al iniciar el temporizador");
      return null;
    }
  }

  /**
   * Pausa un temporizador para una tarea
   */
  public async pauseTimer(
    portalId: string,
    projectId: string,
    taskId: string
  ): Promise<any> {
    try {
      const response = await this.axiosInstance.put(
        `/api/v3/portal/${portalId}/projects/${projectId}/tasks/${taskId}/timer`
      );
      return response.data;
    } catch (error) {
      this.handleApiError(error, "Error al pausar el temporizador");
      return null;
    }
  }

  /**
   * Detiene un temporizador para una tarea
   */
  public async stopTimer(
    portalId: string,
    projectId: string,
    taskId: string
  ): Promise<any> {
    try {
      const response = await this.axiosInstance.delete(
        `/api/v3/portal/${portalId}/projects/${projectId}/tasks/${taskId}/timer`
      );
      return response.data;
    } catch (error) {
      this.handleApiError(error, "Error al detener el temporizador");
      return null;
    }
  }

  /**
   * Registrar tiempo manualmente
   */
  public async logTime(
    portalId: string,
    projectId: string,
    timeLog: ZohoTimeLog
  ): Promise<any> {
    try {
      const response = await this.axiosInstance.post(
        `/api/v3/portal/${portalId}/projects/${projectId}/tasks/${timeLog.task_id}/logs`,
        { time_log: timeLog }
      );
      return response.data;
    } catch (error) {
      this.handleApiError(error, "Error al registrar el tiempo");
      return null;
    }
  }

  /**
   * Maneja errores de la API de manera consistente
   */
  private handleApiError(error: any, defaultMessage: string): void {
    let errorMessage = defaultMessage;

    if (error.response) {
      // Error con respuesta del servidor
      const { data, status } = error.response;
      errorMessage = `${defaultMessage}: ${status} - ${
        data.message || "Error desconocido"
      }`;
    } else if (error.request) {
      // Error sin respuesta del servidor
      errorMessage = `${defaultMessage}: No se recibió respuesta del servidor`;
    } else {
      // Error al configurar la petición
      errorMessage = `${defaultMessage}: ${error.message}`;
    }

    vscode.window.showErrorMessage(errorMessage);
    console.error(errorMessage, error);
    throw new Error(errorMessage);
  }
}
