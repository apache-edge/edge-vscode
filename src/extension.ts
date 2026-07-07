import * as vscode from "vscode";
import { DevicesProvider } from "./sidebar/DevicesProvider";
import { DisksProvider } from "./sidebar/DisksProvider";
import { HardwareProvider } from "./sidebar/HardwareProvider";
import { DeviceManager } from "./models/DeviceManager";
import { DiskManager } from "./models/DiskManager";
import { ProjectManager } from "./models/ProjectManager";
import { WendyCLI } from "./wendy-cli/wendy-cli";
import { WendyTaskProvider } from "./tasks/WendyTaskProvider";
import { EntitlementsEditorProvider } from "./editors/EntitlementsEditorProvider";
import { WendyDebugConfigurationProvider } from "./debugger/WendyDebugConfigurationProvider";
import { TelemetryDashboardProvider } from "./telemetry/TelemetryDashboardProvider";
import { OperatingSystemCacheProvider } from "./sidebar/OperatingSystemCacheProvider";

export async function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel("Wendy");

  const deviceManager = new DeviceManager(outputChannel);
  const diskManager = new DiskManager(outputChannel);
  const projectManager = new ProjectManager(outputChannel);

  const devicesProvider = new DevicesProvider(deviceManager, outputChannel);
  const disksProvider = new DisksProvider(diskManager);
  const hardwareProvider = new HardwareProvider(deviceManager);

  vscode.window.registerTreeDataProvider("wendyDevices", devicesProvider);
  vscode.window.registerTreeDataProvider("wendyDisks", disksProvider);
  vscode.window.registerTreeDataProvider("wendyHardware", hardwareProvider);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      TelemetryDashboardProvider.viewType,
      new TelemetryDashboardProvider(context.extensionUri)
    )
  );

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      EntitlementsEditorProvider.viewType,
      new EntitlementsEditorProvider(context),
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  context.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider(
      "wendy",
      new WendyDebugConfigurationProvider()
    )
  );

  context.subscriptions.push(
    vscode.tasks.registerTaskProvider(
      "wendy",
      new WendyTaskProvider(outputChannel)
    )
  );

  // ── Devices ──────────────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand("wendyDevices.addDevice", async () => {
      const address = await vscode.window.showInputBox({
        prompt: "Enter device address (hostname or hostname:port)",
        placeHolder: "mydevice.local",
      });
      if (address) {
        await devicesProvider.addDevice(address);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("wendyDevices.refreshDevices", () => {
      devicesProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "wendyDevices.deleteDevice",
      async (item) => {
        await devicesProvider.removeDevice(item);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "wendyDevices.connectWifi",
      async (item) => {
        const ssid = await vscode.window.showInputBox({
          prompt: "Enter WiFi SSID",
        });
        if (!ssid) {
          return;
        }
        const password = await vscode.window.showInputBox({
          prompt: "Enter WiFi password",
          password: true,
        });
        if (password === undefined) {
          return;
        }
        try {
          await deviceManager.connectWifi(item.device.address, ssid, password);
          vscode.window.showInformationMessage(`Connected to ${ssid}`);
        } catch (e: unknown) {
          vscode.window.showErrorMessage(
            `Failed to connect: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "wendyDevices.updateAgent",
      async (item) => {
        try {
          await deviceManager.updateAgent(item.device.address);
          vscode.window.showInformationMessage("Agent updated successfully");
          devicesProvider.refresh();
        } catch (e: unknown) {
          vscode.window.showErrorMessage(
            `Failed to update agent: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("wendyDevices.showInfo", async (item) => {
      const info = await deviceManager.checkForUpdates(item.device.address);
      if (info) {
        vscode.window.showInformationMessage(JSON.stringify(info, null, 2));
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "wendyDevices.copyHostname",
      async (item) => {
        await vscode.env.clipboard.writeText(item.device.address);
        vscode.window.showInformationMessage("Hostname copied to clipboard");
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "wendyDevices.copyAgentVersion",
      async (item) => {
        const info = await deviceManager.checkForUpdates(item.device.address);
        if (info) {
          const version = (info as { agentVersion?: string }).agentVersion ?? "";
          await vscode.env.clipboard.writeText(version);
          vscode.window.showInformationMessage(
            "Agent version copied to clipboard"
          );
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "wendyDevices.selectDevice",
      async (item) => {
        await devicesProvider.selectDevice(item);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "wendyDevices.showHardware",
      async (item) => {
        await hardwareProvider.setDevice(item.device);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "wendyDevices.deviceSetup",
      async (item) => {
        const cli = await WendyCLI.create();
        if (!cli) {
          vscode.window.showErrorMessage("Wendy CLI not found");
          return;
        }
        const terminal = vscode.window.createTerminal({
          name: "Wendy Device Setup",
          shellPath: cli.path,
          shellArgs: ["device", "setup", "--device", item.device.address],
        });
        terminal.show();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "wendyDevices.wifiStatus",
      async (item) => {
        try {
          const status = await deviceManager.getWifiStatus(item.device.address);
          vscode.window.showInformationMessage(JSON.stringify(status, null, 2));
        } catch (e: unknown) {
          vscode.window.showErrorMessage(
            `Failed to get WiFi status: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "wendyDevices.disconnectWifi",
      async (item) => {
        try {
          await deviceManager.disconnectWifi(item.device.address);
          vscode.window.showInformationMessage("WiFi disconnected");
        } catch (e: unknown) {
          vscode.window.showErrorMessage(
            `Failed to disconnect WiFi: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("wendyDevices.showLogs", async (item) => {
      const cli = await WendyCLI.create();
      if (!cli) {
        vscode.window.showErrorMessage("Wendy CLI not found");
        return;
      }
      const terminal = vscode.window.createTerminal({
        name: `Wendy Logs — ${item.device.address}`,
        shellPath: cli.path,
        shellArgs: ["device", "logs", "--device", item.device.address],
      });
      terminal.show();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "wendyDevices.showDashboard",
      async (item) => {
        const provider = new TelemetryDashboardProvider(
          context.extensionUri,
          item.device
        );
        provider.show();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "wendyDevices.unenrollDevice",
      async (item) => {
        const confirm = await vscode.window.showWarningMessage(
          `Unenroll device ${item.device.address}?`,
          { modal: true },
          "Unenroll"
        );
        if (confirm !== "Unenroll") {
          return;
        }
        try {
          await deviceManager.unenrollDevice(item.device.address);
          vscode.window.showInformationMessage("Device unenrolled");
          devicesProvider.refresh();
        } catch (e: unknown) {
          vscode.window.showErrorMessage(
            `Failed to unenroll: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "wendyDevices.renameDevice",
      async (item) => {
        await devicesProvider.renameDevice(item);
      }
    )
  );

  // ── Apps ─────────────────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand("wendyApps.showLogs", async (item) => {
      const cli = await WendyCLI.create();
      if (!cli) {
        vscode.window.showErrorMessage("Wendy CLI not found");
        return;
      }
      const terminal = vscode.window.createTerminal({
        name: `Wendy App Logs — ${item.appName}`,
        shellPath: cli.path,
        shellArgs: [
          "device",
          "apps",
          "logs",
          item.appName,
          "--device",
          item.deviceAddress,
        ],
      });
      terminal.show();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("wendyApps.startApp", async (item) => {
      try {
        await deviceManager.startApp(item.appName, item.deviceAddress);
        devicesProvider.refresh();
      } catch (e: unknown) {
        vscode.window.showErrorMessage(
          `Failed to start app: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("wendyApps.stopApp", async (item) => {
      try {
        await deviceManager.stopApp(item.appName, item.deviceAddress);
        devicesProvider.refresh();
      } catch (e: unknown) {
        vscode.window.showErrorMessage(
          `Failed to stop app: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("wendyApps.removeApp", async (item) => {
      const confirm = await vscode.window.showWarningMessage(
        `Remove app "${item.appName}"?`,
        { modal: true },
        "Remove"
      );
      if (confirm !== "Remove") {
        return;
      }
      try {
        await deviceManager.removeApp(item.appName, item.deviceAddress);
        devicesProvider.refresh();
      } catch (e: unknown) {
        vscode.window.showErrorMessage(
          `Failed to remove app: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    })
  );

  // ── AppStore install ──────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand("wendy.installApp", async () => {
      const appId = await vscode.window.showInputBox({
        title: "Install App from Wendy AppStore",
        prompt:
          "Enter the AppStore app ID to install (browse https://appstore.wendy.dev)",
        placeHolder: "e.g. jellyfin",
        validateInput: (value) =>
          value.trim().length === 0 ? "App ID cannot be empty" : undefined,
      });
      if (!appId) {
        return;
      }

      // Optionally pick a device address from the known devices list.
      const deviceAddress = await devicesProvider.pickDeviceAddress();

      const noStartChoice = await vscode.window.showQuickPick(
        [
          { label: "Install and start", description: "Deploy and start the app immediately", value: false },
          { label: "Install only", description: "Deploy the app but do not start it (--no-start)", value: true },
        ],
        { title: "Start after install?" }
      );
      if (!noStartChoice) {
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Installing "${appId}" from AppStore…`,
          cancellable: false,
        },
        async () => {
          try {
            await deviceManager.installApp(
              appId.trim(),
              deviceAddress,
              noStartChoice.value
            );
            vscode.window.showInformationMessage(
              noStartChoice.value
                ? `"${appId}" installed successfully (not started).`
                : `"${appId}" installed and started successfully.`
            );
            devicesProvider.refresh();
          } catch (e: unknown) {
            vscode.window.showErrorMessage(
              `Failed to install "${appId}": ${e instanceof Error ? e.message : String(e)}`
            );
          }
        }
      );
    })
  );

  // ── Disks ─────────────────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand("wendyDisks.flashDisk", async (item) => {
      await diskManager.flashWendyOS(item.disk, item.image);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("wendyDisks.refreshDisks", () => {
      disksProvider.refresh();
    })
  );

  // ── Hardware ──────────────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand("wendyHardware.refresh", () => {
      hardwareProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "wendyHardware.watchCamera",
      async (item) => {
        const cli = await WendyCLI.create();
        if (!cli) {
          vscode.window.showErrorMessage("Wendy CLI not found");
          return;
        }
        const terminal = vscode.window.createTerminal({
          name: `Camera — ${item.device}`,
          shellPath: cli.path,
          shellArgs: [
            "device",
            "camera",
            "watch",
            "--device",
            item.deviceAddress,
            "--camera",
            item.device,
          ],
        });
        terminal.show();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "wendyHardware.listenAudioInput",
      async (item) => {
        const cli = await WendyCLI.create();
        if (!cli) {
          vscode.window.showErrorMessage("Wendy CLI not found");
          return;
        }
        const terminal = vscode.window.createTerminal({
          name: `Audio — ${item.device}`,
          shellPath: cli.path,
          shellArgs: [
            "device",
            "audio",
            "listen",
            "--device",
            item.deviceAddress,
          ],
        });
        terminal.show();
      }
    )
  );

  // ── Project ───────────────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand("wendy.initProject", async () => {
      const uri = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        openLabel: "Select Project Folder",
      });
      if (!uri || uri.length === 0) {
        return;
      }
      const language = await vscode.window.showQuickPick(["swift", "python"], {
        placeHolder: "Select project language",
      });
      if (!language) {
        return;
      }
      try {
        await projectManager.initProject(
          uri[0].fsPath,
          language as "swift" | "python"
        );
        vscode.window.showInformationMessage("Project initialized successfully");
      } catch (e: unknown) {
        vscode.window.showErrorMessage(
          `Failed to initialize project: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("wendy.buildProject", async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage("No workspace folder open");
        return;
      }
      try {
        await projectManager.buildProject(workspaceFolders[0].uri.fsPath);
        vscode.window.showInformationMessage("Project built successfully");
      } catch (e: unknown) {
        vscode.window.showErrorMessage(
          `Build failed: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("wendy.manageEntitlements", async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage("No workspace folder open");
        return;
      }
      try {
        const entitlements = await projectManager.listEntitlements(
          workspaceFolders[0].uri.fsPath
        );
        vscode.window.showInformationMessage(
          JSON.stringify(entitlements, null, 2)
        );
      } catch (e: unknown) {
        vscode.window.showErrorMessage(
          `Failed to list entitlements: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("wendy.optimizeProject", async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage("No workspace folder open");
        return;
      }
      try {
        const result = await projectManager.optimizeProject(
          workspaceFolders[0].uri.fsPath,
          { json: true }
        );
        outputChannel.appendLine(result);
        outputChannel.show();
      } catch (e: unknown) {
        vscode.window.showErrorMessage(
          `Optimize failed: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("wendy.optimizeProjectFix", async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage("No workspace folder open");
        return;
      }
      try {
        const result = await projectManager.optimizeProject(
          workspaceFolders[0].uri.fsPath,
          { fix: true, json: true }
        );
        outputChannel.appendLine(result);
        outputChannel.show();
        vscode.window.showInformationMessage("Optimization fixes applied");
      } catch (e: unknown) {
        vscode.window.showErrorMessage(
          `Optimize fix failed: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("wendy.openEntitlementsEditor", async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage("No workspace folder open");
        return;
      }
      const wendyJsonUri = vscode.Uri.joinPath(
        workspaceFolders[0].uri,
        "wendy.json"
      );
      await vscode.commands.executeCommand(
        "vscode.openWith",
        wendyJsonUri,
        EntitlementsEditorProvider.viewType
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "wendy.refreshDebugConfigurations",
      async () => {
        vscode.window.showInformationMessage(
          "Debug configurations refreshed"
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("wendy.analyticsStatus", async () => {
      const cli = await WendyCLI.create();
      if (!cli) {
        vscode.window.showErrorMessage("Wendy CLI not found");
        return;
      }
      const terminal = vscode.window.createTerminal({
        name: "Wendy Analytics Status",
        shellPath: cli.path,
        shellArgs: ["analytics", "status"],
      });
      terminal.show();
    })
  );

  // ── OS cache ──────────────────────────────────────────────────────────────

  const osCacheProvider = new OperatingSystemCacheProvider();
  vscode.window.registerTreeDataProvider(
    "wendyOsCache",
    osCacheProvider
  );
}

export function deactivate() {}
