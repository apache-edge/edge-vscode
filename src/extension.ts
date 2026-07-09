import * as vscode from "vscode";
import * as path from "path";
import { DevicesProvider } from "./sidebar/DevicesProvider";
import { DisksProvider } from "./sidebar/DisksProvider";
import { DocumentationProvider } from "./sidebar/DocumentationProvider";
import { HardwareProvider } from "./sidebar/HardwareProvider";
import { OperatingSystemCacheProvider } from "./sidebar/OperatingSystemCacheProvider";
import { FleetProvider, FleetGroupItem, FleetDeviceItem } from "./sidebar/FleetProvider";
import { DeviceManager } from "./models/DeviceManager";
import { DiskManager } from "./models/DiskManager";
import { FleetManager } from "./models/FleetManager";
import { ProjectManager } from "./models/ProjectManager";
import { WendyFolderContext } from "./WendyFolderContext";
import { WendyWorkspaceContext } from "./WendyWorkspaceContext";
import { WendyDebugConfigurationProvider } from "./debugger/WendyDebugConfigurationProvider";
import { WendyTaskProvider } from "./tasks/WendyTaskProvider";
import { EntitlementsEditorProvider } from "./editors/EntitlementsEditorProvider";
import { TelemetryDashboardProvider } from "./telemetry/TelemetryDashboardProvider";
import { WendyCLI } from "./wendy-cli/wendy-cli";
import { Refresher } from "./sidebar/Refresher";
import { WendyProjectDetector } from "./utilities/WendyProjectDetector";
import { PythonExtensionNotifications } from "./utilities/PythonExtensionNotifications";

