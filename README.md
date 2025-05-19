# Zoho Projects Time Tracker para VS Code

Una extensión para Visual Studio Code que permite gestionar tareas y registrar tiempo en Zoho Projects directamente desde tu entorno de desarrollo.

## Características

Esta extensión te permite:

- Autenticarte con tu cuenta de Zoho Projects mediante OAuth
- Ver tus tareas asignadas en Zoho Projects
- Iniciar, pausar y detener el registro de tiempo para las tareas
- Sincronizar los registros de tiempo automáticamente con Zoho Projects
- Ver detalles de las tareas

## Requisitos

Para utilizar esta extensión necesitas:

- Una cuenta activa en Zoho Projects
- Credenciales de Cliente OAuth de Zoho (Client ID y Client Secret)
  - Puedes obtenerlas en [Zoho API Console](https://api-console.zoho.com/)

## Configuración de la Extensión

Esta extensión contribuye con la siguiente configuración:

- `zohoProjects.apiDomain`: Dominio de la API de Zoho Projects (por defecto: `https://projectsapi.zoho.com`)
- `zohoProjects.clientId`: Client ID para OAuth de Zoho Projects
- `zohoProjects.clientSecret`: Client Secret para OAuth de Zoho Projects

## Primeros Pasos

1. Instala la extensión desde el Marketplace de VS Code
2. Configura el Client ID y Client Secret en la configuración de VS Code
3. Ejecuta el comando "Zoho Projects: Iniciar sesión" desde la paleta de comandos
4. Completa el proceso de autorización en el navegador
5. ¡Listo! Ahora podrás ver tus tareas en la vista lateral de Zoho Projects

## Cómo Usar

### Comandos

La extensión proporciona los siguientes comandos:

- `Zoho Projects: Iniciar sesión`: Inicia el proceso de autenticación con Zoho Projects
- `Zoho Projects: Cerrar sesión`: Cierra la sesión actual
- `Zoho Projects: Actualizar tareas`: Actualiza la lista de tareas
- `Zoho Projects: Iniciar temporizador`: Inicia o reanuda un temporizador para una tarea
- `Zoho Projects: Pausar temporizador`: Pausa el temporizador actual
- `Zoho Projects: Detener temporizador`: Detiene el temporizador y registra el tiempo

### Vistas

La extensión añade un ítem a la barra de actividades con dos vistas:

- **Mis Tareas**: Muestra las tareas asignadas al usuario agrupadas por proyecto
- **Temporizador**: Muestra el temporizador actual y permite controlarlo

## Problemas Conocidos

- La API de Zoho puede tener limitaciones en el número de solicitudes por hora

## Notas de la Versión

### 0.0.1

Versión inicial con funcionalidades básicas:

- Autenticación con Zoho Projects
- Visualización de tareas
- Control de tiempo (iniciar, pausar, detener)
- Sincronización de registros de tiempo

## Seguridad y Privacidad

- La extensión almacena tokens de acceso de forma segura en el almacén de secretos de VS Code
- No se envía información personal a servidores externos más allá de Zoho Projects
- Todo el procesamiento se realiza localmente

## Contribuciones

Las contribuciones son bienvenidas. Si encuentras un error o tienes una sugerencia, por favor crea un issue en el repositorio de GitHub.

## Licencia

Esta extensión está licenciada bajo la licencia MIT.

---

## Recursos Útiles

- [API de Zoho Projects](https://www.zoho.com/projects/help/rest-api/overview.html)
- [Documentación de VS Code Extensions](https://code.visualstudio.com/api)

**¡Disfruta de la productividad!**
