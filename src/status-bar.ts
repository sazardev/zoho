import * as vscode from "vscode";
import { ZohoTask } from "./api";

/**
 * Gestiona la barra de estado para mostrar el tiempo activo
 */
export class ZohoStatusBar {
  private statusBarItem: vscode.StatusBarItem;
  private timer: NodeJS.Timeout | undefined;
  private startTime: Date | undefined;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private pausedDuration: number = 0;
  private currentTask: ZohoTask | undefined;
  private elapsedSeconds: number = 0;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.name = "Zoho Projects Timer";
    this.reset();
    this.statusBarItem.show();
  }

  /**
   * Inicia el temporizador para una tarea
   */
  public start(task: ZohoTask): void {
    if (this.isRunning && !this.isPaused) {
      vscode.window.showWarningMessage(
        "Ya hay un temporizador activo. Deténgalo antes de iniciar uno nuevo."
      );
      return;
    }

    if (this.isPaused) {
      // Continuar con el temporizador pausado
      this.isPaused = false;
      const now = new Date();
      if (this.startTime) {
        this.pausedDuration += Math.floor((now.getTime() - this.startTime.getTime()) / 1000);
      }
      this.startTime = now;
    } else {
      // Iniciar nuevo temporizador
      this.reset();
      this.startTime = new Date();
      this.currentTask = task;
    }

    this.isRunning = true;
    this.statusBarItem.text = `$(clock) 00:00:00 - ${
      this.currentTask?.name || "Tarea"
    }`;
    this.statusBarItem.tooltip = `Registrando tiempo para: ${
      this.currentTask?.name || "Tarea"
    }`;
    this.statusBarItem.command = "zoho-projects-time-tracker.pauseTimer";

    this.timer = setInterval(() => {
      this.updateTimer();
    }, 1000);
  }

  /**
   * Pausa el temporizador
   */
  public pause(): void {
    if (!this.isRunning) {
      vscode.window.showWarningMessage("No hay un temporizador activo.");
      return;
    }

    if (this.isPaused) {
      vscode.window.showWarningMessage("El temporizador ya está en pausa.");
      return;
    }

    if (this.timer) {
      clearInterval(this.timer);
    }
    this.isPaused = true;
    this.statusBarItem.text = `$(debug-pause) ${this.formatTime(
      this.elapsedSeconds
    )} - ${this.currentTask?.name || "Tarea"} (Pausado)`;
    this.statusBarItem.command = "zoho-projects-time-tracker.startTimer";
  }

  /**
   * Detiene el temporizador
   */
  public stop(): {
    task: ZohoTask | undefined;
    duration: number;
    hours: number;
    minutes: number;
    seconds: number;
  } {
    if (!this.isRunning) {
      vscode.window.showWarningMessage("No hay un temporizador activo.");
      return {
        task: undefined,
        duration: 0,
        hours: 0,
        minutes: 0,
        seconds: 0
      };
    }

    if (this.timer) {
      clearInterval(this.timer);
    }
    const elapsed = this.elapsedSeconds;
    const task = this.currentTask;
    this.reset();

    return {
      task,
      duration: elapsed,
      hours: Math.floor(elapsed / 3600),
      minutes: Math.floor((elapsed % 3600) / 60),
      seconds: elapsed % 60,
    };
  }

  /**
   * Actualiza el temporizador cada segundo
   */
  private updateTimer(): void {
    if (!this.startTime || this.isPaused) {
      return;
    }

    const now = new Date();
    this.elapsedSeconds = Math.floor((now.getTime() - this.startTime.getTime()) / 1000) + this.pausedDuration;
    this.statusBarItem.text = `$(clock) ${this.formatTime(
      this.elapsedSeconds
    )} - ${this.currentTask?.name || "Tarea"}`;
  }

  /**
   * Formatea el tiempo en formato HH:MM:SS
   */
  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  /**
   * Resetea el estado del temporizador
   */
  private reset(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = undefined;
    this.startTime = undefined;
    this.isRunning = false;
    this.isPaused = false;
    this.pausedDuration = 0;
    this.elapsedSeconds = 0;
    this.currentTask = undefined;

    this.statusBarItem.text = `$(clock) Zoho Timer`;
    this.statusBarItem.tooltip =
      "Iniciar temporizador para tarea de Zoho Projects";
    this.statusBarItem.command = "zoho-projects-time-tracker.startTimer";
  }

  /**
   * Devuelve la tarea actual
   */
  public getCurrentTask(): ZohoTask | undefined {
    return this.currentTask;
  }

  /**
   * Verifica si hay un temporizador en ejecución
   */
  public isTimerRunning(): boolean {
    return this.isRunning && !this.isPaused;
  }

  /**
   * Verifica si el temporizador está pausado
   */
  public isTimerPaused(): boolean {
    return this.isRunning && this.isPaused;
  }

  /**
   * Elimina los recursos
   */
  public dispose(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.statusBarItem.dispose();
  }
}
