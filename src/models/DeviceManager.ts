import * as vscode from "vscode";
import { execFile } from "child_process";
import { WendyCLI } from "../wendy-cli/wendy-cli";
import { Device, DeviceInfo } from "./Device";
import { analyticsDisabledEnv } from "../utilities/utilities";

export class DeviceManager {
  private outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  async scanType(type: "fast" | "slow"): Promise<Device[]> {
    const cli = await WendyCLI.create();
    if (!cli) {
      return [];
    }

    const args =
      type === "fast"
        ? ["discover", "--json", "--timeout", "2"]
        : ["discover", "--json", "--timeout", "10"];

    return new Promise((resolve) => {
      execFile(
        cli.path,
        args,
        { env: analyticsDisabledEnv() },
        (error, stdout) => {
          if (error || !stdout.trim()) {
            resolve([]);
            return;
          }
          try {
            resolve(JSON.parse(stdout));
          } catch {
            resolve([]);
          }
        }
      );
    });
  }

  async checkForUpdates(deviceAddress: string): Promise<DeviceInfo | null> {
    const cli = await WendyCLI.create();
    if (!cli) {
      return null;
    }

    return new Promise((resolve) => {
      execFile(
        cli.path,
        ["device", "info", "--check-updates", "--json", "--device", deviceAddress],
        { env: analyticsDisabledEnv() },
        (error, stdout) => {
          if (error || !stdout.trim()) {
            resolve(null);
            return;
          }
          try {
            resolve(JSON.parse(stdout));
          } catch {
            resolve(null);
          }
        }
      );
    });
  }

  async getHardware(deviceAddress: string): Promise<unknown[]> {
    const cli = await WendyCLI.create();
    if (!cli) {
      return [];
    }

    return new Promise((resolve) => {
      execFile(
        cli.path,
        ["device", "hardware", "list", "--json", "--device", deviceAddress],
        { env: analyticsDisabledEnv() },
        (error, stdout) => {
          if (error || !stdout.trim()) {
            resolve([]);
            return;
          }
          try {
            resolve(JSON.parse(stdout));
          } catch {
            resolve([]);
          }
        }
      );
    });
  }

  async listApps(deviceAddress: string): Promise<unknown[]> {
    const cli = await WendyCLI.create();
    if (!cli) {
      return [];
    }

    return new Promise((resolve) => {
      execFile(
        cli.path,
        ["device", "apps", "list", "--json", "--device", deviceAddress],
        { env: analyticsDisabledEnv() },
        (error, stdout) => {
          if (error || !stdout.trim()) {
            resolve([]);
            return;
          }
          try {
            resolve(JSON.parse(stdout));
          } catch {
            resolve([]);
          }
        }
      );
    });
  }

  async getWifiStatus(deviceAddress: string): Promise<unknown> {
    const cli = await WendyCLI.create();
    if (!cli) {
      return null;
    }

    return new Promise((resolve, reject) => {
      execFile(
        cli.path,
        ["device", "wifi", "status", "--json", "--device", deviceAddress],
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || error.message));
            return;
          }
          try {
            resolve(JSON.parse(stdout));
          } catch {
            resolve(null);
          }
        }
      );
    });
  }

  async connectWifi(
    deviceAddress: string,
    ssid: string,
    password: string
  ): Promise<void> {
    const cli = await WendyCLI.create();
    if (!cli) {
      throw new Error("Wendy CLI not found");
    }

    return new Promise((resolve, reject) => {
      execFile(
        cli.path,
        [
          "device",
          "wifi",
          "connect",
          "--device",
          deviceAddress,
          "--ssid",
          ssid,
          "--password",
          password,
        ],
        (error, _stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || error.message));
            return;
          }
          resolve();
        }
      );
    });
  }

  async disconnectWifi(deviceAddress: string): Promise<void> {
    const cli = await WendyCLI.create();
    if (!cli) {
      throw new Error("Wendy CLI not found");
    }

    return new Promise((resolve, reject) => {
      execFile(
        cli.path,
        ["device", "wifi", "disconnect", "--device", deviceAddress],
        (error, _stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || error.message));
            return;
          }
          resolve();
        }
      );
    });
  }

  async startApp(appName: string, deviceAddress: string): Promise<void> {
    const cli = await WendyCLI.create();
    if (!cli) {
      throw new Error("Wendy CLI not found");
    }

    return new Promise((resolve, reject) => {
      execFile(
        cli.path,
        ["device", "apps", "start", appName, "--device", deviceAddress],
        (error, _stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || error.message));
            return;
          }
          resolve();
        }
      );
    });
  }

  async stopApp(appName: string, deviceAddress: string): Promise<void> {
    const cli = await WendyCLI.create();
    if (!cli) {
      throw new Error("Wendy CLI not found");
    }

    return new Promise((resolve, reject) => {
      execFile(
        cli.path,
        ["device", "apps", "stop", appName, "--device", deviceAddress],
        (error, _stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || error.message));
            return;
          }
          resolve();
        }
      );
    });
  }

  async removeApp(appName: string, deviceAddress: string): Promise<void> {
    const cli = await WendyCLI.create();
    if (!cli) {
      throw new Error("Wendy CLI not found");
    }

    return new Promise((resolve, reject) => {
      execFile(
        cli.path,
        ["device", "apps", "remove", appName, "--device", deviceAddress],
        (error, _stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || error.message));
            return;
          }
          resolve();
        }
      );
    });
  }

  async updateAgent(deviceAddress: string): Promise<void> {
    const cli = await WendyCLI.create();
    if (!cli) {
      throw new Error("Wendy CLI not found");
    }

    return new Promise((resolve, reject) => {
      execFile(
        cli.path,
        ["device", "update", "--device", deviceAddress],
        (error, _stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || error.message));
            return;
          }
          resolve();
        }
      );
    });
  }

  async unenrollDevice(deviceAddress: string): Promise<void> {
    const cli = await WendyCLI.create();
    if (!cli) {
      throw new Error("Wendy CLI not found");
    }

    return new Promise((resolve, reject) => {
      execFile(
        cli.path,
        ["device", "unenroll", "--device", deviceAddress],
        (error, _stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || error.message));
            return;
          }
          resolve();
        }
      );
    });
  }

  /**
   * Install an app from the Wendy AppStore onto a device.
   *
   * Wraps `wendy app install <app-id> [--device <addr>] [--no-start]`.
   * This is a user-initiated action; analytics are intentionally left ON.
   *
   * @param appId    The AppStore app identifier (e.g. "jellyfin").
   * @param deviceAddress  Optional device address override; omit to let the
   *                       CLI use its configured default device.
   * @param noStart  When true, create the container but do not start it.
   */
  async installApp(
    appId: string,
    deviceAddress?: string,
    noStart?: boolean
  ): Promise<void> {
    const cli = await WendyCLI.create();
    if (!cli) {
      throw new Error("Wendy CLI not found");
    }

    const args: string[] = ["app", "install", appId];
    if (deviceAddress) {
      args.push("--device", deviceAddress);
    }
    if (noStart) {
      args.push("--no-start");
    }

    this.outputChannel.appendLine(`Executing: ${cli.path} ${args.join(" ")}`);

    return new Promise((resolve, reject) => {
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
}
