/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Authoritative mapping from Mount ID and Name to Spell ID
export const WOW_MOUNT_ID_TO_SPELL: Record<number, number> = {
  // Vanilla / Classic
  6: 458, // Brown Horse
  7: 6648, // Gray Wolf
  8: 472, // White Stallion
  9: 470, // Black Stallion
  11: 459, // Pinto
  12: 580, // Black Wolf
  13: 6650, // Red Wolf
  14: 6649, // Timber Wolf
  15: 6652, // Winter Wolf
  17: 5784, // Felsteed
  18: 456, // Chestnut Mare
  19: 6651, // Dire Wolf
  20: 579, // Brown Wolf
  21: 6777, // Gray Ram
  22: 6898, // Black Ram
  24: 6899, // White Ram
  25: 6778, // Brown Ram
  26: 8395, // Striped Frostsaber
  27: 10796, // Emerald Raptor
  28: 17462, // Red Skeletal Horse
  31: 8394, // Spotted Frostsaber
  32: 8394, // Tiger
  34: 8395, // Striped Nightsaber
  35: 10799, // Ivory Raptor
  36: 10796, // Turquoise Raptor
  38: 10798, // Violet Raptor
  39: 10873, // Red Mechanostrider
  40: 10907, // Blue Mechanostrider
  41: 13819, // Warhorse
  42: 10906, // White Mechanostrider
  43: 10908, // Green Mechanostrider
  45: 16055, // Black Nightsaber
  46: 16056, // Ancient Frostsaber
  47: 16058, // Frostsaber
  50: 16080, // Arctic Wolf
  51: 16081, // Winter Wolf
  52: 16082, // Palomino
  53: 16083, // White Stallion
  54: 16084, // Mottled Red Raptor
  56: 13055, // Winterspring Frostsaber
  64: 17460, // Frost Ram
  70: 18989, // Rivendare's Deathcharger
  71: 18990, // Gray Kodo
  72: 18991, // Brown Kodo
  73: 18992, // Green Kodo
  74: 18989, // Teal Kodo
  81: 22717, // Black War Tiger
  82: 22718, // Black War Wolf
  83: 23161, // Dreadsteed
  84: 23214, // Charger
  116: 25863, // Black Qiraji Battle Tank
  117: 25953, // Blue Qiraji Battle Tank
  118: 26056, // Red Qiraji Battle Tank
  119: 26054, // Yellow Qiraji Battle Tank
  120: 26055, // Green Qiraji Battle Tank
  183: 32458, // Ashes of A'lar
  185: 32768, // Raven Lord
  196: 42777, // Swift Spectral Tiger
  197: 42776, // Spectral Tiger
  199: 43688, // Amani War Bear
  304: 63956, // Mimiron's Head
  363: 72286, // Invincible
};

export const WOW_MOUNT_NAME_TO_SPELL: Record<string, number> = {
  brownhorse: 458,
  graywolf: 6648,
  whitestallion: 472,
  blackstallion: 470,
  pinto: 459,
  blackwolf: 580,
  redwolf: 6650,
  timberwolf: 6649,
  winterwolf: 6652,
  felsteed: 5784,
  chestnutmare: 456,
  direwolf: 6651,
  brownwolf: 579,
  grayram: 6777,
  blackram: 6898,
  whiteram: 6899,
  brownram: 6778,
  stripedfrostsaber: 8395,
  emeraldraptor: 10796,
  redskeletalhorse: 17462,
  spottedfrostsaber: 8394,
  stripednightsaber: 8395,
  ivoryraptor: 10799,
  turquoiseraptor: 10796,
  violetraptor: 10798,
  redmechanostrider: 10873,
  bluemechanostrider: 10907,
  warhorse: 13819,
  palomino: 16082,
  winterspringfrostsaber: 13055,
  rivendaresdeathcharger: 18989,
  graykodo: 18990,
  brownkodo: 18991,
  greenkodo: 18992,
  tealkodo: 18989,
  blackwartiger: 22717,
  blackwarwolf: 22718,
  dreadsteed: 23161,
  charger: 23214,
  blackqirajibattletank: 25863,
  blueqirajibattletank: 25953,
  redqirajibattletank: 26056,
  yellowqirajibattletank: 26054,
  greenqirajibattletank: 26055,
  ashesofalar: 32458,
  ravenlord: 32768,
  spectraltiger: 42776,
  swiftspectraltiger: 42777,
  amaniwarbear: 43688,
  mimironshead: 63956,
  invincible: 72286,
};
