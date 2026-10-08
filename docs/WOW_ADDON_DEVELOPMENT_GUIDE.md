# World of Warcraft Addon Development, Maintenance & "Vibe Coding" Guide
**Addon:** Haleck Account Importer & Adventure Journal (`HaleckAccountImporter`)  
**Target Clients:** World of Warcraft: Forever (`_classic_beta_`, Interface 16001, Build 16001 / Camelot), Classic Era (11506+), Retail (110100+)  
**Repository Reference & Analysis:** [Haleckson/montedeaddon](https://github.com/Haleckson/montedeaddon.git)

---

## 1. Executive Summary & Lessons Learned from `montedeaddon`

An exhaustive analysis of the 80+ addons and libraries in `montedeaddon.git` (notably `ForeverJourney`, `ForeverChronicle`, `ForeverLibrary`, `DataStore`, `AddonFactory`, `Memento`, `KarakterAnilari`, `EllesmereUI`, and `Leatrix_Plus`) revealed crucial engineering patterns for building stable, crash-free, and truthful WoW addons:

### Key Discoveries from the Reference Ecosystem
1. **WoW Forever Engine Identification (`16001` / `Camelot`):**
   - As documented in `AddonFactory/Core/Tools.lua`, when `version >= 16000 and version < 20000`, the client is identified as **WoW Forever** (`addon.isForever = true; addon.isMainline = true`).
   - The Lua runtime uses modern Mainline C-APIs (`C_Item`, `C_Map`, `C_Timer`, `NineSlice`, `issecretvalue`) while operating on Vanilla 1-60 rulesets and content.
2. **Elimination of Unicode Glyphs (Square Box `[]` Bug):**
   - The standard WoW game font rendering engine does NOT support arbitrary multi-byte UTF-8 emojis (e.g. `📜`, `⚔️`, `🗺️`, `🏆`, `💰`, `⚙️`).
   - Any emoji rendered in a `FontString` results in an ugly missing glyph rectangle (`[]`).
   - **Rule:** Use Blizzard in-game textures (`Interface\Icons\...`) or standard ASCII text badges.
3. **Color Code Strict Formatting (The "f" Prefix Bug):**
   - WoW color escapes require exactly `|cAARRGGBB` (10 characters: `|c` followed by 2 hex alpha digits and 6 hex RGB digits).
   - If a color table stores `"cffc79c6e"` and code writes `"|c" .. color`, the string becomes `|ccffc79c6e` (11 characters). The parser takes `|ccffc79c` as the color code and the trailing `6e` or `f` spills into the character name, producing names like `fHedwings Szian`.
   - **Rule:** Always format colors as `string.format("|cff%02x%02x%02x%s|r", r, g, b, text)` or use clean 6-digit hex values without redundant `cff` concatenation.
4. **Minimap Dragging vs. Click Handling:**
   - In `ForeverJourney/Launcher.lua`, registering both `RegisterForClicks("AnyUp")` and `RegisterForDrag("LeftButton")` requires an `isDragging` state flag set on `OnDragStart` and cleared asynchronously via `C_Timer.After(0, function() self.isDragging = false end)` on `OnDragStop`.
   - This ensures a normal Left-Click toggles the interface immediately, while holding and moving the mouse repositions the button along the minimap rim without accidental click triggers.
5. **Texture Safety & Solid Fallbacks (Yellow Squares Bug):**
   - If `SetTexture(path)` is passed an invalid path, a nil value, or a texture missing an alpha channel, WoW fills the texture rect with a solid bright yellow or checkered green error texture.
   - **Rule:** Always use safe wrapper functions (`pcall(texture.SetTexture, texture, path)`) and fallback to `texture:SetColorTexture(r, g, b, a)` or verified Blizzard icons (`Interface\Icons\INV_Misc_QuestionMark`).
6. **Zero-Hallucination Data Guarantee:**
   - Never populate the UI or SavedVariables with static dummy tables (e.g., hardcoded feats of strength, phantom drops, or fake world boss victories).
   - Only write data that has been verified through game events: `PLAYER_LOGIN`, `PLAYER_LEVEL_UP`, `PLAYER_DEAD`, `ZONE_CHANGED_NEW_AREA`, `QUEST_TURNED_IN`, `TRADE_CLOSED`, `COMBAT_LOG_EVENT_UNFILTERED`, and real queries (`GetInventoryItemLink`, `GetMoney`, `C_QuestLog.GetAllCompletedQuestIDs`).
7. **English Language Exclusivity:**
   - For consistency across international realms, Armory integrations, and API syncs, all terminology, categories, item slots, log events, and interface labels MUST be written in English.

---

## 2. Library Analysis & Outdated Library Warnings (Zero Legacy Dependency)

A crucial finding when evaluating libraries for **WoW Forever (Build 16001 / Camelot)** is the danger of relying on legacy libraries created for ancient expansions:

### ⚠️ Critical Warning on Legacy Libraries:
* **`LibDataBroker-1.1` (Created ~2009) & Legacy LibDBIcon:**
  * Highly outdated and architecturally mismatched with the modern C-API runtime of WoW Forever.
  * Attempting to load legacy LDB or ancient Broker wrappers can produce silent nil-indexing, taint frame strata, and break event handling in modern 16001 clients.
* **Legacy Ace2 / Old Ace3 Forks:**
  * Many older Ace3 forks still make unpcalled calls to deprecated globals like `GetItemInfo` or obsolete chat print functions that throw fatal errors in WoW Forever.

### ✅ The "Zero Legacy Dependency" Philosophy:
For `HaleckAccountImporter`, we adopt a strict **Zero External Library Dependency** rule:
* **Pure Modern Blizzard APIs:** The addon relies exclusively on native modern APIs provided by the WoW Forever engine: `C_Item`, `C_Map`, `C_Timer`, `C_QuestLog`, `BackdropTemplate`, and native `Minimap` vector positioning.
* **Standalone Minimap Launcher:** Instead of depending on LDB/LibDBIcon, `HaleckAccountImporter` uses a high-performance, native draggable circular launcher directly attached to `Minimap` with clean `isDragging` event throttling.
* **Immunity to Breaking Updates:** Because it imports zero external libraries, `HaleckAccountImporter` cannot be broken by third-party library conflicts, outdated addon packages, or missing dependencies.

| Library Type | Status in WoW Forever | Haleck Account Importer Policy |
| :--- | :--- | :--- |
| **LibDataBroker-1.1** | ❌ Deprecated / Incompatible (2009) | **Do NOT use.** Replaced with native Blizzard Minimap anchor. |
| **LibDBIcon-1.0** | ⚠️ Risky if bundled with old LDB | **Do NOT use.** Native circular button handles drag/click natively. |
| **Ace3 (Legacy)** | ⚠️ Prone to taint / deprecated globals | **Do NOT use.** Native event frame handles all subscriptions. |
| **Native Modern APIs** | ✅ 100% Supported (`16001`) | **Standard.** `C_Item`, `C_Map`, `C_Timer`, `C_QuestLog`, `BackdropTemplate`. |

---

## 3. Addon Architecture & Directory Layout

```
World of Warcraft/_classic_beta_/Interface/AddOns/HaleckAccountImporter/
├── HaleckAccountImporter.toc             # Universal TOC (Forever 16001, Classic 11506, Retail 110100)
├── HaleckAccountImporter_Vanilla.toc     # Classic Era & WoW Forever specialized TOC
├── HaleckAccountImporter_Mainline.toc    # Retail specialized TOC
├── HaleckAccountImporter_TBC.toc         # TBC Classic TOC
├── HaleckAccountImporter_Wrath.toc       # WotLK Classic TOC
├── HaleckAccountImporter_Cata.toc        # Cataclysm & MoP Classic TOC
├── HaleckAccountImporter.lua             # Core engine: event listener, data harvester, persistence, export
└── AddonInterface.lua                    # Visual UI: Obsidian/Gold window, Journal tabs, Minimap launcher
```

---

## 4. Core Development Guidelines for Future "Vibe Coding" Sessions

When prompting any AI or developing new features for `HaleckAccountImporter`, strictly adhere to these 8 Golden Rules:

### Rule 1: Always Wrap Client APIs in `pcall`
Between WoW client expansions (1.12 Vanilla -> 16001 Forever -> 11.0 Mainline), global function names change. Never call `GetItemInfo` or `C_Map` directly without checking:
```lua
local function SafeGetItemInfo(identifier)
    if not identifier then return nil end
    if C_Item and C_Item.GetItemInfo then
        local ok, name, link, quality, iLevel, reqLevel, class, subclass, maxStack, equipSlot, icon = pcall(C_Item.GetItemInfo, identifier)
        if ok and name then return name, link, quality, iLevel, reqLevel, class, subclass, maxStack, equipSlot, icon end
    end
    if GetItemInfo then
        local ok, name, link, quality, iLevel, reqLevel, class, subclass, maxStack, equipSlot, icon = pcall(GetItemInfo, identifier)
        if ok and name then return name, link, quality, iLevel, reqLevel, class, subclass, maxStack, equipSlot, icon end
    end
    return nil
end
```

### Rule 2: Respect Secret Values (`issecretvalue`)
In modern WoW builds (11.0+ and Forever), certain combat and player properties are marked as "Secret Values". Accessing them as strings or numbers without checking throws a Lua error:
```lua
local function IsSecret(...)
    if not issecretvalue then return false end
    for i = 1, select("#", ...) do
        if issecretvalue((select(i, ...))) then return true end
    end
    return false
end
```

### Rule 3: Coordinate & Location Tracking (Zones AND Subzones)
Always track both the broad zone (`GetRealZoneText()`) and the immediate subzone / landmark (`GetSubZoneText()`) along with map coordinates:
```lua
local function SafeGetLocation()
    local zone = GetRealZoneText and GetRealZoneText() or ""
    local subZone = GetSubZoneText and GetSubZoneText() or ""
    local mapID, x, y = nil, 0, 0
    if C_Map and C_Map.GetBestMapForUnit then
        local ok, m = pcall(C_Map.GetBestMapForUnit, "player")
        if ok and m and not IsSecret(m) then
            mapID = m
            local posOk, pos = pcall(C_Map.GetPlayerMapPosition, mapID, "player")
            if posOk and pos and not IsSecret(pos) then
                if pos.GetXY then
                    local xyOk, px, py = pcall(pos.GetXY, pos)
                    if xyOk and px and py then x, y = math.floor(px * 1000) / 10, math.floor(py * 1000) / 10 end
                elseif pos.x and pos.y then
                    x, y = math.floor(pos.x * 1000) / 10, math.floor(pos.y * 1000) / 10
                end
            end
        end
    end
    return zone, subZone, mapID, x, y
end
```

### Rule 4: Canonical World Bosses for WoW Forever (Vanilla+)
Only track authentic World Bosses and use verified Blizzard icon textures:
- **Lord Kazzak:** Tainted Scar, Blasted Lands (`Interface\Icons\Spell_Shadow_SummonFelguard`)
- **Azuregos:** Azshara (`Interface\Icons\INV_Misc_Head_Dragon_Blue`)
- **Dragons of Nightmare:**
  - **Emeriss:** (`Interface\Icons\INV_Misc_Head_Dragon_Green`)
  - **Lethon:** (`Interface\Icons\INV_Misc_Head_Dragon_Green`)
  - **Taerar:** (`Interface\Icons\INV_Misc_Head_Dragon_Green`)
  - **Ysondre:** (`Interface\Icons\INV_Misc_Head_Dragon_Green`)

### Rule 5: Zero-Hallucination Journal & Statistics
- Timeline entries must be appended only when the corresponding event fires (`PLAYER_LEVEL_UP`, `PLAYER_DEAD`, `QUEST_TURNED_IN`, verified boss death).
- Do not insert dummy "placeholder" cards or fabricate completed achievements. If no bosses have been defeated, display an informative empty state: *"No world bosses defeated yet. Venture forth into Azeroth to claim victory!"*

### Rule 6: Full Equipment Resolution (Slots 1 to 19)
Scan all 19 standard equipment slots using `GetInventoryItemLink("player", slotId)`. If an item is unequipped, display the clean slot name and *"Empty"* description. Never substitute a dummy item.

### Rule 7: Cohesive Visual Theme
- Window: 960x620 px dark obsidian frame (`0.07, 0.09, 0.12, 0.96`), cyan gold accents (`#00f2fe` and `#ffd100`).
- Borders: Crisp 1px cyan-tinted borders (`0.0, 0.95, 1.0, 0.35`).
- FontStrings: Use standard `GameFontNormal`, `GameFontHighlight`, and `GameFontDisable` templates.
- Buttons: Styled with dark backdrop and gold/cyan text; avoid default grey Blizzard UIPanel buttons.

### Rule 8: Backend Synchronization Compatibility
The snapshot generated by `HaleckAccountImporter_GenerateSnapshot()` is serialized into JSON / Base64 and stored in `HaleckAccountImporterDB.lastExport`. It must match the data schema ingested by the website backend:
- `POST /api/blizzard/wow/addon-sync`
- Supported payload fields: `character`, `stats`, `equipment`, `bags`, `bank`, `quests`, `spells`, `talents`, `skills`, `reputations`, `journal`, `worldBosses`, `tradeHistory`, `stepCounter`.

---
*Created for the Haleck GameLog & WoW Forever Ecosystem.*
