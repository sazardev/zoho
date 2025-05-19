# Configuración de autenticación para Zoho Projects Time Tracker

Este documento proporciona instrucciones para configurar correctamente la autenticación OAuth con Zoho Projects.

## Configuración en la consola de desarrollo de Zoho

Para utilizar la extensión, debes configurar la aplicación en la consola de desarrollador de Zoho:

1. Ve a [Zoho API Console](https://api-console.zoho.com/)
2. Inicia sesión con tu cuenta de Zoho
3. Ve a "Self Client" o crea un nuevo cliente
4. En la configuración de la aplicación:
   - Asegúrate de que la URL de redirección esté configurada como: `http://localhost:3000/auth-callback`
   - Verifica que los permisos (scopes) incluyan: `ZohoProjects.portals.READ, ZohoProjects.projects.READ, ZohoProjects.tasks.READ, ZohoProjects.tasks.CREATE, ZohoProjects.timesheets.READ, ZohoProjects.timesheets.CREATE, ZohoProjects.timesheets.UPDATE, ZohoProjects.timesheets.DELETE`

## Configuración en VS Code

1. Abre la configuración de VS Code (File > Preferences > Settings)
2. Busca "Zoho Projects"
3. Completa los siguientes campos:
   - Client ID: El ID de cliente proporcionado por Zoho
   - Client Secret: El secreto de cliente proporcionado por Zoho
   - API Domain: Deja el valor predeterminado (`https://projectsapi.zoho.com`) a menos que necesites cambiarlo para tu región

## Proceso de autenticación

La extensión utiliza un servidor HTTP local (en el puerto 3000) para interceptar la respuesta de autenticación de Zoho. Cuando inicias sesión:

1. Se abre una ventana del navegador con la página de autenticación de Zoho
2. Después de autorizar, Zoho redirige al navegador a `http://localhost:3000/auth-callback`
3. El servidor local captura el código de autorización y cierra automáticamente la ventana del navegador
4. La extensión intercambia el código por tokens de acceso y refresco

## Solución de problemas

Si aparece el error "URI de redireccionamiento no válido":

- Verifica que la URL de redirección en la consola de Zoho coincida exactamente con: `http://localhost:3000/auth-callback`
- Asegúrate de no tener versiones anteriores de la aplicación con URLs de redirección diferentes (como `vscode://zoho-projects-time-tracker/auth-callback`)
- Si tienes problemas con el puerto 3000, revisa si está ocupado por otra aplicación

## Nota importante

La autenticación OAuth requiere que cualquier URL de redirección esté registrada previamente en la aplicación cliente. Si cambias el método de autenticación o el puerto, deberás actualizar la configuración en la consola de desarrollo de Zoho.
