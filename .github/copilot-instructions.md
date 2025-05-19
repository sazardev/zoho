<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Zoho Projects Time Tracker - Extensión para VS Code

Este es un proyecto de extensión de VS Code para integrarse con la API de Zoho Projects.

La extensión permitirá:

- Autenticarse con Zoho Projects mediante OAuth
- Mostrar las tareas asignadas al usuario
- Iniciar, pausar y detener el registro de tiempo para las tareas
- Sincronizar los registros de tiempo con Zoho Projects

Para las consultas relacionadas con la API de VS Code, utiliza la herramienta get_vscode_api.

## Tecnologías principales

- TypeScript
- API de VS Code
- API de Zoho Projects

## Estructura del proyecto

- `src/extension.ts`: Punto de entrada de la extensión
- `src/authentication.ts`: Manejo de autenticación con Zoho Projects
- `src/api.ts`: Cliente para interactuar con la API de Zoho Projects
- `src/status-bar.ts`: Gestión de la interfaz en la barra de estado
- `src/tasks.ts`: Gestión de tareas y tiempo
- `src/views.ts`: Vistas de TreeView para mostrar tareas
