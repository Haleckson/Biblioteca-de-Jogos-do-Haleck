with open("server.ts", "r") as f:
    lines = f.readlines()

new_block = """    // Only return mock catalog if demo is explicitly requested (?demo=true)
    // Never inject fake/unwanted characters into real account synchronization!
    const isDemoRequested = req.query.demo === "true";
    const queryCharName = (req.query.character as string) || (req.query.name as string) || (req.query.characterName as string);
    const queryRealm = (req.query.realm as string) || (req.query.realmSlug as string) || "azralon";

    if (characters.length === 0 && queryCharName) {
      // Attempt to fetch specific character directly from public Blizzard API using client credentials
      const rSlug = queryRealm.toLowerCase().replace(/['\s]+/g, "-");
      const cName = queryCharName.toLowerCase();
      const credToken = (await getBlizzardClientCredentialsToken(region)) || "";
      if (credToken) {
        try {
          const namespacesToTry = [
            `profile-${region}`,
            `profile-classic1x-${region}`,
            `profile-classic-${region}`,
          ];
          for (const ns of namespacesToTry) {
            const charUrl = `https://${region}.api.blizzard.com/profile/wow/character/${encodeURIComponent(rSlug)}/${encodeURIComponent(cName)}?namespace=${ns}&locale=en_US`;
            const charRes = await fetch(charUrl, { headers: { Authorization: `Bearer ${credToken}` } });
            if (charRes.ok) {
              const cd = await charRes.json();
              const charFaction = cd.faction?.type || "HORDE";
              const charRace = cd.race?.name || "Orc";
              const charCls = cd.character_class?.name || "Warrior";
              const charGender = cd.gender?.type || "MALE";
              const modeTag = ns.includes("classic1x") ? "classic" : ns.includes("classic") ? "mop" : "retail";

              characters.push({
                id: cd.id || Date.now(),
                name: cd.name,
                realm: cd.realm?.name || queryRealm,
                realmSlug: cd.realm?.slug || rSlug,
                level: cd.level || 80,
                characterClass: charCls,
                race: charRace,
                faction: charFaction,
                equippedItemLevel: cd.equipped_item_level || 620,
                averageItemLevel: cd.average_item_level || cd.equipped_item_level || 620,
                activeSpec: cd.active_spec?.name || "Primary Specialization",
                gender: charGender,
                gameMode: modeTag,
                wow_version: modeTag,
                classIconUrl: getWowClassIcon(charCls),
                raceIconUrl: getWowRaceIcon(charRace, charGender),
                factionIconUrl: getWowFactionIcon(charFaction, charRace),
                avatarUrl: getWowRaceIcon(charRace, charGender),
              });
              break;
            }
          }
        } catch (e) {
          console.warn("Could not fetch individual character via client credentials:", e);
        }
      }
    }

    if (characters.length === 0 && isDemoRequested) {
      const defaultCatalog: Record<string, any[]> = {
        retail: [
          {
            name: "Haleck",
            realm: "Azralon",
            realmSlug: "azralon",
            level: 80,
            characterClass: "Warrior",
            race: "Orc",
            faction: "HORDE",
            equippedItemLevel: 625,
            averageItemLevel: 625,
            activeSpec: "Fury",
            gender: "MALE",
            gameMode: "retail",
            wow_version: "retail",
            classIconUrl: getWowClassIcon("Warrior"),
            raceIconUrl: getWowRaceIcon("Orc", "MALE"),
            factionIconUrl: getWowFactionIcon("HORDE"),
            avatarUrl: getWowRaceIcon("Orc", "MALE"),
          },
        ],
        classic: [
          {
            name: "Haleck",
            realm: "Whitemane",
            realmSlug: "whitemane",
            level: 60,
            characterClass: "Warrior",
            race: "Orc",
            faction: "HORDE",
            equippedItemLevel: 80,
            averageItemLevel: 80,
            activeSpec: "Arms",
            gender: "MALE",
            gameMode: "classic",
            wow_version: "classic",
            classIconUrl: getWowClassIcon("Warrior"),
            raceIconUrl: getWowRaceIcon("Orc", "MALE"),
            factionIconUrl: getWowFactionIcon("HORDE"),
            avatarUrl: getWowRaceIcon("Orc", "MALE"),
          },
        ],
        mop: [],
      };

      if (targetMode === "classic" || targetMode === "forever") {
        characters = defaultCatalog.classic;
      } else if (targetMode === "mop" || targetMode === "tbc") {
        characters = defaultCatalog.mop;
      } else if (targetMode === "retail") {
        characters = defaultCatalog.retail;
      } else {
        characters = [...defaultCatalog.retail, ...defaultCatalog.classic];
      }
    }
"""

# Verify markers
assert "Fallback if no characters found" in lines[4117]
assert "Sort: Highest level first" in lines[4386]

lines[4117:4385] = [new_block]

with open("server.ts", "w") as f:
    f.writelines(lines)

print("SUCCESS: server.ts updated")
