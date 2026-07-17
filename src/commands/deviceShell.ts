import * as vscode from "vscode";
import { WendyCLI } from "../wendy-cli/wendy-cli";

/**
 * Opens an interactive host shell on a WendyOS device by running
 * `wendy device shell --device <address>` in a VS Code integrated terminal.
 *
 * Mirrors the pattern used by `wendyHardware.watchCamera` and other device
 * terminal commands. The CLI's `device shell` subcommand was added in PR #1401
 * and requires an interactive TTY — a VS Code terminal satisfies this.
 *
 * @param deviceAddress  The target device address (IP or hostname).
 * @param shellCommand   Optional argv to pass after `--` (runs instead of the
 *                       login shell). Omit or pass an empty array for the
 *                       default login shell.
 */
export async function openDeviceShell(
  deviceAddress: string,
  shellCommand: string[] = []
): Promise<void> {
  const cli = await WendyCLI.create();
  if (!cli) {
    vscode.window.showErrorMessage("Wendy CLI not found");
    return;
  }

  const args: string[] = ["device", "shell", "--device", deviceAddress];
  if (shellCommand.length > 0) {
    args.push("--", ...shellCommand);
  }

  const terminal = vscode.window.createTerminal({
    name: `Shell: ${deviceAddress}`,
    shellPath: cli.path,
    shellArgs: args,
  });
  terminal.show();
}

/**
 * Registers the `wendyDevices.openShell` command with VS Code.
 *
 * The command expects to be called with a device tree item that has an
 * `address` property (matching the shape used by other device commands in
 * the extension). It is intended to be wired into `package.json` under
 * `contributes.commands` (icon `$(terminal)`, title "Open Host Shell") and
 * `contributes.menus["view/item/context"]` for the `wendyDevices` view.
 *
 * Example package.json additions:
 *
 * ```json
 * // contributes.commands
 * {
 *   "command": "wendyDevices.openShell",
 *   "title": "Open Host Shell",
 *   "icon": "$(terminal)"
 * }
 *
 * // contributes.menus["view/item/context"]
 * {
 *   "command": "wendyDevices.openShell",
 *   "when": "view == wendyDevices && viewItem == device",
 *   "group": "inline"
 * }
 * ```
 *
 * Example extension.ts wiring (inside context.subscriptions.push(...)):
 *
 * ```ts
 * vscode.commands.registerCommand("wendyDevices.openShell", async (item) => {
 *   if (!item?.address) { return; }
 *   await openDeviceShell(item.address);
 * }),
 * ```
 */
export function registerDeviceShellCommand(
  context: vscode.ExtensionContext
): vscode.Disposable {
  return vscode.commands.registerCommand(
    "wendyDevices.openShell",
    async (item: { address?: string } | undefined) => {
      if (!item?.address) {
        vscode.window.showErrorMessage(
          "No device selected. Please select a device in the Devices panel."
        );
        return;
      }
      await openDeviceShell(item.address);
    }
  );
}
