# Solución de Problemas de Autenticación - Zoho Projects Time Tracker

Este documento proporciona una guía paso a paso para resolver problemas comunes de autenticación con la extensión Zoho Projects Time Tracker para VS Code.

## Problema: "URI de redireccionamiento no válido"

Este es el error más común y significa que la URI de redirección que configuraste en Zoho no coincide exactamente con la que la extensión está intentando usar.

### Solución 1: Verificar la configuración en Zoho API Console

1. Ve a [Zoho API Console](https://api-console.zoho.com/)
2. Inicia sesión con tu cuenta de Zoho
3. Selecciona tu cliente en "Self Client" o "Client"
4. En la sección de configuración, busca "Authorized Redirect URIs"
5. Asegúrate de que la URI esté configurada **exactamente** como: `vscode://zoho-projects-time-tracker/auth-callback`
   - Verifica que no haya espacios adicionales
   - Verifica que todas las mayúsculas/minúsculas sean correctas
   - Asegúrate de tener exactamente dos barras diagonales después de "vscode:"

### Solución 2: Reiniciar VS Code y el navegador

A veces, el manejo de protocolos personalizados puede ser problemático:

1. Cierra completamente VS Code
2. Cierra todas las ventanas del navegador
3. Reinicia tu computadora
4. Abre VS Code y vuelve a intentar el proceso de autenticación

### Solución 3: Verificar el registro del protocolo vscode://

En Windows, el protocolo `vscode://` debe estar registrado correctamente:

1. Abre el Editor del Registro (Win+R, escribe "regedit" y presiona Enter)
2. Navega a `HKEY_CLASSES_ROOT\vscode`
3. Verifica que la clave "URL Protocol" exista
4. Verifica que la clave DefaultIcon apunte a la ubicación correcta de VS Code
5. Verifica que la clave shell\open\command apunte a VS Code con los parámetros correctos

### Solución 4: Usar método alternativo de autenticación (para desarrolladores)

Si ninguna de las soluciones anteriores funciona, se puede implementar un método alternativo:

1. Modificar la extensión para usar un servidor HTTP local
2. Actualizar la URI de redirección en Zoho a `http://localhost:3000/auth-callback`
3. Implementar manejo del callback en el servidor local

## Problema: El navegador se redirige pero VS Code no se activa

Este problema ocurre cuando el protocolo `vscode://` está registrado pero no activa correctamente VS Code.

### Solución 1: Establecer VS Code como la aplicación predeterminada

1. En Windows, ve a Configuración > Aplicaciones > Aplicaciones predeterminadas
2. Busca "vscode" en la sección de Protocolos
3. Establece VS Code como la aplicación predeterminada

### Solución 2: Reinstalar VS Code

Una reinstalación limpia de VS Code puede resolver problemas de registro del protocolo:

1. Desinstala VS Code
2. Reinicia la computadora
3. Reinstala VS Code desde el sitio oficial

## Problema: El token de acceso no se obtiene correctamente

Si la redirección funciona pero la extensión no obtiene el token de acceso:

### Solución 1: Verificar permisos en la consola de Zoho

1. Asegúrate de que todos los siguientes permisos estén habilitados:
   - ZohoProjects.portals.READ
   - ZohoProjects.projects.READ
   - ZohoProjects.tasks.READ
   - ZohoProjects.tasks.CREATE
   - ZohoProjects.timesheets.READ
   - ZohoProjects.timesheets.CREATE
   - ZohoProjects.timesheets.UPDATE
   - ZohoProjects.timesheets.DELETE

### Solución 2: Verificar el clientId y clientSecret

1. Abre la configuración de VS Code
2. Busca "zohoProjects"
3. Verifica que los valores de clientId y clientSecret sean correctos

## Contacto para soporte adicional

Si ninguna de estas soluciones resuelve el problema:

1. Ve al repositorio de la extensión en GitHub
2. Abre un issue describiendo tu problema
3. Incluye:
   - Capturas de pantalla de tu configuración en Zoho (ocultando información sensible)
   - Los logs de la consola de desarrollador de VS Code
   - El sistema operativo y versión de VS Code que estás usando

---

Este documento se actualizará periódicamente con nuevas soluciones basadas en los problemas reportados por los usuarios.
