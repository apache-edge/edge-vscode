import * as vscode from "vscode";
import { execFile } from "child_process";
import { WendyCLI } from "../wendy-cli/wendy-cli";
import { analyticsDisabledEnv } from "../utilities/utilities";

export interface AppInfo {
  appName: string;
  runningState: AppRunningState;
  failureCount?: number;
  exitCode?: number;
  terminationReason?: string;
  services?: ServiceEntry[];
}

/**
 * Running state of an app on a WendyOS device.
 *
 * - RUNNING: the app is actively running.
 * - STOPPED: the app is not running (clean stop or first exit before any restart).
 * - CRASH_LOOPING: the app is not running right now but the agent's restart
 *   policy is actively restarting it — it has already been auto-restarted at
 *   least once and will be started again (WDY-1826 / CLI PR #1341).
 */
export type AppRunningState = "RUNNING" | "STOPPED" | "CRASH_LOOPING";

export interface ServiceEntry {
  name: string;
  runningState: AppRunningState;
  failureCount?: number;
  exitCode?: number;
  terminationReason?: string;
}

export interface WifiStatus {
  connected: boolean;
  ssid?: string;
  ipAddress?: string;
}

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
}

export interface HardwareDevice {
  id: string;
  name: string;
  category: string;
  devicePath?: string;
}

/**
 * A single network interface reported by `wendy device info`.
 */
export interface NetworkInterface {
  name: string;
  ipAddresses: string[];
}

/**
 * Manages interactions with a Wendy device via the CLI.
 */
export class DeviceManager {
  constructor(private outputChannel: vscode.OutputChannel) {}

  /**
   * Lists apps on the device.
   * Background call — analytics disabled.
   */
  async listApps(deviceAddress: string): Promise<AppInfo[]> {
    const cli = await WendyCLI.create();
    if (!cli) {
      throw new Error("Wendy CLI not found");
    }

    return new Promise((resolve, reject) => {
      const args = ["--json", "device", "apps", "list", "--device", deviceAddress];
      this.outputChannel.appendLine(`Executing: ${cli.path} ${args.join(" ")}`);

      execFile(
        cli.path,
        args,
        { env: analyticsDisabledEnv() },
        (error, stdout, stderr) => {
          if (error) {
            this.outputChannel.appendLine(`Error: ${stderr || error.message}`);
            reject(new Error(stderr || error.message));
            return;
          }
          try {
            const apps = JSON.parse(stdout);
            resolve(Array.isArray(apps) ? apps : []);
          } catch {
            resolve([]);
          }
        }
      );
    });
  }

  /**
   * Starts an app on the device.
   */
  async startApp(deviceAddress: string, appName: string): Promise<void> {
    const cli = await WendyCLI.create();
    if (!cli) {
      throw new Error("Wendy CLI not found");
    }

    return new Promise((resolve, reject) => {
      const args = ["device", "apps", "start", "--device", deviceAddress, "--app", appName, "--detach"];
      this.outputChannel.appendLine(`Executing: ${cli.path} ${args.join(" ")}`);

      execFile(cli.path, args, (error, stdout, stderr) => {
        if (error) {
          this.outputChannel.appendLine(`Error: ${stderr || error.message}`);
          reject(new Error(stderr || error.message));
          return;
        }
        this.outputChannel.appendLine(stdout);
        resolve();
      });
    });
  }

  /**
   * Stops an app on the device.
   */
  async stopApp(deviceAddress: string, appName: string): Promise<void> {
    const cli = await WendyCLI.create();
    if (!cli) {
      throw new Error("Wendy CLI not found");
    }

    return new Promise((resolve, reject) => {
      const args = ["device", "apps", "stop", "--device", deviceAddress, "--app", appName];
      this.outputChannel.appendLine(`Executing: ${cli.path} ${args.join(" ")}`);

      execFile(cli.path, args, (error, stdout, stderr) => {
        if (error) {
          this.outputChannel.appendLine(`Error: ${stderr || error.message}`);
          reject(new Error(stderr || error.message));
          return;
        }
        this.outputChannel.appendLine(stdout);
        resolve();
      });
    });
  }

  /**
   * Removes an app from the device.
   */
  async removeApp(deviceAddress: string, appName: string): Promise<void> {
    const cli = await WendyCLI.create();
    if (!cli) {
      throw new Error("Wendy CLI not found");
    }

    return new Promise((resolve, reject) => {
      const args = ["device", "apps", "remove", "--device", deviceAddress, "--app", appName];
      this.outputChannel.appendLine(`Executing: ${cli.path} ${args.join(" ")}`);

      execFile(cli.path, args, (error, stdout, stderr) => {
        if (error) {
          this.outputChannel.appendLine(`Error: ${stderr || error.message}`);
          reject(new Error(stderr || error.message));
          return;
        }
        this.outputChannel.appendLine(stdout);
        resolve();
      });
    });
  }

  /**
   * Gets the WiFi status of the device.
   */
  async getWifiStatus(deviceAddress: string): Promise<WifiStatus> {
    const cli = await WendyCLI.create();
    if (!cli) {
      throw new Error("Wendy CLI not found");
    }

    return new Promise((resolve, reject) => {
      const args = ["--json", "device", "wifi", "status", "--device", deviceAddress];
      this.outputChannel.appendLine(`Executing: ${cli.path} ${args.join(" ")}`);

      execFile(cli.path, args, (error, stdout, stderr) => {
        if (error) {
          this.outputChannel.appendLine(`Error: ${stderr || error.message}`);
          reject(new Error(stderr || error.message));
          return;
        }
        try {
          const status = JSON.parse(stdout);
          resolve(status);
        } catch {
          resolve({ connected: false });
        }
      });
    });
  }

