import * as vscode from "vscode";
import { ZohoTask, ZohoProject } from "./api";

/**
 * Clase para mostrar tareas en un TreeView
 */
export class TasksProvider implements vscode.TreeDataProvider<TaskTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    TaskTreeItem | undefined | null | void
  > = new vscode.EventEmitter<TaskTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    TaskTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private tasks: ZohoTask[] = [];
  private projects: Map<string, ZohoProject> = new Map();

  constructor() {}

  /**
   * Refresca los datos del TreeView
   */
  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Establece las tareas y proyectos a mostrar
   */
  public setData(tasks: ZohoTask[], projects: ZohoProject[]): void {
    this.tasks = tasks;
    this.projects.clear();
    projects.forEach((project) => {
      this.projects.set(project.id, project);
    });
    this.refresh();
  }

  /**
   * Obtiene todos los elementos o hijos de un elemento
   */
  getChildren(element?: TaskTreeItem): Thenable<TaskTreeItem[]> {
    if (!element) {
      // Nivel raíz - Agrupar por proyecto
      const projectMap = new Map<string, ZohoTask[]>();

      for (const task of this.tasks) {
        const projectId = task.project.id;
        if (!projectMap.has(projectId)) {
          projectMap.set(projectId, []);
        }
        projectMap.get(projectId)?.push(task);
      }

      const projects: TaskTreeItem[] = [];

      projectMap.forEach((tasks, projectId) => {
        const project = this.projects.get(projectId) || {
          id: projectId,
          name: "Proyecto desconocido",
          status: "unknown",
        };
        projects.push(
          new TaskTreeItem(
            project.name,
            "",
            vscode.TreeItemCollapsibleState.Expanded,
            "project",
            { projectId }
          )
        );
      });

      return Promise.resolve(projects);
    } else if (element.contextValue === "project") {
      // Nivel de proyecto - Mostrar tareas del proyecto
      const projectId = element.meta?.projectId;
      if (!projectId) {
        return Promise.resolve([]);
      }

      const projectTasks = this.tasks.filter(
        (task) => task.project.id === projectId
      );
      return Promise.resolve(
        projectTasks.map(
          (task) =>
            new TaskTreeItem(
              task.name,
              this.getTaskStatusText(task.status),
              task.subtasks && task.subtasks.length > 0
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None,
              "task",
              { taskId: task.id, projectId: task.project.id }
            )
        )
      );
    } else if (element.contextValue === "task" && element.meta?.taskId) {
      // Nivel de subtareas - Mostrar subtareas si existen
      const task = this.findTaskById(element.meta.taskId);
      if (task && task.subtasks && task.subtasks.length > 0) {
        return Promise.resolve(
          task.subtasks.map(
            (subtask) =>
              new TaskTreeItem(
                subtask.name,
                this.getTaskStatusText(subtask.status),
                vscode.TreeItemCollapsibleState.None,
                "subtask",
                {
                  taskId: subtask.id,
                  projectId: task.project.id,
                  parentTaskId: task.id,
                }
              )
          )
        );
      }
    }

    return Promise.resolve([]);
  }

  /**
   * Obtiene un elemento específico
   */
  getTreeItem(element: TaskTreeItem): vscode.TreeItem {
    return element;
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

  /**
   * Obtiene el texto de estado para una tarea
   */
  private getTaskStatusText(status: string): string {
    switch (status.toLowerCase()) {
      case "open":
        return "Abierta";
      case "in progress":
        return "En progreso";
      case "completed":
        return "Completada";
      case "deferred":
        return "Pospuesta";
      case "closed":
        return "Cerrada";
      default:
        return status;
    }
  }

  /**
   * Obtiene el icono para un estado de tarea
   */
  private getTaskStatusIcon(
    status: string
  ): { light: string; dark: string } | undefined {
    // En una implementación completa, aquí se retornarían rutas a iconos según el estado
    return undefined;
  }
}

/**
 * Clase que representa un ítem en el TreeView de tareas
 */
export class TaskTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly description: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    public readonly meta?: {
      taskId?: string;
      projectId?: string;
      parentTaskId?: string;
    }
  ) {
    super(label, collapsibleState);

    // Configurar el ícono según el tipo de ítem
    switch (contextValue) {
      case "project":
        this.iconPath = new vscode.ThemeIcon("project");
        break;
      case "task":
        this.iconPath = new vscode.ThemeIcon("task");
        break;
      case "subtask":
        this.iconPath = new vscode.ThemeIcon("list-tree");
        break;
    }

    // Configurar comando al hacer clic
    if (contextValue === "task" || contextValue === "subtask") {
      this.command = {
        title: "Ver detalles de tarea",
        command: "zoho-projects-time-tracker.showTaskDetails",
        arguments: [this.meta],
      };
    }
  }
}

/**
 * Clase para mostrar el temporizador activo en un TreeView
 */
