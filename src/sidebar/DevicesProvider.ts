import * as vscode from "vscode";
import { Device } from "../models/Device";
import { AppInfo, AppRunningState, ServiceEntry } from "../models/DeviceManager";

/**
 * Tree item for a WendyOS device.
 */
export class DeviceTreeItem extends vscode.TreeItem {
  constructor(public readonly device: Device) {
    super(device.name, vscode.TreeItemCollapsibleState.Collapsed);
    this.description = device.address;
    this.contextValue = "device";
    this.iconPath = new vscode.ThemeIcon("device-desktop");
    this.tooltip = `${device.name} (${device.address})`;
  }
}

/**
 * Tree item for an app running on a WendyOS device.
 *
 * Renders a distinct icon for each running state:
 *  - RUNNING      → green circle ($(circle-filled))
 *  - CRASH_LOOPING → warning sync icon ($(sync-ignored)) — app is not running
 *                    but the agent is actively restarting it (WDY-1826)
 *  - STOPPED      → grey circle ($(circle-outline))
 */
export class AppTreeItem extends vscode.TreeItem {
  constructor(
    public readonly app: AppInfo,
    public readonly deviceAddress: string
  ) {
    const hasServices =
      Array.isArray(app.services) && app.services.length > 0;
    super(
      app.appName,
      hasServices
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );

    this.contextValue = "app";
    this.tooltip = buildAppTooltip(app);

    const { icon, description } = statePresentation(app.runningState, app.failureCount);
    this.iconPath = icon;
    this.description = description;
  }
}

/**
 * Tree item for an individual service within a multi-service app.
 */
export class ServiceTreeItem extends vscode.TreeItem {
  constructor(
    public readonly service: ServiceEntry,
    public readonly appName: string,
    public readonly deviceAddress: string
  ) {
    super(service.name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "service";

    const { icon, description } = statePresentation(service.runningState, service.failureCount);
    this.iconPath = icon;
    this.description = description;
    this.tooltip = buildServiceTooltip(service);
  }
}

/**
 * Returns the ThemeIcon and description string for a given AppRunningState.
 *
 * CRASH_LOOPING gets a dedicated warning icon so it is visually distinct from
 * both RUNNING and STOPPED — mirroring the red ↻ in the CLI table output
 * (CLI PR #1341).
 */
function statePresentation(
  state: AppRunningState,
  failureCount?: number
): { icon: vscode.ThemeIcon; description: string } {
  switch (state) {
    case "RUNNING":
      return {
        icon: new vscode.ThemeIcon(
          "circle-filled",
          new vscode.ThemeColor("wendyos.runningAppForeground")
        ),
        description: "Running",
      };
    case "CRASH_LOOPING": {
      const failures =
        failureCount !== undefined && failureCount > 0
          ? ` (${failureCount} restart${failureCount === 1 ? "" : "s"})`
          : "";
      return {
        icon: new vscode.ThemeIcon(
          "sync-ignored",
          new vscode.ThemeColor("wendyos.crashLoopingAppForeground")
        ),
        description: `Crash-looping${failures}`,
      };
    }
    default:
      return {
        icon: new vscode.ThemeIcon(
          "circle-outline",
          new vscode.ThemeColor("wendyos.stoppedAppForeground")
        ),
        description: "Stopped",
      };
  }
}

function buildAppTooltip(app: AppInfo): string {
  const lines: string[] = [`${app.appName}  •  ${stateLabel(app.runningState)}`];
  if (app.failureCount !== undefined && app.failureCount > 0) {
    lines.push(`Failures: ${app.failureCount}`);
  }
  if (app.exitCode !== undefined) {
    lines.push(`Last exit code: ${app.exitCode}`);
  }
  if (app.terminationReason) {
    lines.push(`Termination reason: ${app.terminationReason}`);
  }
  if (app.runningState === "CRASH_LOOPING") {
    lines.push("Use 'wendy device logs --app <name>' to view crash output.");
  }
  return lines.join("\n");
}

function buildServiceTooltip(service: ServiceEntry): string {
  const lines: string[] = [`${service.name}  •  ${stateLabel(service.runningState)}`];
  if (service.failureCount !== undefined && service.failureCount > 0) {
    lines.push(`Failures: ${service.failureCount}`);
  }
  if (service.exitCode !== undefined) {
    lines.push(`Last exit code: ${service.exitCode}`);
  }
  if (service.terminationReason) {
    lines.push(`Termination reason: ${service.terminationReason}`);
  }
  return lines.join("\n");
}

function stateLabel(state: AppRunningState): string {
  switch (state) {
    case "RUNNING":
      return "Running";
    case "CRASH_LOOPING":
      return "Crash-looping";
    default:
      return "Stopped";
  }
}

/**
 * Provides the Devices tree view in the WendyOS sidebar.
 */
export class DevicesProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    vscode.TreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private devices: Device[] = [];
  private apps: Map<string, AppInfo[]> = new Map();

  setDevices(devices: Device[]): void {
    this.devices = devices;
    this._onDidChangeTreeData.fire();
  }

  setApps(deviceId: string, apps: AppInfo[]): void {
    this.apps.set(deviceId, apps);
    this._onDidChangeTreeData.fire();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(
    element?: vscode.TreeItem
  ): vscode.ProviderResult<vscode.TreeItem[]> {
    if (!element) {
      // Root: list devices.
      if (this.devices.length === 0) {
        const placeholder = new vscode.TreeItem(
          "No devices found",
          vscode.TreeItemCollapsibleState.None
        );
        placeholder.iconPath = new vscode.ThemeIcon("info");
        return [placeholder];
      }
      return this.devices.map((d) => new DeviceTreeItem(d));
    }

    if (element instanceof DeviceTreeItem) {
      const appsForDevice = this.apps.get(element.device.id) ?? [];
      if (appsForDevice.length === 0) {
        const placeholder = new vscode.TreeItem(
          "No apps deployed",
          vscode.TreeItemCollapsibleState.None
        );
        placeholder.iconPath = new vscode.ThemeIcon("info");
        return [placeholder];
      }
      return appsForDevice.map(
        (app) => new AppTreeItem(app, element.device.address)
      );
    }

    if (element instanceof AppTreeItem) {
      const services = element.app.services ?? [];
      return services.map(
        (svc) =>
          new ServiceTreeItem(svc, element.app.appName, element.deviceAddress)
      );
    }

    return [];
  }
}
