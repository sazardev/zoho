# Zoho Projects Time Tracker para VS Code - Guía de Desarrollo

Esta guía te ayudará a probar y desarrollar la extensión de Zoho Projects Time Tracker localmente.

## Requisitos previos

1. Node.js y npm instalados
2. Visual Studio Code
3. Cuenta en Zoho Projects
4. Credenciales OAuth de Zoho Projects (Client ID y Client Secret)

## Configuración inicial

### Obtener credenciales OAuth

1. Dirígete a [Zoho API Console](https://api-console.zoho.com/)
2. Crea una nueva aplicación cliente para obtener:
   - Client ID
   - Client Secret
3. Configura la redirección URI a: `vscode://zoho-projects-time-tracker/auth-callback`

### Configuración del proyecto

1. Clona este repositorio
2. Ejecuta `npm install` para instalar dependencias
3. Configura tu Client ID y Client Secret en VS Code:
   - Abre Configuración (File > Preferences > Settings)
   - Busca "Zoho Projects"
   - Configura:
     - `zohoProjects.clientId`: Tu Client ID
     - `zohoProjects.clientSecret`: Tu Client Secret

## Ejecución en modo desarrollo

1. Abre el proyecto en VS Code
2. Presiona F5 para ejecutar la extensión en modo desarrollo
3. Se abrirá una nueva ventana de VS Code donde la extensión estará activa
4. Usa el comando "Zoho Projects: Iniciar sesión" para autenticarte

## Empaquetado y publicación

Para empaquetar la extensión:

```bash
npm run package
```

Esto generará un archivo `.vsix` que puedes instalar manualmente en VS Code.

Para publicar en el Marketplace de VS Code:

1. Regístrate como publisher en https://marketplace.visualstudio.com/
2. Actualiza el campo `publisher` en `package.json`
3. Ejecuta:

```bash
vsce publish
```

## Estructura del proyecto

- `src/extension.ts`: Punto de entrada de la extensión
- `src/authentication.ts`: Manejo de autenticación con Zoho Projects
- `src/api.ts`: Cliente para interactuar con la API de Zoho Projects
- `src/status-bar.ts`: Gestión de la interfaz en la barra de estado
- `src/tasks.ts`: Gestión de tareas y tiempo
- `src/views.ts`: Vistas de TreeView para mostrar tareas