  /**
   * Connects the device to a WiFi network.
   */
  async connectWifi(deviceAddress: string, ssid: string, password?: string): Promise<void> {
    const cli = await WendyCLI.create();
    if (!cli) {
      throw new Error("Wendy CLI not found");
    }

    return new Promise((resolve, reject) => {
      const args = ["device", "wifi", "connect", "--device", deviceAddress, "--ssid", ssid];
      if (password) {
        args.push("--password", password);
      }
      this.outputChannel.appendLine(`Executing: ${cli.path} ${args.join(" ")}`);

      execFile(cli.path, args, (error, stdout, stderr) => {
        if (error) {
          this.outputChannel.appendLine(`Error: ${stderr || error.message}`);
          reject(new Error(stderr || error.message));
          return;
        }
        this.outputChannel.appendLine(stdout);
        resolve();
      });
    });
  }

  /**
   * Disconnects the device from WiFi.
   */
  async disconnectWifi(deviceAddress: string): Promise<void> {
    const cli = await WendyCLI.create();
    if (!cli) {
      throw new Error("Wendy CLI not found");
    }

    return new Promise((resolve, reject) => {
      const args = ["device", "wifi", "disconnect", "--device", deviceAddress];
      this.outputChannel.appendLine(`Executing: ${cli.path} ${args.join(" ")}`);

      execFile(cli.path, args, (error, stdout, stderr) => {
        if (error) {
          this.outputChannel.appendLine(`Error: ${stderr || error.message}`);
          reject(new Error(stderr || error.message));
          return;
        }
        this.outputChannel.appendLine(stdout);
        resolve();
      });
    });
  }

  /**
   * Checks for agent updates.
   * Background call — analytics disabled.
   */
  async checkForUpdates(deviceAddress: string): Promise<UpdateInfo | undefined> {
    const cli = await WendyCLI.create();
    if (!cli) {
      return undefined;
    }

    return new Promise((resolve) => {
      const args = ["--json", "device", "info", "--check-updates", "--device", deviceAddress];
      this.outputChannel.appendLine(`Executing: ${cli.path} ${args.join(" ")}`);

      execFile(
        cli.path,
        args,
        { env: analyticsDisabledEnv() },
        (error, stdout) => {
          if (error) {
            resolve(undefined);
            return;
          }
          try {
            const info = JSON.parse(stdout);
            resolve(info?.updateInfo);
          } catch {
            resolve(undefined);
          }
        }
      );
    });
  }

  /**
   * Updates the agent on the device.
   */
  async updateAgent(deviceAddress: string): Promise<void> {
    const cli = await WendyCLI.create();
    if (!cli) {
      throw new Error("Wendy CLI not found");
    }

    return new Promise((resolve, reject) => {
      const args = ["device", "agent", "update", "--device", deviceAddress];
      this.outputChannel.appendLine(`Executing: ${cli.path} ${args.join(" ")}`);

      execFile(cli.path, args, (error, stdout, stderr) => {
        if (error) {
          this.outputChannel.appendLine(`Error: ${stderr || error.message}`);
          reject(new Error(stderr || error.message));
          return;
        }
        this.outputChannel.appendLine(stdout);
        resolve();
      });
    });
  }

  /**
   * Unenrolls the device.
   */
  async unenrollDevice(deviceAddress: string): Promise<void> {
    const cli = await WendyCLI.create();
    if (!cli) {
      throw new Error("Wendy CLI not found");
    }

    return new Promise((resolve, reject) => {
      const args = ["device", "unenroll", "--device", deviceAddress];
      this.outputChannel.appendLine(`Executing: ${cli.path} ${args.join(" ")}`);

      execFile(cli.path, args, (error, stdout, stderr) => {
        if (error) {
          this.outputChannel.appendLine(`Error: ${stderr || error.message}`);
          reject(new Error(stderr || error.message));
          return;
        }
        this.outputChannel.appendLine(stdout);
        resolve();
      });
    });
  }

  /**
   * Gets hardware list from the device.
   * Background call — analytics disabled.
   */
  async getHardware(deviceAddress: string): Promise<HardwareDevice[]> {
    const cli = await WendyCLI.create();
    if (!cli) {
      return [];
    }

    return new Promise((resolve) => {
      const args = ["--json", "device", "hardware", "list", "--device", deviceAddress];
      this.outputChannel.appendLine(`Executing: ${cli.path} ${args.join(" ")}`);

      execFile(
        cli.path,
        args,
        { env: analyticsDisabledEnv() },
        (error, stdout) => {
          if (error) {
            resolve([]);
            return;
          }
          try {
            const hardware = JSON.parse(stdout);
            resolve(Array.isArray(hardware) ? hardware : []);
          } catch {
            resolve([]);
          }
        }
      );
    });
  }

  /**
   * Scans for devices on the network.
   * Background call — analytics disabled.
   */
  async scanType(type: string): Promise<unknown[]> {
    const cli = await WendyCLI.create();
    if (!cli) {
      return [];
    }

    return new Promise((resolve) => {
      const args = ["--json", "discover", "--type", type];
      this.outputChannel.appendLine(`Executing: ${cli.path} ${args.join(" ")}`);

      execFile(
        cli.path,
        args,
        { env: analyticsDisabledEnv() },
        (error, stdout) => {
          if (error) {
            resolve([]);
            return;
          }
          try {
            const devices = JSON.parse(stdout);
            resolve(Array.isArray(devices) ? devices : []);
          } catch {
            resolve([]);
          }
        }
      );
    });
  }
}
