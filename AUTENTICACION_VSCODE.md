# Configuración de autenticación para Zoho Projects Time Tracker

Este documento proporciona instrucciones para configurar correctamente la autenticación OAuth con Zoho Projects utilizando el protocolo `vscode://`.

## Configuración en la consola de desarrollo de Zoho

Para utilizar la extensión, debes configurar la aplicación en la consola de desarrollador de Zoho:

1. Ve a [Zoho API Console](https://api-console.zoho.com/)
2. Inicia sesión con tu cuenta de Zoho
3. Ve a "Self Client" o crea un nuevo cliente
4. En la configuración de la aplicación:
   - Asegúrate de que la URL de redirección esté configurada EXACTAMENTE como: `vscode://zoho-projects-time-tracker/auth-callback`
   - Verifica que los permisos (scopes) incluyan: `ZohoProjects.portals.READ, ZohoProjects.projects.READ, ZohoProjects.tasks.READ, ZohoProjects.tasks.CREATE, ZohoProjects.timesheets.READ, ZohoProjects.timesheets.CREATE, ZohoProjects.timesheets.UPDATE, ZohoProjects.timesheets.DELETE`

## Configuración en VS Code

1. Abre la configuración de VS Code (File > Preferences > Settings)
2. Busca "Zoho Projects"
3. Completa los siguientes campos:
   - Client ID: El ID de cliente proporcionado por Zoho
   - Client Secret: El secreto de cliente proporcionado por Zoho
   - API Domain: Deja el valor predeterminado (`https://projectsapi.zoho.com`) a menos que necesites cambiarlo para tu región

## Proceso de autenticación

La extensión utiliza el protocolo `vscode://` para manejar la redirección OAuth. Cuando inicias sesión:

1. Se abre una ventana del navegador con la página de autenticación de Zoho
2. Después de autorizar, Zoho redirige al navegador a `vscode://zoho-projects-time-tracker/auth-callback`
3. El sistema operativo lanza VS Code y le pasa la URI para procesarla
4. VS Code captura la URI y la extensión extrae el código de autorización
5. La extensión intercambia el código por tokens de acceso y refresco

## Solución de problemas

### Si aparece el error "URI de redireccionamiento no válido":

- Verifica que la URL de redirección en la consola de Zoho coincida EXACTAMENTE con: `vscode://zoho-projects-time-tracker/auth-callback`
- Asegúrate de que no hay espacios adicionales, mayúsculas incorrectas o caracteres adicionales
- Revisa si tienes múltiples clientes registrados con diferentes URIs de redirección

### Si la autenticación no completa el ciclo:

- Asegúrate de que el protocolo `vscode://` esté correctamente registrado en tu sistema operativo
- Verifica que VS Code sea la aplicación predeterminada para manejar el protocolo `vscode://`
- Revisa los logs en la consola de desarrollo de VS Code (Help > Toggle Developer Tools)

### Si recibes un error de transformación de URI:

- La extensión está diseñada para manejar la transformación de URIs incorrectas como `https://vscode//` a `vscode://`
- Si persiste el problema, intenta cerrar todas las instancias de VS Code y reiniciarlo

## Depuración Avanzada

Si continúas experimentando problemas con la autenticación, estos pasos adicionales pueden ayudar:

### Comprobar la asociación del protocolo vscode://

1. Abre el Registro de Windows (Ejecuta `regedit`)
2. Navega a `HKEY_CLASSES_ROOT\vscode`
3. Verifica que la asociación del protocolo apunte correctamente a VS Code
4. Si no existe, puedes reinstalar VS Code o registrar manualmente el protocolo

### Depuración de la redirección

Si el problema persiste, puedes intentar lo siguiente:

1. Desinstala y reinstala VS Code
2. Prueba con otro navegador para la autenticación
3. Verifica que no haya extensiones o software de seguridad bloqueando las redirecciones de protocolo

### Solución alternativa: Copiar manualmente el código de autorización

Si la redirección automática no funciona, puedes intentar:

1. Cuando se muestre el error de redirección en el navegador, copia la URL completa
2. En VS Code, ejecuta el comando "Zoho Projects: Ver instrucciones de autenticación" (este documento)
3. Toma el código de autorización (`code=XXXX`) de la URL y contacta al desarrollador para asistencia adicional
4. Con el código y estado manualmente extraídos, se puede implementar un comando adicional para completar la autenticación

### Logs de depuración

Puedes habilitar logs avanzados en VS Code:

1. Abre la Paleta de Comandos (Ctrl+Shift+P)
2. Ejecuta "Developer: Toggle Developer Tools"
3. En la consola, los mensajes de la extensión proporcionarán pistas sobre lo que está fallando

## Registro en la consola de Zoho

Asegúrate de haber registrado correctamente la aplicación en Zoho:

![Ejemplo de configuración en Zoho](https://i.imgur.com/example.jpg)

Cuando registres la aplicación en la consola de Zoho:

- El tipo de cliente debe ser "Web-based"
- La URI de redirección debe escribirse exactamente como: `vscode://zoho-projects-time-tracker/auth-callback`
- Todos los permisos (scopes) requeridos deben estar seleccionados
