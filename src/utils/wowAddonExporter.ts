/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export {
  downloadWoWAddonZip,
  syncAddonDataToPersistentEndpoint,
} from "./addonExportService";
export type { AddonExportOptions } from "./addonExportService";

import { downloadWoWAddonZip } from "./addonExportService";

/**
 * Backward compatibility alias for downloadHaloWoWAddonZip
 */
export async function downloadHaloWoWAddonZip(): Promise<void> {
  return await downloadWoWAddonZip({ gameVersion: "forever" });
}
