import * as vscode from "vscode";
import { execFile } from "child_process";
import { WendyCLI } from "../wendy-cli/wendy-cli";
import { analyticsDisabledEnv } from "../utilities/utilities";

export interface FleetGroup {
  group: string;
  devices: number;
}

export interface FleetDevice {
  id: number;
  name: string;
  type: string;
  address: string;
}

export interface FleetAppRow {
  device: string;
  assetId: number;
  app?: string;
  version?: string;
  state?: string;
  errors?: number;
  error?: string;
}

export interface FleetRunResult {
  device: string;
  assetId: number;
  ok: boolean;
  error?: string;
}

export interface FleetMembershipResult {
  device: string;
  assetId?: number;
  changed: boolean;
  error?: string;
}

export interface FleetRunOptions {
  /** Extra CLI flags forwarded to `wendy fleet run`. */
  keepGoing?: boolean;
  debug?: boolean;
}

/**
 * Wraps the `wendy fleet` CLI commands introduced in CLI PR #1238 (WDY-1757).
 *
 * - fleet group ls         → listGroups()
 * - fleet group show       → showGroup()
 * - fleet group add        → addDevicesToGroup()
 * - fleet group rm         → removeDevicesFromGroup()
 * - fleet apps             → listApps()
 * - fleet run              → runFleet()
 */
export class FleetManager {
  constructor(private outputChannel: vscode.OutputChannel) {}

  /**
   * `wendy fleet group ls --json`
   * Lists all device groups and their member counts.
   */
  async listGroups(): Promise<FleetGroup[]> {
    const cli = await WendyCLI.create();
    if (!cli) {
      throw new Error("Wendy CLI not found");
    }
    const args = ["--json", "fleet", "group", "ls"];
    this.outputChannel.appendLine(`Executing: ${cli.path} ${args.join(" ")}`);

    return new Promise((resolve, reject) => {
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
            const groups: FleetGroup[] = JSON.parse(stdout);
            resolve(groups);
          } catch {
            resolve([]);
          }
        }
      );
    });
  }

  /**
   * `wendy fleet group show <group> --json`
   * Lists the devices in a named group.
   */
  async showGroup(group: string): Promise<FleetDevice[]> {
    const cli = await WendyCLI.create();
    if (!cli) {
      throw new Error("Wendy CLI not found");
    }
    const args = ["--json", "fleet", "group", "show", group];
    this.outputChannel.appendLine(`Executing: ${cli.path} ${args.join(" ")}`);

    return new Promise((resolve, reject) => {
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
            const devices: FleetDevice[] = JSON.parse(stdout);
            resolve(devices);
          } catch {
            resolve([]);
          }
        }
      );
    });
  }

  /**
   * `wendy fleet group add <group> <device>... --json`
   * Adds one or more devices to a group.
   */
  async addDevicesToGroup(
    group: string,
    devices: string[]
  ): Promise<FleetMembershipResult[]> {
    const cli = await WendyCLI.create();
    if (!cli) {
      throw new Error("Wendy CLI not found");
    }
    const args = ["--json", "fleet", "group", "add", group, ...devices];
    this.outputChannel.appendLine(`Executing: ${cli.path} ${args.join(" ")}`);

    return new Promise((resolve, reject) => {
      execFile(cli.path, args, (error, stdout, stderr) => {
        if (error) {
          // Partial failures exit non-zero but produce JSON — try to parse first.
          try {
            const results: FleetMembershipResult[] = JSON.parse(stdout);
            resolve(results);
            return;
          } catch {
            // fall through
          }
          this.outputChannel.appendLine(`Error: ${stderr || error.message}`);
          reject(new Error(stderr || error.message));
          return;
        }
        try {
          const results: FleetMembershipResult[] = JSON.parse(stdout);
          resolve(results);
        } catch {
          resolve([]);
        }
      });
    });
  }

  /**
   * `wendy fleet group rm <group> <device>... --json`
   * Removes one or more devices from a group.
   */
  async removeDevicesFromGroup(
    group: string,
    devices: string[]
  ): Promise<FleetMembershipResult[]> {
    const cli = await WendyCLI.create();
    if (!cli) {
      throw new Error("Wendy CLI not found");
    }
    const args = ["--json", "fleet", "group", "rm", group, ...devices];
    this.outputChannel.appendLine(`Executing: ${cli.path} ${args.join(" ")}`);

    return new Promise((resolve, reject) => {
      execFile(cli.path, args, (error, stdout, stderr) => {
        if (error) {
          try {
            const results: FleetMembershipResult[] = JSON.parse(stdout);
            resolve(results);
            return;
          } catch {
            // fall through
          }
          this.outputChannel.appendLine(`Error: ${stderr || error.message}`);
          reject(new Error(stderr || error.message));
          return;
        }
        try {
          const results: FleetMembershipResult[] = JSON.parse(stdout);
          resolve(results);
        } catch {
          resolve([]);
        }
      });
    });
  }

  /**
   * `wendy fleet apps [--group <group>] --json`
   * Lists apps running across the group (or all devices if group is omitted).
   */
  async listApps(group?: string): Promise<FleetAppRow[]> {
    const cli = await WendyCLI.create();
    if (!cli) {
      throw new Error("Wendy CLI not found");
    }
    const args = ["--json", "fleet", "apps"];
    if (group) {
      args.push("--group", group);
    }
    this.outputChannel.appendLine(`Executing: ${cli.path} ${args.join(" ")}`);

    return new Promise((resolve, reject) => {
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
            const rows: FleetAppRow[] = JSON.parse(stdout);
            resolve(rows);
          } catch {
            resolve([]);
          }
        }
      );
    });
  }

  /**
   * Opens a terminal running `wendy fleet run --group <group>`.
   *
   * Like `wendy run`, this streams multi-device build/deploy output and is
   * always user-initiated, so it runs in a terminal rather than via execFile.
   */
  async runFleet(
    group: string,
    projectPath: string,
    options: FleetRunOptions = {}
  ): Promise<void> {
    const cli = await WendyCLI.create();
    if (!cli) {
      throw new Error("Wendy CLI not found");
    }

    const args = ["fleet", "run", "--group", group];
    if (options.keepGoing) {
      args.push("--keep-going");
    }
    if (options.debug) {
      args.push("--debug");
    }

    const terminal = vscode.window.createTerminal({
      name: `Wendy Fleet: ${group}`,
      cwd: projectPath,
    });
    terminal.show();
    terminal.sendText(`${cli.path} ${args.join(" ")}`);
  }
}
