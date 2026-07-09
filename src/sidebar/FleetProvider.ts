import * as vscode from "vscode";
import { FleetManager, FleetGroup, FleetDevice } from "../models/FleetManager";

type FleetTreeItem = FleetGroupItem | FleetDeviceItem | FleetEmptyItem;

/**
 * Represents a device group in the Fleet sidebar tree.
 */
export class FleetGroupItem extends vscode.TreeItem {
  readonly kind = "group" as const;

  constructor(public readonly group: FleetGroup) {
    super(group.group, vscode.TreeItemCollapsibleState.Collapsed);
    this.description = `${group.devices} device${group.devices === 1 ? "" : "s"}`;
    this.contextValue = "fleetGroup";
    this.iconPath = new vscode.ThemeIcon("layers");
    this.tooltip = `Group: ${group.group} — ${group.devices} device(s)`;
  }
}

/**
 * Represents a device that is a member of a fleet group in the sidebar tree.
 */
export class FleetDeviceItem extends vscode.TreeItem {
  readonly kind = "device" as const;

  constructor(
    public readonly device: FleetDevice,
    public readonly groupName: string
  ) {
    super(device.name, vscode.TreeItemCollapsibleState.None);
    this.description = device.address || device.type;
    this.contextValue = "fleetDevice";
    this.iconPath = new vscode.ThemeIcon("device-desktop");
    this.tooltip = `${device.name} (id: ${device.id}${device.address ? ", " + device.address : ""})`;
  }
}

/**
 * Placeholder item shown when there are no groups yet.
 */
class FleetEmptyItem extends vscode.TreeItem {
  readonly kind = "empty" as const;

  constructor() {
    super("No device groups yet", vscode.TreeItemCollapsibleState.None);
    this.description = "Use 'wendy fleet group add' to create one";
    this.contextValue = "fleetEmpty";
    this.iconPath = new vscode.ThemeIcon("info");
  }
}

/**
 * Tree data provider for the Fleet sidebar view (wendyFleet).
 *
 * Shows the output of `wendy fleet group ls` as top-level nodes. Expanding a
 * group node calls `wendy fleet group show` to list its member devices.
 *
 * Registered against the view ID `wendyFleet` declared in package.json.
 */
export class FleetProvider
  implements vscode.TreeDataProvider<FleetTreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    FleetTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly fleetManager: FleetManager) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: FleetTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: FleetTreeItem): Promise<FleetTreeItem[]> {
    if (!element) {
      // Root: list all groups.
      try {
        const groups = await this.fleetManager.listGroups();
        if (groups.length === 0) {
          return [new FleetEmptyItem()];
        }
        return groups.map((g) => new FleetGroupItem(g));
      } catch {
        return [new FleetEmptyItem()];
      }
    }

    if (element.kind === "group") {
      // Group node: list member devices.
      try {
        const devices = await this.fleetManager.showGroup(element.group.group);
        if (devices.length === 0) {
          const empty = new FleetEmptyItem();
          empty.label = "No devices in this group";
          empty.description = "";
          return [empty];
        }
        return devices.map((d) => new FleetDeviceItem(d, element.group.group));
      } catch {
        return [];
      }
    }

    return [];
  }
}
