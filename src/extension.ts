// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { ZohoAuthenticationProvider } from "./authentication";
import { ZohoStatusBar } from "./status-bar";
import { TasksProvider, TimerProvider, TaskTreeItem } from "./views";
import { TasksManager } from "./tasks";
import * as path from "path";

// Variables globales para mantener instancias
let authProvider: ZohoAuthenticationProvider;
let tasksManager: TasksManager;
let statusBar: ZohoStatusBar;
let tasksProvider: TasksProvider;
let timerProvider: TimerProvider;
let timerInterval: NodeJS.Timeout | undefined;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log('La extensión "zoho-projects-time-tracker" está activa!');

  // Inicializar proveedores y manejadores
  authProvider = new ZohoAuthenticationProvider(context);
  tasksManager = new TasksManager();
  statusBar = new ZohoStatusBar();

  // Crear vistas de árbol
  tasksProvider = new TasksProvider();
  timerProvider = new TimerProvider();

  // Registrar TreeViews
  const tasksTreeView = vscode.window.createTreeView("zohoProjectsTasks", {
    treeDataProvider: tasksProvider,
  });

  const timerTreeView = vscode.window.createTreeView("zohoProjectsTimer", {
    treeDataProvider: timerProvider,
  });

  // Actualizar el estado del temporizador periódicamente
  timerInterval = setInterval(() => {
    if (tasksManager.getTimerStatus() !== "stopped") {
      updateTimerView();
    }
  }, 1000);

  // Comandos de autenticación
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "zoho-projects-time-tracker.login",
      async () => {
        const session = await authProvider.login();
        if (session) {
          const accessToken = session.accessToken;
          tasksManager.initialize(accessToken);

          const success = await tasksManager.loadInitialData();
          if (success) {
            await refreshTasks();
            vscode.window.showInformationMessage(
              "Conectado exitosamente a Zoho Projects"
            );
          }
        }
      }
    )
  );

  // Añadir comando para abrir instrucciones de autenticación
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "zoho-projects-time-tracker.showAuthInstructions",
      async () => {
        const docPath = path.join(
          context.extensionPath,
          "AUTENTICACION_VSCODE.md"
        );
        const uri = vscode.Uri.file(docPath);
        try {
          await vscode.commands.executeCommand("markdown.showPreview", uri);
          vscode.window.showInformationMessage(
            "Instrucciones de autenticación abiertas"
          );
        } catch (error) {
          console.error("Error al abrir instrucciones:", error);
          vscode.env.openExternal(uri);
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "zoho-projects-time-tracker.logout",
      async () => {
        await authProvider.logout();
        resetState();
        vscode.window.showInformationMessage(
          "Se ha cerrado la sesión de Zoho Projects"
        );
      }
    )
  );

  // Comando para actualizar tareas
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "zoho-projects-time-tracker.refreshTasks",
      async () => {
        await refreshTasks();
      }
    )
  );

  // Comandos para el temporizador
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "zoho-projects-time-tracker.startTimer",
      async () => {
        // Si hay un temporizador en curso, continuarlo
        const timerStatus = tasksManager.getTimerStatus();
        if (timerStatus === "paused") {
          const task = tasksManager.getCurrentTimerTask();
          if (task) {
            const success = await tasksManager.startTimer(task.id);
            if (success) {
              statusBar.start(task);
              updateTimerView();
              vscode.window.showInformationMessage(
                `Temporizador reanudado para: ${task.name}`
              );
            }
          }
          return;
        }

        // Si no hay temporizador o está detenido, seleccionar tarea
        const tasks = tasksManager.getTasks();
        if (!tasks || tasks.length === 0) {
          vscode.window.showWarningMessage(
            "No hay tareas disponibles. Actualiza las tareas primero."
          );
          return;
        }

        const taskItems = tasks.map((task) => ({
          label: task.name,
          description: task.project.name,
          task: task,
        }));

        const selectedTask = await vscode.window.showQuickPick(taskItems, {
          placeHolder: "Selecciona una tarea para iniciar el temporizador",
        });

        if (selectedTask) {
          const success = await tasksManager.startTimer(selectedTask.task.id);
          if (success) {
            statusBar.start(selectedTask.task);
            updateTimerView();
            vscode.window.showInformationMessage(
              `Temporizador iniciado para: ${selectedTask.task.name}`
            );
          }
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "zoho-projects-time-tracker.pauseTimer",
      async () => {
        const success = await tasksManager.pauseTimer();
        if (success) {
          statusBar.pause();
          updateTimerView();
          vscode.window.showInformationMessage("Temporizador pausado");
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "zoho-projects-time-tracker.stopTimer",
      async () => {
        const success = await tasksManager.stopTimer();
        if (success) {
          const timerData = statusBar.stop();
          updateTimerView();
          vscode.window.showInformationMessage(
            `Temporizador detenido. Tiempo registrado: ${
              timerData?.hours || 0
            }h ${timerData?.minutes || 0}m ${timerData?.seconds || 0}s`
          );
        }
      }
    )
  );

  // Comando para mostrar detalles de tarea
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "zoho-projects-time-tracker.showTaskDetails",
      async (taskMeta: any) => {
        if (!taskMeta || !taskMeta.taskId) {
          vscode.window.showWarningMessage(
            "No se pudo obtener información de la tarea"
          );
          return;
        }

        const task = tasksManager
          .getTasks()
          .find((t) => t.id === taskMeta.taskId);
        if (task) {
          const detailsPanel = vscode.window.createWebviewPanel(
            "taskDetails",
            `Tarea: ${task.name}`,
            vscode.ViewColumn.One,
            {}
          );

          detailsPanel.webview.html = getTaskDetailsHtml(task);
        } else {
          vscode.window.showWarningMessage(
            "No se encontró la tarea seleccionada"
          );
        }
      }
    )
  );

  // Handle clicking on task items in the tree view
  tasksTreeView.onDidChangeSelection(async (e) => {
    if (e.selection.length > 0) {
      const item = e.selection[0];
      if (
        (item.contextValue === "task" || item.contextValue === "subtask") &&
        item.meta?.taskId
      ) {
        // Mostrar opciones para la tarea
        const options = ["Ver detalles", "Iniciar temporizador"];
        const choice = await vscode.window.showQuickPick(options, {
          placeHolder: `Selecciona una acción para: ${item.label}`,
        });

        if (choice === "Ver detalles") {
          vscode.commands.executeCommand(
            "zoho-projects-time-tracker.showTaskDetails",
            item.meta
          );
        } else if (choice === "Iniciar temporizador") {
          const task = tasksManager
            .getTasks()
            .find((t) => t.id === item.meta?.taskId);
          if (task) {
            const success = await tasksManager.startTimer(task.id);
            if (success) {
              statusBar.start(task);
              updateTimerView();
              vscode.window.showInformationMessage(
                `Temporizador iniciado para: ${task.name}`
              );
            }
          }
        }
      }
    }
  });

  // Agregar al contexto de suscripciones
  context.subscriptions.push(statusBar);
  context.subscriptions.push(tasksTreeView);
  context.subscriptions.push(timerTreeView);

  // Verificar autenticación al iniciar
  checkAuthentication();
}