export async function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel("Wendy");
  context.subscriptions.push(outputChannel);

  // ── Core models ────────────────────────────────────────────────────────────
  const deviceManager = new DeviceManager(outputChannel);
  const diskManager = new DiskManager(outputChannel);
  const projectManager = new ProjectManager(outputChannel);
  const fleetManager = new FleetManager(outputChannel);

  // ── Workspace / folder context ─────────────────────────────────────────────
  const workspaceContext = new WendyWorkspaceContext(context, projectManager);
  const folderContext = new WendyFolderContext(context);

  // ── Sidebar providers ──────────────────────────────────────────────────────
  const devicesProvider = new DevicesProvider(deviceManager);
  const disksProvider = new DisksProvider(diskManager);
  const documentationProvider = new DocumentationProvider();
  const hardwareProvider = new HardwareProvider(deviceManager);
  const osCacheProvider = new OperatingSystemCacheProvider();
  const fleetProvider = new FleetProvider(fleetManager);

  // ── Tree views ─────────────────────────────────────────────────────────────
  const devicesView = vscode.window.createTreeView("wendyDevices", {
    treeDataProvider: devicesProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(devicesView);

  const disksView = vscode.window.createTreeView("wendyDisks", {
    treeDataProvider: disksProvider,
    showCollapseAll: false,
  });
  context.subscriptions.push(disksView);

  vscode.window.registerTreeDataProvider(
    "wendyDocumentation",
    documentationProvider
  );
  vscode.window.registerTreeDataProvider("wendyHardware", hardwareProvider);
  vscode.window.registerTreeDataProvider("wendyOsCache", osCacheProvider);

  const fleetView = vscode.window.createTreeView("wendyFleet", {
    treeDataProvider: fleetProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(fleetView);

  // ── Refreshers ─────────────────────────────────────────────────────────────
  const deviceRefresher = new Refresher(() => devicesProvider.refresh(), 10000);
  context.subscriptions.push(deviceRefresher);

  const diskRefresher = new Refresher(() => disksProvider.refresh(), 5000);
  context.subscriptions.push(diskRefresher);

  // ── Debug configuration provider ───────────────────────────────────────────
  context.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider(
      "wendy",
      new WendyDebugConfigurationProvider(deviceManager, outputChannel)
    )
  );

  // ── Task provider ──────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.tasks.registerTaskProvider(
      "wendy",
      new WendyTaskProvider(deviceManager)
    )
  );

  // ── Editors ────────────────────────────────────────────────────────────────
  context.subscriptions.push(
    EntitlementsEditorProvider.register(context, projectManager)
  );

  // ── Telemetry dashboard ────────────────────────────────────────────────────
  context.subscriptions.push(
    TelemetryDashboardProvider.register(context, deviceManager)
  );

  // ── Workspace / project detection ──────────────────────────────────────────
  const projectDetector = new WendyProjectDetector(workspaceContext);
  context.subscriptions.push(projectDetector);

  const pythonNotifications = new PythonExtensionNotifications(context);
  context.subscriptions.push(pythonNotifications);

  // ── Schema sync ────────────────────────────────────────────────────────────
  const cli = await WendyCLI.create();
  if (cli) {
    await cli.syncJsonSchema(context);
  }

  // ── Folder context wiring ──────────────────────────────────────────────────
  folderContext.activate();
  workspaceContext.activate();

  // ── Commands: devices ──────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("wendyDevices.refresh", () => {
      devicesProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "wendyDevices.openLogs",
      async (item: { deviceAddress?: string } | undefined) => {
        const address = item?.deviceAddress;
        if (!address) {
          vscode.window.showErrorMessage("No device selected.");
          return;
        }
        const cli = await WendyCLI.create();
        if (!cli) {
          vscode.window.showErrorMessage("Wendy CLI not found.");
          return;
        }
        const terminal = vscode.window.createTerminal({
          name: "Wendy Logs",
        });
        terminal.show();
        terminal.sendText(`${cli.path} device logs --device ${address}`);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "wendyDevices.updateAgent",
      async (item: { deviceAddress?: string } | undefined) => {
        const address = item?.deviceAddress;
        if (!address) {
          vscode.window.showErrorMessage("No device selected.");
          return;
        }
        try {
          await deviceManager.updateAgent(address);
          vscode.window.showInformationMessage("Agent updated successfully.");
          devicesProvider.refresh();
        } catch (err: unknown) {
          vscode.window.showErrorMessage(
            `Failed to update agent: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "wendyDevices.unenroll",
      async (item: { deviceAddress?: string; label?: string } | undefined) => {
        const address = item?.deviceAddress;
        if (!address) {
          vscode.window.showErrorMessage("No device selected.");
          return;
        }
        const confirm = await vscode.window.showWarningMessage(
          `Unenroll device${item?.label ? ` "${item.label}"` : ""}? This cannot be undone.`,
          { modal: true },
          "Unenroll"
        );
        if (confirm !== "Unenroll") {
          return;
        }
        try {
          await deviceManager.unenrollDevice(address);
          vscode.window.showInformationMessage("Device unenrolled.");
          devicesProvider.refresh();
        } catch (err: unknown) {
          vscode.window.showErrorMessage(
            `Failed to unenroll: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    )
  );

  // ── Commands: hardware ─────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "wendyHardware.watchCamera",
      async (item: { deviceAddress?: string; devicePath?: string } | undefined) => {
        const address = item?.deviceAddress;
        if (!address) {
          vscode.window.showErrorMessage("No device address available.");
          return;
        }
        const cli = await WendyCLI.create();
        if (!cli) {
          vscode.window.showErrorMessage("Wendy CLI not found.");
          return;
        }
        const args = ["device", "camera", "view", "--device", address];
        const devicePath = item?.devicePath ?? "";
        const match = devicePath.match(/(\d+)$/);
        if (match) {
          args.push("--id", match[1]);
        }
        const terminal = vscode.window.createTerminal({ name: "Wendy Camera" });
        terminal.show();
        terminal.sendText(`${cli.path} ${args.join(" ")}`);
      }
    )
  );

  // ── Commands: fleet ────────────────────────────────────────────────────────

  /**
   * Refresh the Fleet sidebar tree.
   */
  context.subscriptions.push(
    vscode.commands.registerCommand("wendyFleet.refresh", () => {
      fleetProvider.refresh();
    })
  );

  /**
   * `wendy fleet group add <group> <device>` — invoked from the Fleet sidebar
   * via the "Add device to group" inline action on a FleetGroupItem, or from
   * the command palette with no arguments (prompts for both).
   */
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "wendyFleet.addDeviceToGroup",
      async (item?: FleetGroupItem) => {
        const groupName =
          item?.group.group ??
          (await vscode.window.showInputBox({
            prompt: "Group name",
            placeHolder: "e.g. cameras",
            validateInput: (v) =>
              /^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/.test(v)
                ? undefined
                : "Start with a letter or digit; only letters, digits, '.', '_', '-' allowed (max 63 chars)",
          }));
        if (!groupName) {
          return;
        }

        const deviceName = await vscode.window.showInputBox({
          prompt: `Device name or ID to add to group "${groupName}"`,
          placeHolder: "e.g. cam-01",
        });
        if (!deviceName) {
          return;
        }

        try {
          const results = await fleetManager.addDevicesToGroup(groupName, [
            deviceName,
          ]);
          const failed = results.filter((r) => r.error);
          if (failed.length > 0) {
            vscode.window.showErrorMessage(
              `Failed: ${failed.map((r) => r.error).join("; ")}`
            );
          } else {
            const r = results[0];
            if (r?.changed) {
              vscode.window.showInformationMessage(
                `Added ${deviceName} to group "${groupName}".`
              );
            } else {
              vscode.window.showInformationMessage(
                `${deviceName} is already in group "${groupName}".`
              );
            }
          }
          fleetProvider.refresh();
        } catch (err: unknown) {
          vscode.window.showErrorMessage(
            `Failed to add device: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    )
  );

  /**
   * `wendy fleet group rm <group> <device>` — invoked from the Fleet sidebar
   * "Remove from group" inline action on a FleetDeviceItem.
   */
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "wendyFleet.removeDeviceFromGroup",
      async (item?: FleetDeviceItem) => {
        const groupName =
          item?.groupName ??
          (await vscode.window.showInputBox({ prompt: "Group name" }));
        if (!groupName) {
          return;
        }

        const deviceName =
          item?.device.name ??
          (await vscode.window.showInputBox({
            prompt: `Device name or ID to remove from group "${groupName}"`,
          }));
        if (!deviceName) {
          return;
        }

        const confirm = await vscode.window.showWarningMessage(
          `Remove "${deviceName}" from group "${groupName}"?`,
          { modal: true },
          "Remove"
        );
        if (confirm !== "Remove") {
          return;
        }

        try {
          const results = await fleetManager.removeDevicesFromGroup(groupName, [
            deviceName,
          ]);
          const failed = results.filter((r) => r.error);
          if (failed.length > 0) {
            vscode.window.showErrorMessage(
              `Failed: ${failed.map((r) => r.error).join("; ")}`
            );
          } else {
            vscode.window.showInformationMessage(
              `Removed ${deviceName} from group "${groupName}".`
            );
          }
          fleetProvider.refresh();
        } catch (err: unknown) {
          vscode.window.showErrorMessage(
            `Failed to remove device: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    )
  );

  /**
   * `wendy fleet apps --group <group>` — opens a terminal showing app
   * inventory for a group. Invoked from the Fleet sidebar on a FleetGroupItem.
   */
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "wendyFleet.showApps",
      async (item?: FleetGroupItem) => {
        const groupName =
          item?.group.group ??
          (await vscode.window.showInputBox({
            prompt: "Group name to inspect",
            placeHolder: "e.g. cameras",
          }));
        if (!groupName) {
          return;
        }

        const cli = await WendyCLI.create();
        if (!cli) {
          vscode.window.showErrorMessage("Wendy CLI not found.");
          return;
        }

        const terminal = vscode.window.createTerminal({
          name: `Wendy Fleet Apps: ${groupName}`,
        });
        terminal.show();
        terminal.sendText(
          `${cli.path} fleet apps --group ${groupName}`
        );
      }
    )
  );

  /**
   * `wendy fleet run --group <group>` — fan-out deploy to a group. Invoked
   * from the Fleet sidebar on a FleetGroupItem, or from the command palette.
   */
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "wendyFleet.run",
      async (item?: FleetGroupItem) => {
        const groupName =
          item?.group.group ??
          (await vscode.window.showInputBox({
            prompt: "Group name to deploy to",
            placeHolder: "e.g. cameras",
          }));
        if (!groupName) {
          return;
        }

        // Resolve the project directory: use the first workspace folder if available.
        const workspaceFolder =
          vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) {
          vscode.window.showErrorMessage(
            "Open a Wendy project folder before running fleet deploy."
          );
          return;
        }

        const keepGoing = await vscode.window
          .showQuickPick(
            [
              {
                label: "Stop on first failure",
                description: "Default",
                value: false,
              },
              {
                label: "Keep going past failures",
                description: "--keep-going",
                value: true,
              },
            ],
            { placeHolder: "How should failures be handled?" }
          )
          .then((pick) => pick?.value ?? false);

        try {
          await fleetManager.runFleet(groupName, workspaceFolder, {
            keepGoing,
          });
        } catch (err: unknown) {
          vscode.window.showErrorMessage(
            `Fleet run failed: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    )
  );
}

export function deactivate() {}