export class TimerProvider implements vscode.TreeDataProvider<TimerTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    TimerTreeItem | undefined | null | void
  > = new vscode.EventEmitter<TimerTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    TimerTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private currentTask: ZohoTask | undefined;
  private timerStatus: "running" | "paused" | "stopped" = "stopped";
  private startTime: Date | undefined;
  private elapsedTime: string = "00:00:00";

  constructor() {}

  /**
   * Refresca los datos del TreeView
   */
  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Actualiza el estado del temporizador
   */
  public updateTimer(
    task: ZohoTask | undefined,
    status: "running" | "paused" | "stopped",
    elapsed: string = "00:00:00"
  ): void {
    this.currentTask = task;
    this.timerStatus = status;
    this.elapsedTime = elapsed;

    if (status === "running") {
      this.startTime = new Date();
    } else {
      this.startTime = undefined;
    }

    this.refresh();
  }

  /**
   * Obtiene los elementos a mostrar
   */
  getChildren(element?: TimerTreeItem): Thenable<TimerTreeItem[]> {
    if (!element) {
      const items: TimerTreeItem[] = [];

      if (this.currentTask) {
        // Información del temporizador
        const statusText =
          this.timerStatus === "running"
            ? "En ejecución"
            : this.timerStatus === "paused"
            ? "Pausado"
            : "Detenido";

        items.push(
          new TimerTreeItem(
            "Tarea",
            this.currentTask.name,
            vscode.TreeItemCollapsibleState.None,
            "timer-task"
          )
        );

        items.push(
          new TimerTreeItem(
            "Proyecto",
            this.currentTask.project.name,
            vscode.TreeItemCollapsibleState.None,
            "timer-project"
          )
        );

        items.push(
          new TimerTreeItem(
            "Estado",
            statusText,
            vscode.TreeItemCollapsibleState.None,
            "timer-status"
          )
        );

        items.push(
          new TimerTreeItem(
            "Tiempo",
            this.elapsedTime,
            vscode.TreeItemCollapsibleState.None,
            "timer-elapsed"
          )
        );

        // Botones de acción según el estado
        if (this.timerStatus === "running") {
          items.push(
            new TimerTreeItem(
              "Pausar",
              "",
              vscode.TreeItemCollapsibleState.None,
              "timer-pause"
            )
          );
          items.push(
            new TimerTreeItem(
              "Detener",
              "",
              vscode.TreeItemCollapsibleState.None,
              "timer-stop"
            )
          );
        } else if (this.timerStatus === "paused") {
          items.push(
            new TimerTreeItem(
              "Continuar",
              "",
              vscode.TreeItemCollapsibleState.None,
              "timer-resume"
            )
          );
          items.push(
            new TimerTreeItem(
              "Detener",
              "",
              vscode.TreeItemCollapsibleState.None,
              "timer-stop"
            )
          );
        } else {
          items.push(
            new TimerTreeItem(
              "Iniciar nuevo",
              "",
              vscode.TreeItemCollapsibleState.None,
              "timer-start"
            )
          );
        }
      } else {
        // No hay temporizador activo
        items.push(
          new TimerTreeItem(
            "No hay temporizador activo",
            "Selecciona una tarea para iniciar",
            vscode.TreeItemCollapsibleState.None,
            "timer-none"
          )
        );
      }

      return Promise.resolve(items);
    }

    return Promise.resolve([]);
  }

  /**
   * Obtiene un elemento específico
   */
  getTreeItem(element: TimerTreeItem): vscode.TreeItem {
    return element;
  }
}

/**
 * Clase que representa un ítem en el TreeView del temporizador
 */
export class TimerTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly description: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string
  ) {
    super(label, collapsibleState);

    // Configurar comando al hacer clic según el tipo
    switch (contextValue) {
      case "timer-pause":
        this.command = {
          title: "Pausar temporizador",
          command: "zoho-projects-time-tracker.pauseTimer",
        };
        this.iconPath = new vscode.ThemeIcon("debug-pause");
        break;
      case "timer-resume":
      case "timer-start":
        this.command = {
          title: "Iniciar temporizador",
          command: "zoho-projects-time-tracker.startTimer",
        };
        this.iconPath = new vscode.ThemeIcon("play");
        break;
      case "timer-stop":
        this.command = {
          title: "Detener temporizador",
          command: "zoho-projects-time-tracker.stopTimer",
        };
        this.iconPath = new vscode.ThemeIcon("debug-stop");
        break;
      case "timer-elapsed":
        this.iconPath = new vscode.ThemeIcon("clock");
        break;
      case "timer-status":
        if (this.description === "En ejecución") {
          this.iconPath = new vscode.ThemeIcon("run");
        } else if (this.description === "Pausado") {
          this.iconPath = new vscode.ThemeIcon("debug-pause");
        } else {
          this.iconPath = new vscode.ThemeIcon("stop");
        }
        break;
      case "timer-task":
        this.iconPath = new vscode.ThemeIcon("task");
        break;
      case "timer-project":
        this.iconPath = new vscode.ThemeIcon("project");
        break;
    }
  }
}