// Método para refrescar las tareas
async function refreshTasks(): Promise<void> {
  const tasks = await tasksManager.loadMyTasks();
  if (tasks.length > 0) {
    tasksProvider.setData(tasks, tasksManager.getProjects());
    vscode.window.showInformationMessage(`Se cargaron ${tasks.length} tareas`);
  } else {
    vscode.window.showInformationMessage("No se encontraron tareas asignadas");
  }
}

// Actualizar vista del temporizador
function updateTimerView(): void {
  const task = tasksManager.getCurrentTimerTask();
  const status = tasksManager.getTimerStatus();
  const elapsed = tasksManager.getCurrentTimerElapsed();
  timerProvider.updateTimer(task, status, elapsed);
}

// Resetear el estado de la extensión
function resetState(): void {
  tasksProvider.setData([], []);
  timerProvider.updateTimer(undefined, "stopped");
  statusBar.stop();
}

// Verificar autenticación al inicio
async function checkAuthentication(): Promise<void> {
  const isAuthenticated = await authProvider.isAuthenticated();
  if (isAuthenticated) {
    const accessToken = await authProvider.getAccessToken();
    if (accessToken) {
      tasksManager.initialize(accessToken);
      const success = await tasksManager.loadInitialData();
      if (success) {
        await refreshTasks();
        vscode.window.showInformationMessage("Conectado a Zoho Projects");
      }
    }
  } else {
    // Mostrar mensaje para iniciar sesión
    const loginNow = "Iniciar sesión";
    const response = await vscode.window.showInformationMessage(
      "Necesitas iniciar sesión en Zoho Projects para usar esta extensión",
      loginNow
    );

    if (response === loginNow) {
      vscode.commands.executeCommand("zoho-projects-time-tracker.login");
    }
  }
}

// Generar HTML para detalles de tarea
function getTaskDetailsHtml(task: any): string {
  return `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Detalles de Tarea</title>
			<style>
				body {
					font-family: var(--vscode-font-family);
					padding: 20px;
					color: var(--vscode-foreground);
				}
				h1 {
					color: var(--vscode-editor-foreground);
					border-bottom: 1px solid var(--vscode-panel-border);
					padding-bottom: 10px;
				}
				.info-grid {
					display: grid;
					grid-template-columns: 120px auto;
					gap: 8px;
					margin-top: 20px;
				}
				.label {
					font-weight: bold;
					color: var(--vscode-editor-foreground);
				}
				.description {
					margin-top: 20px;
					padding: 10px;
					background: var(--vscode-editor-background);
					border: 1px solid var(--vscode-panel-border);
					border-radius: 5px;
				}
			</style>
		</head>
		<body>
			<h1>${task.name}</h1>
			
			<div class="info-grid">
				<div class="label">Proyecto:</div>
				<div>${task.project.name}</div>
				
				<div class="label">Estado:</div>
				<div>${task.status || "No especificado"}</div>
				
				<div class="label">Prioridad:</div>
				<div>${task.priority || "No especificada"}</div>
				
				<div class="label">Creada:</div>
				<div>${task.created_time || "No especificado"}</div>
				
				<div class="label">Actualizada:</div>
				<div>${task.last_updated_time || "No especificado"}</div>
			</div>
			
			<div class="description">
				<div class="label">Descripción:</div>
				<div>${task.description || "Sin descripción"}</div>
			</div>
		</body>
		</html>
	`;
}

// This method is called when your extension is deactivated
export function deactivate() {
  if (timerInterval) {
    clearInterval(timerInterval);
  }
}
