/**
 * Storage Manager for Planeswalker EDH Playgroup App
 * Manages local persistence for players, decks, playgroups, matches, and settings.
 * Prepares the offline data to be wrapped under a single Club banner for future sync.
 */

const STORAGE_KEYS = {
  PLAYERS: 'mtg_pod_players',
  GROUPS: 'mtg_pod_groups',
  HISTORY: 'mtg_pod_history', // Pod organizer history
  SETTINGS: 'mtg_pod_settings',
  MATCHES: 'mtg_pod_matches',   // Roster match history logs
  CLUB_NAME: 'mtg_pod_club_name',
  PRIVACY: 'mtg_pod_privacy'
};

const StorageManager = {
  // --- CLUB & PRIVACY STORAGE ---
  getClubName() {
    try {
      return localStorage.getItem(STORAGE_KEYS.CLUB_NAME) || "Planeswalker Alliance";
    } catch (e) {
      console.error('Failed to read club name', e);
      return "Planeswalker Alliance";
    }
  },

  saveClubName(name) {
    try {
      localStorage.setItem(STORAGE_KEYS.CLUB_NAME, name.trim());
    } catch (e) {
      console.error('Failed to save club name', e);
    }
  },

  getPrivacy() {
    try {
      return localStorage.getItem(STORAGE_KEYS.PRIVACY) === 'public' ? 'public' : 'private';
    } catch (e) {
      console.error('Failed to read privacy toggle', e);
      return 'private';
    }
  },

  savePrivacy(privacy) {
    try {
      localStorage.setItem(STORAGE_KEYS.PRIVACY, privacy === 'public' ? 'public' : 'private');
    } catch (e) {
      console.error('Failed to save privacy toggle', e);
    }
  },

  // --- SETTINGS STORAGE ---
  getSettings() {
    try {
      const defaultSettings = { targetSize: 4 };
      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
    } catch (e) {
      console.error('Failed to read settings from storage', e);
      return { targetSize: 4 };
    }
  },

  saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings to storage', e);
    }
  },

  // --- PLAYERS & PROFILES STORAGE ---
  getPlayers() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PLAYERS);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      // Ensure all players have extended metadata for ELO/bounties/decks
      return parsed.map(p => ({
        id: p.id,
        name: p.name,
        active: p.active !== undefined ? p.active : true,
        decks: p.decks || [],
        elo: p.elo !== undefined ? p.elo : 1200,
        winStreak: p.winStreak !== undefined ? p.winStreak : 0,
        bounty: p.bounty !== undefined ? p.bounty : 0
      }));
    } catch (e) {
      console.error('Failed to read players from storage', e);
      return [];
    }
  },

  savePlayers(players) {
    try {
      localStorage.setItem(STORAGE_KEYS.PLAYERS, JSON.stringify(players));
    } catch (e) {
      console.error('Failed to save players to storage', e);
    }
  },

  addPlayer(name) {
    const trimmed = name.trim();
    if (!trimmed) return null;

    const players = this.getPlayers();
    
    // Prevent exact duplicates in the roster
    const exists = players.some(p => p.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) return null;

    const newPlayer = {
      id: 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      name: trimmed,
      active: true, // Active by default when added
      decks: [],
      elo: 1200,
      winStreak: 0,
      bounty: 0
    };

    players.push(newPlayer);
    this.savePlayers(players);
    return newPlayer;
  },

  addBulkPlayers(namesArray) {
    const players = this.getPlayers();
    const added = [];

    namesArray.forEach(name => {
      const trimmed = name.trim();
      if (!trimmed) return;

      const exists = players.some(p => p.name.toLowerCase() === trimmed.toLowerCase());
      if (!exists) {
        const newPlayer = {
          id: 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          name: trimmed,
          active: true,
          decks: [],
          elo: 1200,
          winStreak: 0,
          bounty: 0
        };
        players.push(newPlayer);
        added.push(newPlayer);
      }
    });

    this.savePlayers(players);
    return added;
  },

  togglePlayerActive(id) {
    const players = this.getPlayers();
    const player = players.find(p => p.id === id);
    if (player) {
      player.active = !player.active;
      this.savePlayers(players);
    }
    return players;
  },

  setAllPlayersActive(activeState) {
    const players = this.getPlayers();
    players.forEach(p => p.active = activeState);
    this.savePlayers(players);
    return players;
  },

  deletePlayer(id) {
    const players = this.getPlayers();
    const filtered = players.filter(p => p.id !== id);
    this.savePlayers(filtered);
    return filtered;
  },

  clearAllPlayers() {
    this.savePlayers([]);
    return [];
  },

  // --- PLAYER DECK STORAGE ---
  addPlayerDeck(playerId, deckName) {
    const trimmed = deckName.trim();
    if (!trimmed) return null;

    const players = this.getPlayers();
    const player = players.find(p => p.id === playerId);
    if (!player) return null;

    if (!player.decks) player.decks = [];
    const exists = player.decks.some(d => d.toLowerCase() === trimmed.toLowerCase());
    if (exists) return null;

    player.decks.push(trimmed);
    this.savePlayers(players);
    return player;
  },

  deletePlayerDeck(playerId, deckName) {
    const players = this.getPlayers();
    const player = players.find(p => p.id === playerId);
    if (!player || !player.decks) return null;

    player.decks = player.decks.filter(d => d !== deckName);
    this.savePlayers(players);
    return player;
  },

  // --- GROUPS STORAGE ---
  getGroups() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.GROUPS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Failed to read groups from storage', e);
      return [];
    }
  },

  saveGroups(groups) {
    try {
      localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
    } catch (e) {
      console.error('Failed to save groups to storage', e);
    }
  },

  saveGroup(groupName, playerNames) {
    const trimmedName = groupName.trim();
    if (!trimmedName || !playerNames.length) return null;

    const groups = this.getGroups();
    
    // Remove group if it already exists to overwrite
    const filteredGroups = groups.filter(g => g.name.toLowerCase() !== trimmedName.toLowerCase());
    
    const newGroup = {
      id: 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      name: trimmedName,
      players: playerNames.map(name => name.trim()).filter(Boolean)
    };

    filteredGroups.push(newGroup);
    this.saveGroups(filteredGroups);
    return newGroup;
  },

  deleteGroup(id) {
    const groups = this.getGroups();
    const filtered = groups.filter(g => g.id !== id);
    this.saveGroups(filtered);
    return filtered;
  },

  // --- ORGANIZER HISTORY STORAGE (PODS) ---
  getHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Failed to read session history from storage', e);
      return [];
    }
  },

  saveHistory(history) {
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    } catch (e) {
      console.error('Failed to save session history to storage', e);
    }
  },

  addHistorySession(pods, targetSize) {
    if (!pods || !pods.length) return null;

    const history = this.getHistory();
    const totalPlayers = pods.reduce((acc, pod) => acc + pod.length, 0);
    
    const newSession = {
      id: 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toISOString(),
      targetSize,
      totalPlayers,
      pods: pods.map(pod => pod.map(p => ({ id: p.id, name: p.name })))
    };

    // Prepend to show latest first
    history.unshift(newSession);
    this.saveHistory(history);
    return newSession;
  },

  deleteHistorySession(id) {
    const history = this.getHistory();
    const filtered = history.filter(h => h.id !== id);
    this.saveHistory(filtered);
    return filtered;
  },

  clearHistory() {
    this.saveHistory([]);
    return [];
  },

  // --- MATCH STATS & ELO ENGINE ---
  getMatches() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.MATCHES);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Failed to read matches from storage', e);
      return [];
    }
  },

  saveMatches(matches) {
    try {
      localStorage.setItem(STORAGE_KEYS.MATCHES, JSON.stringify(matches));
    } catch (e) {
      console.error('Failed to save matches to storage', e);
    }
  },

  clearMatches() {
    this.saveMatches([]);
    // Reset ELO and streaks for all players
    const players = this.getPlayers();
    players.forEach(p => {
      p.elo = 1200;
      p.winStreak = 0;
      p.bounty = 0;
    });
    this.savePlayers(players);
    return [];
  },

  /**
   * Logs a 4-player game match and runs ELO and Bounty calculations.
   * Treating the game as three separate 1-on-1 matches: Winner vs each Loser.
   */
  logMatch(winnerId, winnerDeck, losers) {
    // losers is an array of { id: string, deck: string }
    const players = this.getPlayers();
    const winner = players.find(p => p.id === winnerId);
    if (!winner) return null;

    const winnerOldElo = winner.elo || 1200;
    let totalEloGained = 0;
    const eloChanges = {};
    const bountyClaims = [];

    // Process each loser
    const processedLosers = losers.map(loserInfo => {
      const loser = players.find(p => p.id === loserInfo.id);
      if (!loser) {
        return {
          id: loserInfo.id,
          name: "Unknown Loser",
          deck: loserInfo.deck,
          oldElo: 1200,
          newElo: 1200,
          eloChange: 0,
          bountyClaimed: 0
        };
      }

      const loserOldElo = loser.elo || 1200;
      
      // Calculate standard ELO change (Winner vs Loser)
      // expected score for winner against loser
      const expectedWinner = 1 / (1 + Math.pow(10, (loserOldElo - winnerOldElo) / 400));
      const stdChange = 32 * (1 - expectedWinner);
      const roundedStdChange = Math.round(stdChange * 10) / 10; // Preserve decimal precision

      // Calculate bounty bonus if loser has active bounty
      let bountyBonus = 0;
      const loserBounty = loser.bounty || 0;
      if (loserBounty > 0) {
        bountyBonus = roundedStdChange * (loserBounty / 100);
        bountyBonus = Math.round(bountyBonus * 10) / 10;
        bountyClaims.push({
          playerId: loser.id,
          playerName: loser.name,
          bountyPercent: loserBounty,
          bonusPoints: bountyBonus
        });
      }

      // Update Loser in database
      const loserEloChange = -roundedStdChange;
      loser.elo = Math.max(100, Math.round((loserOldElo + loserEloChange) * 10) / 10);
      loser.winStreak = 0;
      loser.bounty = 0; // Reset streak and bounty on loss

      eloChanges[loser.id] = loserEloChange;
      totalEloGained += (roundedStdChange + bountyBonus);

      return {
        id: loser.id,
        name: loser.name,
        deck: loserInfo.deck,
        oldElo: loserOldElo,
        newElo: loser.elo,
        eloChange: loserEloChange,
        bountyClaimed: loserBounty
      };
    });

    // Update Winner in database
    winner.elo = Math.round((winnerOldElo + totalEloGained) * 10) / 10;
    const winnerStreak = (winner.winStreak || 0) + 1;
    winner.winStreak = winnerStreak;
    eloChanges[winner.id] = Math.round(totalEloGained * 10) / 10;

    // Calculate Winner's new Bounty
    // Streak 2 yields 5% bounty, incrementing by 5% for each consecutive win up to 25% max (at streak 6+)
    if (winnerStreak >= 2) {
      const bountyValue = Math.min(25, 5 + (winnerStreak - 2) * 5);
      winner.bounty = bountyValue;
    } else {
      winner.bounty = 0;
    }

    this.savePlayers(players);

    // Save Match Record
    const matches = this.getMatches();
    const newMatch = {
      id: 'match_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toISOString(),
      winner: {
        id: winner.id,
        name: winner.name,
        deck: winnerDeck,
        oldElo: winnerOldElo,
        newElo: winner.elo,
        eloChange: Math.round(totalEloGained * 10) / 10,
        streak: winnerStreak,
        newBounty: winner.bounty
      },
      losers: processedLosers,
      bountyClaims,
      clubId: this.getClubName()
    };

    matches.unshift(newMatch); // latest first
    this.saveMatches(matches);

    return newMatch;
  },

  // --- DYNAMIC STATS GENERATORS ---
  getDeckStats() {
    const matches = this.getMatches();
    const deckStats = {};

    matches.forEach(match => {
      // Process winner deck
      const winDeckKey = `${match.winner.name}::${match.winner.deck}`;
      if (!deckStats[winDeckKey]) {
        deckStats[winDeckKey] = {
          playerName: match.winner.name,
          deckName: match.winner.deck,
          wins: 0,
          losses: 0,
          total: 0
        };
      }
      deckStats[winDeckKey].wins++;
      deckStats[winDeckKey].total++;

      // Process losers decks
      match.losers.forEach(loser => {
        const loseDeckKey = `${loser.name}::${loser.deck}`;
        if (!deckStats[loseDeckKey]) {
          deckStats[loseDeckKey] = {
            playerName: loser.name,
            deckName: loser.deck,
            wins: 0,
            losses: 0,
            total: 0
          };
        }
        deckStats[loseDeckKey].losses++;
        deckStats[loseDeckKey].total++;
      });
    });

    // Convert to sorted array
    return Object.values(deckStats)
      .map(d => {
        const winPercentage = d.total > 0 ? (d.wins / d.total) * 100 : 0;
        return {
          ...d,
          winPercentage: Math.round(winPercentage * 10) / 10
        };
      })
      .sort((a, b) => b.winPercentage - a.winPercentage || b.wins - a.wins);
  },

  // --- CLUB SYNC EXPORT STATE (BANNER) ---
  exportClubData() {
    return {
      clubId: this.getClubName().toLowerCase().replace(/[^a-z0-9]/g, '_'),
      clubName: this.getClubName(),
      exportedAt: new Date().toISOString(),
      privacy: this.getPrivacy(),
      settings: this.getSettings(),
      players: this.getPlayers(),
      groups: this.getGroups(),
      history: this.getHistory(),
      matches: this.getMatches()
    };
  }
};

/**
 * Pod Shuffling and Grouping Logic for MTG Pod Randomizer
 * Implements Fisher-Yates shuffle and a multi-criteria integer partition optimizer.
 */

/**
 * Perform a Fisher-Yates shuffle on an array of elements.
 * @param {Array} array - The original array
 * @returns {Array} A new, randomized copy of the array
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Cost function for a single pod size based on the target pod size.
 * Evaluates how "bad" a pod size is. Low is good, high is bad.
 * 
 * @param {number} size - The size of the pod
 * @param {number} target - The target pod size (3, 4, or 5)
 * @returns {number} The penalty score
 */
function getPodSizeCost(size, target) {
  if (size < 2) return 10000; // Invalid pod size

  if (target === 4) {
    switch (size) {
      case 4: return 0;     // Perfect
      case 3: return 1;     // Great
      case 5: return 3;     // Playable but slow
      case 2: return 8;     // Poor (heads-up)
      default: return 100;  // Too large
    }
  } else if (target === 3) {
    switch (size) {
      case 3: return 0;     // Perfect
      case 4: return 2;     // Good
      case 2: return 8;     // Poor
      case 5: return 6;     // Heavy
      default: return 100;
    }
  } else { // target === 5
    switch (size) {
      case 5: return 0;     // Perfect
      case 4: return 2;     // Good
      case 3: return 4;     // Medium
      case 2: return 10;    // Poor
      default: return 100;
    }
  }
}

/**
 * Optimizes the layout of pod sizes for N players given a target size.
 * Uses a backtracking search over integer partitions to find the combination
 * of pod sizes in [2, 3, 4, 5] (or up to 6 if target is 5) that minimizes
 * total cost and balances pod size distribution (minimizing size difference range).
 * 
 * @param {number} N - Total number of active players
 * @param {number} target - Target pod size (3, 4, or 5)
 * @returns {Array<number>} An array of optimized pod sizes summing to N
 */
function getOptimalPodSizes(N, target) {
  if (N <= 0) return [];
  if (N < 2) return [N]; // Impossible to split, return a single pod of size N

  const maxAllowedPodSize = target === 5 ? 6 : 5;
  const minAllowedPodSize = 2;
  
  let bestPartition = null;
  let bestScore = Infinity;

  // Backtracking function to find all partitions that sum to N
  function findPartitions(remaining, currentPartition) {
    if (remaining === 0) {
      // Evaluate the partition
      const score = evaluatePartition(currentPartition, target);
      if (score < bestScore) {
        bestScore = score;
        bestPartition = [...currentPartition];
      }
      return;
    }

    // Force progress by using pod sizes
    const startSize = currentPartition.length > 0 ? currentPartition[currentPartition.length - 1] : minAllowedPodSize;
    
    for (let size = startSize; size <= maxAllowedPodSize; size++) {
      if (remaining - size >= 0) {
        // Skip states that would leave 1 player (unplayable) unless remaining is exactly that size
        if (remaining - size === 1) continue;

        currentPartition.push(size);
        findPartitions(remaining - size, currentPartition);
        currentPartition.pop();
      }
    }
  }

  findPartitions(N, []);

  // If no partition found (e.g. N = 1 or very small/odd constraints), fall back to single pod
  if (!bestPartition) {
    return [N];
  }

  // Sort sizes descending so larger pods are listed first (e.g. [4, 3, 3])
  return bestPartition.sort((a, b) => b - a);
}

/**
 * Scores a candidate partition. Lower scores are better.
 * Balances base pod size penalties with range variance.
 * 
 * @param {Array<number>} partition - Candidate array of pod sizes
 * @param {number} target - Target pod size
 * @returns {number} The evaluated score
 */
function evaluatePartition(partition, target) {
  const baseCost = partition.reduce((sum, size) => sum + getPodSizeCost(size, target), 0);
  
  const maxS = Math.max(...partition);
  const minS = Math.min(...partition);
  const range = maxS - minS;
  
  // Penalize variance inside the session. We want sizes as close as possible
  // E.g., [3, 3, 3] (range 0) is better than [5, 4] (range 1)
  const rangePenalty = range * 0.8;
  
  // Minor penalty for having more pods, to prefer packing if equal cost
  const podCountPenalty = partition.length * 0.05;

  return baseCost + rangePenalty + podCountPenalty;
}

/**
 * Randomly distributes players into balanced pods based on optimized sizes.
 * 
 * @param {Array<Object>} players - List of active player objects
 * @param {number} targetSize - Target pod size (3, 4, or 5)
 * @returns {Array<Array<Object>>} List of pods, each being an array of player objects
 */
function generatePods(players, targetSize) {
  if (!players || players.length === 0) return [];
  
  // 1. Shuffle players completely to ensure absolute fairness
  const shuffledPlayers = shuffleArray(players);
  
  // 2. Compute the optimal pod sizes for this roster count
  const optimalSizes = getOptimalPodSizes(shuffledPlayers.length, targetSize);
  
  // 3. Segment the shuffled list into pods based on the computed sizes
  const pods = [];
  let currentIndex = 0;
  
  optimalSizes.forEach(size => {
    const podPlayers = shuffledPlayers.slice(currentIndex, currentIndex + size);
    pods.push(podPlayers);
    currentIndex += size;
  });
  
  return pods;
}

// --- APPLICATION STATE ---
const State = {
  // Navigation
  activeView: 'pod',       // 'table', 'pod', 'roster'
  
  // Pod organizer (Service 2)
  activePods: [],          // Array of arrays of player objects
  swapCandidate: null,     // { podIndex, playerIndex } when a player is selected to swap
  swapMode: false,         // True when manual seating swap is active
  targetSize: 4,           // Current target size for pods

  // Active Table game (Service 1)
  tableState: {
    playerCount: 4,
    players: [] // Array of { id, name, deck, life, poison, rad, tax, cmdDamage: { [opponentId]: dmg } }
  },
  wakeLock: null,          // Screen wake lock reference

  // Roster ELO Tracker (Service 3)
  activeRosterTab: 'dashboard', // 'dashboard', 'log', 'global'
  selectedManagePlayerId: null // Selected profile ID to manage decks
};

// --- DOM ELEMENTS ---
const DOM = {
  // Global Navigation
  navButtons: document.querySelectorAll('.nav-btn'),
  views: document.querySelectorAll('.app-view'),
  headerPodSizeControl: document.getElementById('header-pod-size-control'),

  // Service 1: The Table
  btnSizeTableList: document.querySelectorAll('.btn-size-table'),
  btnResetTableGame: document.getElementById('btn-reset-table-game'),
  btnLogTableGame: document.getElementById('btn-log-table-game'),
  btnToggleTableSetup: document.getElementById('btn-toggle-table-setup'),
  btnCloseTableSetup: document.getElementById('btn-close-table-setup'),
  tableSetupDrawer: document.getElementById('table-setup-drawer'),
  tableVictoryOverlay: document.getElementById('table-victory-overlay'),
  tablePlayersDropdownsContainer: document.getElementById('table-players-dropdowns-container'),
  tableGridArenaContainer: document.getElementById('table-grid-arena-container'),

  // Service 2: The Pod Settings & Inputs
  size3Btn: document.getElementById('btn-size-3'),
  size4Btn: document.getElementById('btn-size-4'),
  size5Btn: document.getElementById('btn-size-5'),
  singleNameInput: document.getElementById('input-single-name'),
  addSingleBtn: document.getElementById('btn-add-single'),
  bulkNamesInput: document.getElementById('input-bulk-names'),
  importBulkBtn: document.getElementById('btn-import-bulk'),

  // Service 2: The Pod Roster & List
  rosterStats: document.getElementById('roster-stats-display'),
  rosterAllBtn: document.getElementById('btn-roster-all'),
  rosterNoneBtn: document.getElementById('btn-roster-none'),
  rosterClearBtn: document.getElementById('btn-roster-clear'),
  rosterContainer: document.getElementById('roster-list-container'),
  saveGroupTriggerBtn: document.getElementById('btn-trigger-save-group'),
  groupsContainer: document.getElementById('saved-groups-container'),

  // Service 2: The Pod Playground & Randomizer
  activeCountDisplay: document.getElementById('active-players-counter'),
  randomizeBtn: document.getElementById('btn-randomize-pods'),
  saveSessionBtn: document.getElementById('btn-save-session'),
  shuffleOverlay: document.getElementById('shuffle-overlay'),
  podsGridContainer: document.getElementById('pods-grid-container'),
  podsCountIndicator: document.getElementById('pods-count-indicator'),
  btnSwapModeToggle: document.getElementById('btn-swap-mode-toggle'),

  // Service 2: The Pod History
  historyClearTriggerBtn: document.getElementById('btn-trigger-clear-history'),
  historyContainer: document.getElementById('history-logs-container'),

  // Service 3: The Roster Profile Builder
  rosterProfileName: document.getElementById('roster-profile-name'),
  btnAddProfile: document.getElementById('btn-add-profile'),
  profileSelectorDropdown: document.getElementById('profile-selector-dropdown'),
  deckManagementSection: document.getElementById('deck-management-section'),
  profileDecksContainer: document.getElementById('profile-decks-container'),
  inputNewDeckName: document.getElementById('input-new-deck-name'),
  btnAddDeck: document.getElementById('btn-add-deck'),
  profileEmptyState: document.getElementById('profile-empty-state'),
  profileDeckCount: document.getElementById('profile-deck-count'),

  // Service 3: The Roster Club settings
  inputClubName: document.getElementById('input-club-name'),
  btnSaveClubName: document.getElementById('btn-save-club-name'),
  privacyPrivate: document.getElementById('privacy-private'),
  privacyPublic: document.getElementById('privacy-public'),
  btnExportClubJson: document.getElementById('btn-export-club-json'),

  // Service 3: The Roster Navigation & Dashboards
  rosterTabBtns: document.querySelectorAll('.roster-tab-btn'),
  rosterTabContents: document.querySelectorAll('.roster-tab-content'),
  eloLeaderboardBody: document.getElementById('elo-leaderboard-body'),
  decksLeaderboardBody: document.getElementById('decks-leaderboard-body'),
  matchesHistoryContainer: document.getElementById('matches-history-container'),
  btnTriggerClearMatches: document.getElementById('btn-trigger-clear-matches'),

  // Service 3: The Roster Match Logger Form
  matchLoggerForm: document.getElementById('match-logger-form'),
  logWinnerSelect: document.getElementById('log-winner-select'),
  logWinnerDeck: document.getElementById('log-winner-deck'),
  logLoser1Select: document.getElementById('log-loser1-select'),
  logLoser1Deck: document.getElementById('log-loser1-deck'),
  logLoser2Select: document.getElementById('log-loser2-select'),
  logLoser2Deck: document.getElementById('log-loser2-deck'),
  logLoser3Select: document.getElementById('log-loser3-select'),
  logLoser3Deck: document.getElementById('log-loser3-deck'),

  // Native Dialogs
  clearHistoryDialog: document.getElementById('clear-history-dialog'),
  btnCancelClearHistory: document.getElementById('btn-cancel-clear-history'),
  btnConfirmClearHistory: document.getElementById('btn-confirm-clear-history'),

  clearPlayersDialog: document.getElementById('clear-players-dialog'),
  btnCancelClearPlayers: document.getElementById('btn-cancel-clear-players'),
  btnConfirmClearPlayers: document.getElementById('btn-confirm-clear-players'),

  clearMatchesDialog: document.getElementById('clear-matches-dialog'),
  btnCancelClearMatches: document.getElementById('btn-cancel-clear-matches'),
  btnConfirmClearMatches: document.getElementById('btn-confirm-clear-matches'),

  saveGroupDialog: document.getElementById('save-group-dialog'),
  inputGroupName: document.getElementById('input-group-name'),
  btnCancelSaveGroup: document.getElementById('btn-cancel-save-group'),
  btnConfirmSaveGroup: document.getElementById('btn-confirm-save-group')
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize settings from local storage
  const settings = StorageManager.getSettings();
  updateTargetSize(settings.targetSize);
  
  // Load club settings in Roster view
  DOM.inputClubName.value = StorageManager.getClubName();
  const privacy = StorageManager.getPrivacy();
  if (privacy === 'public') DOM.privacyPublic.checked = true;
  else DOM.privacyPrivate.checked = true;

  // 2. Initial renders for views
  renderRoster();       // Pod Active Roster pool
  renderGroups();       // Pod Saved groups
  renderHistory();      // Pod sessions history logs
  
  renderRosterProfiles();   // Service 3 player selector and profile panels
  renderEloLeaderboard();   // Service 3 dashboard rankings
  renderDecksLeaderboard(); // Service 3 dashboard deck statistics
  renderRecentMatches();    // Service 3 dashboard matches log history
  
  // Set up Service 1: The Table selectors
  initializeTablePlayers();

  // 3. Register Event Listeners
  setupGlobalNavigation();
  setupTableEvents();
  setupPodEvents();
  setupRosterEvents();

  // 4. Register service worker for PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('PWA Service Worker registered!', reg.scope))
        .catch(err => console.error('Service Worker registration failed:', err));
    });
  }

  // Wake lock visibility listener to re-request if tab minimized then restored
  document.addEventListener('visibilitychange', handleVisibilityChange);
});

// --- GLOBAL NAVIGATION CONTROLLER ---
function setupGlobalNavigation() {
  DOM.navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.dataset.view;
      switchView(targetView);
    });
  });
}

function switchView(viewName) {
  State.activeView = viewName;
  
  // Update nav buttons active states
  DOM.navButtons.forEach(btn => {
    if (btn.dataset.view === viewName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Display correct view container, hide others
  DOM.views.forEach(view => {
    if (view.id === `view-${viewName}`) {
      view.style.display = viewName === 'table' ? 'block' : 'grid';
      view.classList.add('active');
    } else {
      view.style.display = 'none';
      view.classList.remove('active');
    }
  });

  // Show target pod size control only on Pod tab
  if (viewName === 'pod') {
    DOM.headerPodSizeControl.style.display = 'flex';
  } else {
    DOM.headerPodSizeControl.style.display = 'none';
  }

  // Manage Wake Lock based on Table activity
  if (viewName === 'table') {
    requestWakeLock();
  } else {
    releaseWakeLock();
  }
}

// --- WAKE LOCK API CONTROLLERS ---
async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    if (State.wakeLock === null) {
      State.wakeLock = await navigator.wakeLock.request('screen');
      console.log('Screen Wake Lock acquired - Phone will not sleep.');
    }
  } catch (err) {
    console.warn('Failed to acquire screen wake lock:', err.message);
  }
}

function releaseWakeLock() {
  if (State.wakeLock !== null) {
    State.wakeLock.release()
      .then(() => {
        State.wakeLock = null;
        console.log('Screen Wake Lock released.');
      });
  }
}

function handleVisibilityChange() {
  if (State.wakeLock !== null && document.visibilityState === 'visible') {
    requestWakeLock();
  }
}

// ==========================================================================
// SERVICE 1: THE TABLE (LIFE COUNTER CONTROLLER)
// ==========================================================================

function initializeTablePlayers() {
  const seats = State.tableState.playerCount;
  DOM.tablePlayersDropdownsContainer.innerHTML = '';
  
  // Query all profiles
  const profiles = StorageManager.getPlayers();
  
  // Re-build seats
  State.tableState.players = [];
  for (let i = 0; i < seats; i++) {
    const defaultName = `Planeswalker ${i + 1}`;
    
    State.tableState.players.push({
      seatIndex: i,
      id: `guest_${i}`,
      name: defaultName,
      deck: "Default Deck",
      life: 40,
      poison: 0,
      rad: 0,
      tax: 0,
      cmdDamage: {} // opponentId: damage
    });

    const dropDiv = document.createElement('div');
    dropDiv.className = 'form-field';
    dropDiv.innerHTML = `
      <label class="input-label">Seat ${i + 1}</label>
      <select class="textbox table-player-select" data-seat="${i}">
        <option value="guest">-- Guest (${defaultName}) --</option>
        ${profiles.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
      </select>
      <select class="textbox table-deck-select mt-1" data-seat="${i}" style="display:none; margin-top:0.4rem;">
        <option value="default">Default Deck</option>
      </select>
    `;

    DOM.tablePlayersDropdownsContainer.appendChild(dropDiv);
  }

  // Setup Seat Change Listeners
  const selects = DOM.tablePlayersDropdownsContainer.querySelectorAll('.table-player-select');
  selects.forEach(sel => {
    sel.addEventListener('change', (e) => {
      const seat = parseInt(e.target.dataset.seat, 10);
      const val = e.target.value;
      handleSeatPlayerChange(seat, val);
    });
  });

  // Collapse setup bar drawer on layout changes for clean look
  DOM.tableSetupDrawer.style.display = 'none';

  renderTableArena();
}

function handleSeatPlayerChange(seatIndex, playerId) {
  const players = StorageManager.getPlayers();
  const seatSelects = DOM.tablePlayersDropdownsContainer.querySelectorAll(`.table-deck-select[data-seat="${seatIndex}"]`);
  const deckSelect = seatSelects[0];
  
  const playerState = State.tableState.players[seatIndex];

  if (playerId === 'guest') {
    playerState.id = `guest_${seatIndex}`;
    playerState.name = `Planeswalker ${seatIndex + 1}`;
    playerState.deck = "Default Deck";
    if (deckSelect) deckSelect.style.display = 'none';
  } else {
    const profile = players.find(p => p.id === playerId);
    if (profile) {
      playerState.id = profile.id;
      playerState.name = profile.name;
      
      if (deckSelect) {
        deckSelect.style.display = 'block';
        deckSelect.innerHTML = `<option value="default">Default Deck</option>`;
        if (profile.decks && profile.decks.length > 0) {
          profile.decks.forEach(d => {
            deckSelect.innerHTML += `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`;
          });
          playerState.deck = profile.decks[0];
        } else {
          playerState.deck = "Default Deck";
        }

        // Listener for deck selector
        deckSelect.onchange = (ev) => {
          playerState.deck = ev.target.value === 'default' ? 'Default Deck' : ev.target.value;
          renderTableArena();
        };
      }
    }
  }

  renderTableArena();
}

function setupTableEvents() {
  // Collapsible Top Settings Drawer toggles
  DOM.btnToggleTableSetup.addEventListener('click', () => {
    const isHidden = DOM.tableSetupDrawer.style.display === 'none';
    DOM.tableSetupDrawer.style.display = isHidden ? 'block' : 'none';
  });

  DOM.btnCloseTableSetup.addEventListener('click', () => {
    DOM.tableSetupDrawer.style.display = 'none';
  });

  // Seat size selectors (2 to 5 players)
  DOM.btnSizeTableList.forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.btnSizeTableList.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      State.tableState.playerCount = parseInt(btn.dataset.count, 10);
      initializeTablePlayers();
    });
  });

  // Reset table game
  DOM.btnResetTableGame.addEventListener('click', () => {
    State.tableState.players.forEach(p => {
      p.life = 40;
      p.poison = 0;
      p.rad = 0;
      p.tax = 0;
      p.cmdDamage = {};
    });
    // Dismiss victory overlay if active
    DOM.tableVictoryOverlay.style.display = 'none';
    renderTableArena();
  });

  // Log table result shortcut
  DOM.btnLogTableGame.addEventListener('click', () => {
    const activeTablePlayers = State.tableState.players.map(p => ({
      id: p.id,
      name: p.name,
      deck: p.deck
    }));

    const hasGuests = activeTablePlayers.some(p => p.id.startsWith('guest_'));
    if (hasGuests) {
      alert("Cannot log match history with Guest players. Please create and select full Planeswalker profiles in the Roster tab first!");
      return;
    }

    switchView('roster');
    switchRosterTab('log');

    const selects = [
      DOM.logWinnerSelect,
      DOM.logLoser1Select,
      DOM.logLoser2Select,
      DOM.logLoser3Select
    ];

    selects.forEach((sel, selIndex) => {
      if (selIndex < activeTablePlayers.length) {
        sel.value = activeTablePlayers[selIndex].id;
        const event = new Event('change');
        sel.dispatchEvent(event);
        
        const deckSelectId = sel.id === 'log-winner-select' ? 'log-winner-deck' : `log-${sel.id.split('-')[1]}-deck`;
        const deckSel = document.getElementById(deckSelectId);
        if (deckSel) {
          deckSel.value = activeTablePlayers[selIndex].deck;
        }
      }
    });

    console.log("Pre-filled active game into Roster Match Logger!");
  });
}

function renderTableArena() {
  DOM.tableGridArenaContainer.innerHTML = '';
  DOM.tableGridArenaContainer.className = `table-grid-arena grid-${State.tableState.playerCount}`;

  const seatThemes = ['w-theme', 'u-theme', 'b-theme', 'r-theme', 'g-theme'];

  State.tableState.players.forEach((player, index) => {
    const card = document.createElement('article');
    const theme = seatThemes[index % seatThemes.length];
    card.className = `player-table-card ${theme}`;
    card.dataset.seat = index;

    // Check for lethal Commander damage (any opponent hits >= 21)
    let isLethal = false;
    Object.values(player.cmdDamage).forEach(dmgVal => {
      if (dmgVal >= 21) isLethal = true;
    });
    if (isLethal) {
      card.classList.add('lethal-commander');
    }

    // Dynamic Active Counter pill badges in lower-left
    let activeCountersHtml = '';
    if (player.poison > 0) {
      activeCountersHtml += `<span class="counter-badge poison"><i class="fa-solid fa-biohazard"></i> ${player.poison}</span>`;
    }
    if (player.rad > 0) {
      activeCountersHtml += `<span class="counter-badge rad"><i class="fa-solid fa-radiation"></i> ${player.rad}</span>`;
    }
    if (player.tax > 0) {
      activeCountersHtml += `<span class="counter-badge tax"><i class="fa-solid fa-gavel"></i> ${player.tax}</span>`;
    }
    
    let totalCmdDmg = 0;
    Object.values(player.cmdDamage).forEach(dmg => { totalCmdDmg += dmg; });
    if (totalCmdDmg > 0) {
      activeCountersHtml += `<span class="counter-badge cmd"><i class="fa-solid fa-shield-halved"></i> ${totalCmdDmg}</span>`;
    }

    // Prepare Commander Damage content for the sliders drawer
    let cmdDmgHtml = '';
    State.tableState.players.forEach((opp, oppIndex) => {
      if (oppIndex !== index) {
        const oppId = opp.id;
        const curDmg = player.cmdDamage[oppId] || 0;
        const lethalClass = curDmg >= 21 ? 'streak-indicator' : '';
        cmdDmgHtml += `
          <div class="cmd-dmg-item-row">
            <span class="cmd-dmg-player-name"><i class="fa-solid fa-swords"></i> Damage from ${escapeHtml(opp.name)}:</span>
            <div class="drawer-counter-row">
              <button type="button" class="btn-drawer-counter" data-action="cmd-dmg-dec" data-opp="${oppId}">-</button>
              <span class="drawer-counter-val ${lethalClass}">${curDmg}</span>
              <button type="button" class="btn-drawer-counter" data-action="cmd-dmg-inc" data-opp="${oppId}">+</button>
            </div>
          </div>
        `;
      }
    });

    card.innerHTML = `
      <div class="player-card-header">
        <div class="player-card-title">
          <span class="player-card-name">${escapeHtml(player.name)}</span>
          <span class="player-card-deck">${escapeHtml(player.deck)}</span>
        </div>
        <span class="tax-val" style="font-size: 0.7rem; text-transform:uppercase; color:var(--text-muted);">Seat ${index + 1}</span>
      </div>

      <div class="life-counter-section">
        <button type="button" class="btn-life btn-life-minus" data-action="life-dec">-</button>
        <span class="life-val-display">${player.life}</span>
        <button type="button" class="btn-life btn-life-plus" data-action="life-inc">+</button>
        
        <!-- Premium floating counter elements inside card face -->
        <div class="active-counters-indicator">
          ${activeCountersHtml || '<span style="font-size:0.65rem; color:var(--text-muted); opacity:0.5; font-weight:600;"><i class="fa-solid fa-chart-bar"></i> No active counters</span>'}
        </div>
        <button type="button" class="drawer-toggle-trigger" data-action="drawer-open" title="Open sliders drawer">
          <i class="fa-solid fa-sliders"></i>
        </button>
      </div>

      <!-- Hidden Drawers Overlay (Rendered fixed relative to viewport) -->
      <div class="drawer-panel" data-seat="${index}">
        <div class="drawer-handle" data-action="drawer-close"></div>
        <div class="drawer-header" style="text-align: center; margin-bottom: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.75rem;">
          <h3 style="font-family: var(--font-display); color: var(--color-brand); font-size: 1.35rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; text-shadow: 0 0 10px var(--glow-brand); margin-bottom: 0.2rem;">
            <i class="fa-solid fa-user-gear"></i> ${escapeHtml(player.name)}'s Trackers
          </h3>
          <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">Deck: ${escapeHtml(player.deck)} • Seat ${index + 1}</span>
        </div>
        
        <div class="drawer-body-grid">
          
          <div class="drawer-counter-card">
            <span class="drawer-card-label"><i class="fa-solid fa-biohazard" style="color:var(--color-green);"></i> Poison</span>
            <div class="drawer-counter-row">
              <button type="button" class="btn-drawer-counter" data-action="poison-dec">-</button>
              <span class="drawer-counter-val" style="color:var(--color-green);">${player.poison}</span>
               <button type="button" class="btn-drawer-counter" data-action="poison-inc">+</button>
            </div>
          </div>

          <div class="drawer-counter-card">
            <span class="drawer-card-label"><i class="fa-solid fa-radiation" style="color:var(--color-brand);"></i> Rads</span>
            <div class="drawer-counter-row">
              <button type="button" class="btn-drawer-counter" data-action="rad-dec">-</button>
              <span class="drawer-counter-val" style="color:var(--color-brand);">${player.rad}</span>
              <button type="button" class="btn-drawer-counter" data-action="rad-inc">+</button>
            </div>
          </div>

          <!-- Commander Tax shifted to drawer for clean Lotus-like card aesthetics -->
          <div class="drawer-counter-card" style="grid-column: span 2;">
            <span class="drawer-card-label"><i class="fa-solid fa-gavel"></i> Commander Tax</span>
            <div class="drawer-counter-row">
              <button type="button" class="btn-drawer-counter" data-action="tax-dec">-</button>
              <span class="drawer-counter-val" style="color:var(--color-brand);">${player.tax}</span>
              <button type="button" class="btn-drawer-counter" data-action="tax-inc">+</button>
            </div>
          </div>

          <div class="drawer-commander-dmg-block">
            <span class="drawer-card-label" style="justify-content:flex-start; margin-bottom:0.25rem;"><i class="fa-solid fa-crown" style="color:var(--color-brand);"></i> Commander Damage Received (Max 21)</span>
            ${cmdDmgHtml}
          </div>

        </div>
      </div>
    `;

    bindTableCardEvents(card, index);

    DOM.tableGridArenaContainer.appendChild(card);
  });
}

function bindTableCardEvents(card, seatIndex) {
  const p = State.tableState.players[seatIndex];

  // Life buttons
  card.querySelector('[data-action="life-dec"]').onclick = () => { p.life--; renderTableArena(); checkTableGameEnd(); };
  card.querySelector('[data-action="life-inc"]').onclick = () => { p.life++; renderTableArena(); checkTableGameEnd(); };

  // Tax buttons inside drawer
  card.querySelector('[data-action="tax-dec"]').onclick = () => { p.tax = Math.max(0, p.tax - 2); renderTableArena(); };
  card.querySelector('[data-action="tax-inc"]').onclick = () => { p.tax += 2; renderTableArena(); };

  // Drawer slider triggers
  const drawer = card.querySelector('.drawer-panel');
  card.querySelector('[data-action="drawer-open"]').onclick = () => { drawer.classList.add('open'); };
  card.querySelector('[data-action="drawer-close"]').onclick = () => { drawer.classList.remove('open'); };

  // Tapping the active indicators area also opens trackers drawer (very friendly mobile gesture!)
  card.querySelector('.active-counters-indicator').onclick = () => { drawer.classList.add('open'); };

  // Poison buttons
  card.querySelector('[data-action="poison-dec"]').onclick = () => { p.poison = Math.max(0, p.poison - 1); renderTableArena(); checkTableGameEnd(); };
  card.querySelector('[data-action="poison-inc"]').onclick = () => { p.poison++; renderTableArena(); checkTableGameEnd(); };

  // Rads buttons
  card.querySelector('[data-action="rad-dec"]').onclick = () => { p.rad = Math.max(0, p.rad - 1); renderTableArena(); checkTableGameEnd(); };
  card.querySelector('[data-action="rad-inc"]').onclick = () => { p.rad++; renderTableArena(); checkTableGameEnd(); };

  // Commander Damage counters
  card.querySelectorAll('[data-action^="cmd-dmg-"]').forEach(btn => {
    btn.onclick = () => {
      const oppId = btn.dataset.opp;
      const isInc = btn.dataset.action === 'cmd-dmg-inc';
      const curDmg = p.cmdDamage[oppId] || 0;
      
      if (isInc) {
        p.cmdDamage[oppId] = Math.min(21, curDmg + 1);
      } else {
        p.cmdDamage[oppId] = Math.max(0, curDmg - 1);
      }
      renderTableArena();
      checkTableGameEnd();
    };
  });

  // SWIPE DRAG GESTURES FOR DRAWER CLOSING (SWIPE DOWN TO DISMISS)
  let startY = 0;
  drawer.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
  }, { passive: true });

  drawer.addEventListener('touchend', (e) => {
    const endY = e.changedTouches[0].clientY;
    const diffY = endY - startY;
    if (diffY > 80) { // Dragged down more than 80px
      drawer.classList.remove('open');
    }
  }, { passive: true });
}

// --- DYNAMIC GAME END & VICTORY OVERLAY CONTROLLERS ---
function checkTableGameEnd() {
  // If victory overlay is already visible, bypass to prevent double logging
  if (DOM.tableVictoryOverlay.style.display === 'flex') return;

  const seats = State.tableState.players;
  // Auto detect only for standard playgroups of 2-5 players
  if (seats.length < 2) return;

  const activePlayers = seats.map(p => {
    // Find maximum commander damage received from any opponent
    let maxCmdDmg = 0;
    Object.values(p.cmdDamage).forEach(dmg => {
      if (dmg > maxCmdDmg) maxCmdDmg = dmg;
    });

    // Lose criteria: life total <= 0, poison counters >= 10, or commander damage from single opponent >= 21
    const isDefeated = p.life <= 0 || p.poison >= 10 || maxCmdDmg >= 21;
    return {
      ...p,
      isDefeated
    };
  });

  const defeatedCount = activePlayers.filter(p => p.isDefeated).length;
  const alivePlayers = activePlayers.filter(p => !p.isDefeated);

  // Victory condition: Exactly one player remains undefeated
  if (defeatedCount === seats.length - 1 && alivePlayers.length === 1) {
    const winner = alivePlayers[0];
    const losers = activePlayers.filter(p => p.isDefeated);
    
    showVictoryOverlay(winner, losers);
  }
}

function showVictoryOverlay(winner, losers) {
  const overlay = DOM.tableVictoryOverlay;
  const announcement = document.getElementById('victory-announcement');
  const detailsBox = document.getElementById('victory-details-box');

  announcement.textContent = `${winner.name} has defeated all rivals!`;

  // Pre-calculate ELO rating updates for display preview
  const winnerId = winner.id;
  const players = StorageManager.getPlayers();
  const winnerProfile = players.find(p => p.id === winnerId);
  const winnerOldElo = winnerProfile ? winnerProfile.elo : 1200;
  let totalEloGained = 0;
  const detailsHtml = [];

  const isGuest = winnerId.startsWith('guest_') || losers.some(l => l.id.startsWith('guest_'));

  losers.forEach(loser => {
    const loserProfile = players.find(p => p.id === loser.id);
    const loserOldElo = loserProfile ? loserProfile.elo : 1200;
    
    const expectedWinner = 1 / (1 + Math.pow(10, (loserOldElo - winnerOldElo) / 400));
    const stdChange = 32 * (1 - expectedWinner);
    const roundedStdChange = Math.round(stdChange * 10) / 10;
    
    let bountyBonus = 0;
    const loserBounty = loserProfile ? (loserProfile.bounty || 0) : 0;
    if (loserBounty > 0) {
      bountyBonus = roundedStdChange * (loserBounty / 100);
      bountyBonus = Math.round(bountyBonus * 10) / 10;
    }

    totalEloGained += (roundedStdChange + bountyBonus);
    
    detailsHtml.push(`
      <div class="victory-row loser">
        <span>${escapeHtml(loser.name)} (${escapeHtml(loser.deck)})</span>
        <span style="color:var(--color-red); font-weight:bold;">-${roundedStdChange} ELO ${loserBounty > 0 ? `(Bounty ${loserBounty}% Claimed)` : ''}</span>
      </div>
    `);
  });

  const finalEloGained = Math.round(totalEloGained * 10) / 10;
  detailsHtml.unshift(`
    <div class="victory-row winner">
      <span>${escapeHtml(winner.name)} (${escapeHtml(winner.deck)})</span>
      <span style="color:var(--color-green); font-weight:bold;">+${finalEloGained} ELO</span>
    </div>
  `);

  // Automatic Match Logging!
  let autoLogBannerHtml = '';
  if (!isGuest) {
    const loserParams = losers.map(l => ({ id: l.id, deck: l.deck }));
    const newMatch = StorageManager.logMatch(winner.id, winner.deck, loserParams);
    if (newMatch) {
      console.log("Match automatically logged! Winner ELO:", newMatch.winner.newElo);
      autoLogBannerHtml = `
        <div style="background: rgba(0, 255, 102, 0.08); border: 1px solid rgba(0, 255, 102, 0.2); border-radius: 6px; padding: 0.5rem; text-align: center; color: var(--color-green); font-size: 0.85rem; font-weight: bold; margin-bottom: 0.75rem; text-shadow: 0 0 5px var(--glow-green);">
          <i class="fa-solid fa-circle-check"></i> Match Automatically Logged!
        </div>
      `;
      // Instantly refresh views in memory
      renderRoster();
      renderEloLeaderboard();
      renderDecksLeaderboard();
      renderRecentMatches();
    }
  } else {
    autoLogBannerHtml = `
      <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border-glass); border-radius: 6px; padding: 0.5rem; text-align: center; color: var(--text-muted); font-size: 0.8rem; font-weight: 500; margin-bottom: 0.75rem;">
        <i class="fa-solid fa-triangle-exclamation"></i> Guests Present: ELO Standings Not Logged
      </div>
    `;
  }

  detailsBox.innerHTML = autoLogBannerHtml + detailsHtml.join('');
  overlay.style.display = 'flex';

  // "Start New Game" - Resets counter and dismisses overlay
  const dismissBtn = document.getElementById('btn-victory-dismiss');
  dismissBtn.textContent = "Start New Game";
  dismissBtn.onclick = () => {
    overlay.style.display = 'none';
    resetTableCounters();
  };

  // "View Standings" / "Log Blocked"
  const logBtn = document.getElementById('btn-victory-log-roster');
  if (isGuest) {
    logBtn.disabled = true;
    logBtn.textContent = "Log Unavailable";
    logBtn.style.opacity = '0.5';
    logBtn.onclick = null;
  } else {
    logBtn.disabled = false;
    logBtn.textContent = "View Standings";
    logBtn.style.opacity = '1';
    logBtn.onclick = () => {
      overlay.style.display = 'none';
      resetTableCounters();
      switchView('roster');
      switchRosterTab('dashboard');
    };
  }
}

function resetTableCounters() {
  State.tableState.players.forEach(p => {
    p.life = 40;
    p.poison = 0;
    p.rad = 0;
    p.tax = 0;
    p.cmdDamage = {};
  });
  renderTableArena();
}

// ==========================================================================
// SERVICE 2: THE POD (LARGE GROUP ORGANIZER CONTROLLERS)
// ==========================================================================

function setupPodEvents() {
  // Pod size organizers
  [DOM.size3Btn, DOM.size4Btn, DOM.size5Btn].forEach(btn => {
    btn.addEventListener('click', () => {
      updateTargetSize(parseInt(btn.dataset.size, 10));
    });
  });

  // Single player add
  DOM.addSingleBtn.addEventListener('click', handleAddSinglePlayer);
  DOM.singleNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAddSinglePlayer();
  });

  // Bulk import
  DOM.importBulkBtn.addEventListener('click', handleBulkImport);

  // Roster batch clicks
  DOM.rosterAllBtn.addEventListener('click', () => {
    StorageManager.setAllPlayersActive(true);
    renderRoster();
  });
  DOM.rosterNoneBtn.addEventListener('click', () => {
    StorageManager.setAllPlayersActive(false);
    renderRoster();
  });
  DOM.rosterClearBtn.addEventListener('click', () => {
    DOM.clearPlayersDialog.showModal();
  });

  // Saved group trigger
  DOM.saveGroupTriggerBtn.addEventListener('click', () => {
    const active = StorageManager.getPlayers().filter(p => p.active);
    if (!active.length) {
      alert('You must have at least 1 active player selected to save a group!');
      return;
    }
    DOM.inputGroupName.value = '';
    DOM.saveGroupDialog.showModal();
  });

  // Manual Swap Mode Toggle
  DOM.btnSwapModeToggle.addEventListener('click', () => {
    State.swapMode = !State.swapMode;
    State.swapCandidate = null; // Clear states
    
    if (State.swapMode) {
      DOM.btnSwapModeToggle.innerHTML = '<i class="fa-solid fa-circle-check" style="color:var(--color-green);"></i> Swap Mode: ON';
      DOM.btnSwapModeToggle.style.borderColor = 'var(--color-green)';
      DOM.btnSwapModeToggle.style.color = 'var(--color-green)';
    } else {
      DOM.btnSwapModeToggle.innerHTML = '<i class="fa-solid fa-right-left"></i> Swap Mode: OFF';
      DOM.btnSwapModeToggle.style.borderColor = 'var(--border-glass)';
      DOM.btnSwapModeToggle.style.color = 'var(--text-muted)';
    }
    renderActivePods();
  });

  // Randomizer shuffler triggers
  DOM.randomizeBtn.addEventListener('click', triggerRandomizer);
  DOM.saveSessionBtn.addEventListener('click', handleSaveSession);

  // History erasure
  DOM.historyClearTriggerBtn.addEventListener('click', () => {
    DOM.clearHistoryDialog.showModal();
  });

  // Dialog confirmations
  DOM.btnCancelClearHistory.addEventListener('click', () => DOM.clearHistoryDialog.close());
  DOM.btnConfirmClearHistory.addEventListener('click', () => {
    StorageManager.clearHistory();
    renderHistory();
    DOM.clearHistoryDialog.close();
  });

  DOM.btnCancelClearPlayers.addEventListener('click', () => DOM.clearPlayersDialog.close());
  DOM.btnConfirmClearPlayers.addEventListener('click', () => {
    StorageManager.clearAllPlayers();
    renderRoster();
    renderRosterProfiles();
    DOM.clearPlayersDialog.close();
  });

  DOM.btnCancelSaveGroup.addEventListener('click', () => DOM.saveGroupDialog.close());
  DOM.btnConfirmSaveGroup.addEventListener('click', () => {
    const name = DOM.inputGroupName.value.trim();
    if (!name) {
      alert('Please enter a valid group name!');
      return;
    }
    const names = StorageManager.getPlayers().filter(p => p.active).map(p => p.name);
    StorageManager.saveGroup(name, names);
    renderGroups();
    DOM.saveGroupDialog.close();
  });
}

function handleAddSinglePlayer() {
  const name = DOM.singleNameInput.value.trim();
  if (!name) return;

  const added = StorageManager.addPlayer(name);
  if (!added) {
    alert('This player is already in your master pool!');
    return;
  }
  DOM.singleNameInput.value = '';
  DOM.singleNameInput.focus();
  renderRoster();
  renderRosterProfiles(); // Update Roster dropdowns
}

function handleBulkImport() {
  const text = DOM.bulkNamesInput.value.trim();
  if (!text) return;

  const names = text.split(/[\n,;]+/).map(n => n.trim()).filter(Boolean);
  if (!names.length) return;

  StorageManager.addBulkPlayers(names);
  DOM.bulkNamesInput.value = '';
  renderRoster();
  renderRosterProfiles(); // Update Roster dropdowns
}

function updateActiveCount() {
  const players = StorageManager.getPlayers();
  const active = players.filter(p => p.active).length;
  DOM.rosterStats.textContent = `${active} / ${players.length} Selected`;
  DOM.activeCountDisplay.textContent = active;

  DOM.randomizeBtn.disabled = active < 2;
  DOM.saveGroupTriggerBtn.disabled = active === 0;
}

function renderRoster() {
  const players = StorageManager.getPlayers();
  DOM.rosterContainer.innerHTML = '';

  if (!players.length) {
    DOM.rosterContainer.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-users-slash"></i>
        <p>No players added to the pool yet.</p>
      </div>
    `;
    updateActiveCount();
    return;
  }

  players.forEach(p => {
    const item = document.createElement('div');
    item.className = `roster-item ${p.active ? 'active' : ''}`;
    item.dataset.id = p.id;

    item.innerHTML = `
      <div class="roster-item-left">
        <div class="checkbox-custom"></div>
        <span class="player-name">${escapeHtml(p.name)}</span>
        <span class="player-card-deck" style="margin-left:0.25rem;">(ELO: ${Math.round(p.elo)})</span>
      </div>
      <button type="button" class="btn-delete-player" title="Delete profile"><i class="fa-solid fa-trash-can"></i></button>
    `;

    item.querySelector('.roster-item-left').onclick = () => {
      StorageManager.togglePlayerActive(p.id);
      renderRoster();
    };

    item.querySelector('.btn-delete-player').onclick = (e) => {
      e.stopPropagation();
      StorageManager.deletePlayer(p.id);
      renderRoster();
      renderRosterProfiles();
    };

    DOM.rosterContainer.appendChild(item);
  });

  updateActiveCount();
}

function renderGroups() {
  const groups = StorageManager.getGroups();
  DOM.groupsContainer.innerHTML = '';

  if (!groups.length) {
    DOM.groupsContainer.innerHTML = `
      <span style="font-size: 0.85rem; color: var(--text-muted);">No saved groups yet.</span>
    `;
    return;
  }

  groups.forEach(g => {
    const tag = document.createElement('span');
    tag.className = 'group-tag';
    tag.innerHTML = `
      <i class="fa-solid fa-bookmark"></i>
      <span>${escapeHtml(g.name)} (${g.players.length})</span>
      <button type="button" class="btn-delete-group" title="Delete group"><i class="fa-solid fa-xmark"></i></button>
    `;

    tag.onclick = () => {
      const pool = StorageManager.getPlayers();
      const missing = g.players.filter(name => !pool.some(p => p.name.toLowerCase() === name.toLowerCase()));
      if (missing.length > 0) {
        StorageManager.addBulkPlayers(missing);
      }

      const updated = StorageManager.getPlayers();
      updated.forEach(p => {
        p.active = g.players.some(n => n.toLowerCase() === p.name.toLowerCase());
      });
      StorageManager.savePlayers(updated);
      renderRoster();
    };

    tag.querySelector('.btn-delete-group').onclick = (e) => {
      e.stopPropagation();
      StorageManager.deleteGroup(g.id);
      renderGroups();
    };

    DOM.groupsContainer.appendChild(tag);
  });
}

function renderHistory() {
  const history = StorageManager.getHistory();
  DOM.historyContainer.innerHTML = '';

  if (!history.length) {
    DOM.historyContainer.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-database"></i>
        <p>No logged sessions in this browser yet.</p>
      </div>
    `;
    return;
  }

  history.forEach(session => {
    const card = document.createElement('article');
    card.className = 'history-card';
    card.dataset.id = session.id;

    const date = new Date(session.timestamp);
    const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    let podsHtml = '';
    session.pods.forEach((pod, index) => {
      const names = pod.map(p => escapeHtml(p.name)).join(', ');
      podsHtml += `
        <div class="history-pod-row">
          <span class="history-pod-num">Pod ${index + 1} (${pod.length}):</span>
          <span class="history-pod-names">${names}</span>
        </div>
      `;
    });

    card.innerHTML = `
      <div class="history-header">
        <div class="history-meta">
          <span class="history-date">${dateStr} - ${timeStr}</span>
          <span class="history-details">${session.totalPlayers} Players • Target Pod Size: ${session.targetSize}</span>
        </div>
        <button type="button" class="btn-delete-player btn-pod-action" style="opacity:1;" title="Delete log" data-action="delete-log">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
      <div class="history-pods-preview">
        ${podsHtml}
      </div>
      <div class="history-actions">
        <button type="button" class="btn btn-secondary btn-sm" style="padding: 0.4rem 0.75rem; font-size: 0.8rem;" data-action="reload-roster">
          <i class="fa-solid fa-rotate"></i> Reload Roster
        </button>
        <button type="button" class="btn btn-primary btn-sm" style="padding: 0.4rem 0.75rem; font-size: 0.8rem;" data-action="load-to-table" title="Send Pod 1 to active Table for play">
          <i class="fa-solid fa-gamepad"></i> Send Pod 1 to Table
        </button>
      </div>
    `;

    // Load to active life table counter shortcut
    card.querySelector('[data-action="load-to-table"]').addEventListener('click', () => {
      if (!session.pods || !session.pods.length) return;
      const firstPod = session.pods[0]; // Take first pod
      
      State.tableState.playerCount = Math.min(5, Math.max(2, firstPod.length));
      
      // Select count in Table Setup
      DOM.btnSizeTableList.forEach(b => {
        if (parseInt(b.dataset.count, 10) === State.tableState.playerCount) b.classList.add('active');
        else b.classList.remove('active');
      });

      // Prepare seats in Table State
      initializeTablePlayers();

      // For each seat, pre-fill from this pod player
      firstPod.forEach((p, seatIdx) => {
        if (seatIdx < State.tableState.playerCount) {
          const seatSelect = DOM.tablePlayersDropdownsContainer.querySelectorAll(`.table-player-select[data-seat="${seatIdx}"]`)[0];
          if (seatSelect) {
            seatSelect.value = p.id;
            handleSeatPlayerChange(seatIdx, p.id);
          }
        }
      });

      switchView('table');
      console.log(`Loaded Pod 1 into Service 1 Active Table!`);
    });

    card.querySelector('[data-action="reload-roster"]').addEventListener('click', () => {
      const names = [];
      session.pods.forEach(pod => pod.forEach(p => names.push(p.name)));

      const pool = StorageManager.getPlayers();
      const missing = names.filter(name => !pool.some(p => p.name.toLowerCase() === name.toLowerCase()));
      if (missing.length > 0) {
        StorageManager.addBulkPlayers(missing);
      }

      const updated = StorageManager.getPlayers();
      updated.forEach(p => {
        p.active = names.some(n => n.toLowerCase() === p.name.toLowerCase());
      });
      StorageManager.savePlayers(updated);
      updateTargetSize(session.targetSize);
      renderRoster();
      
      document.getElementById('randomizer-controls').scrollIntoView({ behavior: 'smooth' });
    });

    card.querySelector('[data-action="delete-log"]').addEventListener('click', () => {
      StorageManager.deleteHistorySession(session.id);
      renderHistory();
    });

    DOM.historyContainer.appendChild(card);
  });
}

function triggerRandomizer() {
  const active = StorageManager.getPlayers().filter(p => p.active);
  if (active.length < 2) return;

  State.swapCandidate = null;
  DOM.shuffleOverlay.style.display = 'flex';

  setTimeout(() => {
    State.activePods = generatePods(active, State.targetSize);
    DOM.shuffleOverlay.style.display = 'none';
    renderActivePods();
    DOM.saveSessionBtn.disabled = false;
    DOM.saveSessionBtn.innerHTML = '<i class="fa-floppy-disk fa-solid"></i> Log Session';
  }, 1000);
}

function handleSaveSession() {
  if (!State.activePods.length) return;
  const session = StorageManager.addHistorySession(State.activePods, State.targetSize);
  if (session) {
    renderHistory();
    DOM.saveSessionBtn.disabled = true;
    DOM.saveSessionBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Session Logged';
  }
}

function renderActivePods() {
  DOM.podsGridContainer.innerHTML = '';
  DOM.podsCountIndicator.textContent = `${State.activePods.length} Tables Formed`;

  if (!State.activePods.length) {
    DOM.podsGridContainer.innerHTML = `
      <div class="empty-state" style="padding: 4rem 1rem;">
        <i class="fa-solid fa-dice"></i>
        <p style="font-size: 1.1rem; font-weight: 500; margin-top: 0.5rem;">Select active players and hit "Randomize Pods" to begin.</p>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">We will automatically balance size splits (e.g. 9 players splits into 3 ideal tables of 3).</p>
      </div>
    `;
    DOM.podsCountIndicator.textContent = '';
    return;
  }

  const themes = ['w-theme', 'u-theme', 'b-theme', 'r-theme', 'g-theme'];

  State.activePods.forEach((pod, podIdx) => {
    const card = document.createElement('div');
    const theme = themes[podIdx % themes.length];
    card.className = `pod-card ${theme}`;
    card.dataset.index = podIdx;

    if (State.swapMode) {
      card.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    }

    card.innerHTML = `
      <div class="pod-header">
        <h3 class="pod-number"><i class="fa-solid fa-circle"></i> Table ${podIdx + 1}</h3>
        <span class="pod-size-tag">${pod.length} Players</span>
      </div>
      <div class="pod-players-list"></div>
      <div class="pod-footer-controls">
        <button type="button" class="btn btn-secondary btn-sm load-pod-direct-btn" style="font-size:0.7rem; padding:0.25rem 0.4rem; margin-right:auto;">
          <i class="fa-solid fa-gamepad"></i> Send to Table
        </button>
        <button type="button" class="btn-pod-reroll"><i class="fa-solid fa-shuffle"></i> Turn Order</button>
      </div>
    `;

    const list = card.querySelector('.pod-players-list');
    
    // Direct pod loading event listener
    card.querySelector('.load-pod-direct-btn').onclick = () => {
      State.tableState.playerCount = Math.min(5, Math.max(2, pod.length));
      
      // Select count in Table Setup
      DOM.btnSizeTableList.forEach(b => {
        if (parseInt(b.dataset.count, 10) === State.tableState.playerCount) b.classList.add('active');
        else b.classList.remove('active');
      });

      // Prepare seats in Table State
      initializeTablePlayers();

      // Pre-fill seats
      pod.forEach((p, seatIdx) => {
        if (seatIdx < State.tableState.playerCount) {
          const seatSelect = DOM.tablePlayersDropdownsContainer.querySelectorAll(`.table-player-select[data-seat="${seatIdx}"]`)[0];
          if (seatSelect) {
            seatSelect.value = p.id;
            handleSeatPlayerChange(seatIdx, p.id);
          }
        }
      });

      switchView('table');
      console.log(`Loaded Table ${podIdx + 1} directly into active combat Table!`);
    };

    pod.forEach((player, playerIdx) => {
      const item = document.createElement('div');
      item.className = 'pod-player-item';

      if (State.swapCandidate && State.swapCandidate.podIndex === podIdx && State.swapCandidate.playerIndex === playerIdx) {
        item.classList.add('swap-candidate');
      }

      item.innerHTML = `
        <div class="pod-player-item-name">
          <i class="fa-solid fa-shield-halved"></i>
          <span>${escapeHtml(player.name)}</span>
        </div>
        <div class="pod-player-controls">
          <button type="button" class="btn-pod-action" title="Manual seat order swap"><i class="fa-solid fa-right-left"></i></button>
        </div>
      `;

      item.onclick = () => {
        if (State.swapMode) {
          handleManualSeatingSwap(podIdx, playerIdx);
        } else {
          // If swap mode is off, clicking a player could trigger swap candidate too (standard legacy swap)
          handleManualSeatingSwap(podIdx, playerIdx);
        }
      };

      list.appendChild(item);
    });

    card.querySelector('.btn-pod-reroll').onclick = () => {
      State.activePods[podIdx] = shuffleArray(State.activePods[podIdx]);
      renderActivePods();
      DOM.saveSessionBtn.disabled = false;
      DOM.saveSessionBtn.innerHTML = '<i class="fa-floppy-disk fa-solid"></i> Log Session';
    };

    DOM.podsGridContainer.appendChild(card);
  });
}

function handleManualSeatingSwap(podIdx, playerIdx) {
  if (State.swapCandidate === null) {
    State.swapCandidate = { podIndex: podIdx, playerIndex: playerIdx };
    renderActivePods();
  } else {
    const first = State.swapCandidate;
    
    // Clicking same player deselects
    if (first.podIndex === podIdx && first.playerIndex === playerIdx) {
      State.swapCandidate = null;
      renderActivePods();
      return;
    }

    // Perform seating trade!
    const playerA = State.activePods[first.podIndex][first.playerIndex];
    const playerB = State.activePods[podIdx][playerIdx];

    State.activePods[first.podIndex][first.playerIndex] = playerB;
    State.activePods[podIdx][playerIdx] = playerA;

    State.swapCandidate = null;
    renderActivePods();

    DOM.saveSessionBtn.disabled = false;
    DOM.saveSessionBtn.innerHTML = '<i class="fa-floppy-disk fa-solid"></i> Log Session';
  }
}

// ==========================================================================
// SERVICE 3: THE ROSTER (STAT, PROFILES & ELO CONTROLLERS)
// ==========================================================================

function setupRosterEvents() {
  // Roster Tab switching (Dashboard, Log, Global)
  DOM.rosterTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchRosterTab(btn.dataset.rosterTab);
    });
  });

  // Profile creator
  DOM.btnAddProfile.addEventListener('click', handleCreateProfile);
  DOM.rosterProfileName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleCreateProfile();
  });

  // Profile selector manage
  DOM.profileSelectorDropdown.addEventListener('change', (e) => {
    const pid = e.target.value;
    handleManageProfileSelect(pid);
  });

  // Deck creator
  DOM.btnAddDeck.addEventListener('click', handleCreateDeck);
  DOM.inputNewDeckName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleCreateDeck();
  });

  // Playgroup setting banner
  DOM.btnSaveClubName.addEventListener('click', () => {
    const name = DOM.inputClubName.value.trim();
    if (!name) return;
    StorageManager.saveClubName(name);
    
    // Update header Brand
    const headerTitle = document.querySelector('.brand-title');
    if (headerTitle) {
      headerTitle.textContent = name.toUpperCase();
    }
    
    alert(`Playgroup Club Banner updated to: "${name}"!`);
  });

  // Privacy toggles
  document.querySelectorAll('input[name="privacy-toggle"]').forEach(rad => {
    rad.addEventListener('change', (e) => {
      StorageManager.savePrivacy(e.target.value);
      console.log(`Club Privacy Mode updated to: ${e.target.value}`);
    });
  });

  // Export JSON Backup
  DOM.btnExportClubJson.addEventListener('click', () => {
    const data = StorageManager.exportClubData();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `planeswalker_club_${data.clubId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  });

  // Clear Matches History Modal
  DOM.btnTriggerClearMatches.addEventListener('click', () => {
    DOM.clearMatchesDialog.showModal();
  });

  DOM.btnCancelClearMatches.addEventListener('click', () => DOM.clearMatchesDialog.close());
  DOM.btnConfirmClearMatches.addEventListener('click', () => {
    StorageManager.clearMatches();
    
    // Update rankings/recent matches
    renderEloLeaderboard();
    renderDecksLeaderboard();
    renderRecentMatches();
    renderRoster(); // updates ELO badges in roster organizer

    DOM.clearMatchesDialog.close();
  });

  // Log Match Form Dropdown listener (to populate deck selects dynamically)
  setupMatchLoggerDropdowns();

  // Log Match Form Submission
  DOM.matchLoggerForm.addEventListener('submit', handleMatchLoggingSubmit);
}

function switchRosterTab(tabName) {
  State.activeRosterTab = tabName;

  DOM.rosterTabBtns.forEach(btn => {
    if (btn.dataset.rosterTab === tabName) btn.classList.add('active');
    else btn.classList.remove('active');
  });

  DOM.rosterTabContents.forEach(content => {
    if (content.id === `roster-tab-${tabName}`) {
      content.style.display = tabName === 'dashboard' ? 'flex' : 'block';
      content.classList.add('active');
    } else {
      content.style.display = 'none';
      content.classList.remove('active');
    }
  });

  // Refresh leaderboards/dropdowns when tabs change
  if (tabName === 'dashboard') {
    renderEloLeaderboard();
    renderDecksLeaderboard();
    renderRecentMatches();
  } else if (tabName === 'log') {
    populateMatchDropdowns();
  }
}

function handleCreateProfile() {
  const name = DOM.rosterProfileName.value.trim();
  if (!name) return;

  const added = StorageManager.addPlayer(name);
  if (!added) {
    alert("This Planeswalker profile already exists!");
    return;
  }

  DOM.rosterProfileName.value = '';
  renderRoster(); // Pod Active Roster pool
  renderRosterProfiles(); // Profiles Manager
  
  if (State.activeRosterTab === 'dashboard') {
    renderEloLeaderboard();
  }
}

function renderRosterProfiles() {
  const players = StorageManager.getPlayers();
  DOM.profileSelectorDropdown.innerHTML = `<option value="">-- Select Profile --</option>`;

  if (!players.length) {
    DOM.deckManagementSection.style.display = 'none';
    DOM.profileEmptyState.style.display = 'block';
    return;
  }

  players.forEach(p => {
    DOM.profileSelectorDropdown.innerHTML += `<option value="${p.id}">${escapeHtml(p.name)}</option>`;
  });

  // Keep managed selection if active
  if (State.selectedManagePlayerId) {
    DOM.profileSelectorDropdown.value = State.selectedManagePlayerId;
    handleManageProfileSelect(State.selectedManagePlayerId);
  } else {
    DOM.deckManagementSection.style.display = 'none';
    DOM.profileEmptyState.style.display = 'block';
  }
}

function handleManageProfileSelect(playerId) {
  State.selectedManagePlayerId = playerId;
  
  if (!playerId) {
    DOM.deckManagementSection.style.display = 'none';
    DOM.profileEmptyState.style.display = 'block';
    return;
  }

  DOM.profileEmptyState.style.display = 'none';
  DOM.deckManagementSection.style.display = 'block';

  renderProfileDecks(playerId);
}

function renderProfileDecks(playerId) {
  const players = StorageManager.getPlayers();
  const player = players.find(p => p.id === playerId);
  DOM.profileDecksContainer.innerHTML = '';

  if (!player) return;

  const decks = player.decks || [];
  DOM.profileDeckCount.textContent = decks.length;

  if (!decks.length) {
    DOM.profileDecksContainer.innerHTML = `
      <div class="empty-state" style="padding: 1.5rem 0;">
        <i class="fa-solid fa-dharmachakra" style="font-size: 1.5rem;"></i>
        <p style="font-size: 0.8rem;">No custom decks saved for this profile yet.</p>
      </div>
    `;
    return;
  }

  decks.forEach(deck => {
    const item = document.createElement('div');
    item.className = 'roster-item active';
    item.style.padding = '0.4rem 0.6rem;';
    item.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.4rem;">
        <i class="fa-solid fa-circle" style="font-size: 0.45rem; color: var(--color-brand);"></i>
        <span class="player-name" style="font-size:0.85rem;">${escapeHtml(deck)}</span>
      </div>
      <button type="button" class="btn-delete-player" style="opacity:1;" title="Delete deck"><i class="fa-solid fa-trash-can" style="font-size:0.75rem;"></i></button>
    `;

    item.querySelector('.btn-delete-player').onclick = () => {
      StorageManager.deletePlayerDeck(playerId, deck);
      renderProfileDecks(playerId);
      
      if (State.activeRosterTab === 'dashboard') {
        renderDecksLeaderboard();
      }
    };

    DOM.profileDecksContainer.appendChild(item);
  });
}

function handleCreateDeck() {
  const pid = State.selectedManagePlayerId;
  const name = DOM.inputNewDeckName.value.trim();
  
  if (!pid || !name) return;

  const added = StorageManager.addPlayerDeck(pid, name);
  if (!added) {
    alert("This deck name is already saved for this profile!");
    return;
  }

  DOM.inputNewDeckName.value = '';
  renderProfileDecks(pid);
}

// --- ELO RANKINGS & LEADERBOARD RENDER ---
function renderEloLeaderboard() {
  const players = StorageManager.getPlayers();
  DOM.eloLeaderboardBody.innerHTML = '';

  if (!players.length) {
    DOM.eloLeaderboardBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding: 2rem 0; color:var(--text-muted);">
          No planeswalkers in playgroup yet. Create profiles in the left sidebar to begin tracking rankings!
        </td>
      </tr>
    `;
    return;
  }

  // Sort players by ELO descending
  const sorted = [...players].sort((a, b) => b.elo - a.elo);

  sorted.forEach((p, idx) => {
    let bountyHtml = '-';
    if (p.bounty && p.bounty > 0) {
      bountyHtml = `<span class="bounty-pill"><i class="fa-solid fa-circle-dollar-to-slot"></i> Bounty ${p.bounty}%</span>`;
    }

    let streakHtml = '-';
    if (p.winStreak && p.winStreak > 0) {
      streakHtml = `<span class="streak-pill"><i class="fa-solid fa-fire-flame-curved"></i> ${p.winStreak}</span>`;
    }

    DOM.eloLeaderboardBody.innerHTML += `
      <tr>
        <td style="text-align:center; font-weight:bold; color:${idx === 0 ? 'var(--color-brand)' : 'inherit'};">
          #${idx + 1}
        </td>
        <td style="font-weight:600; color:${idx === 0 ? 'var(--color-brand)' : 'inherit'};">
          ${escapeHtml(p.name)}
        </td>
        <td style="text-align:center; font-weight:700; font-family:var(--font-display); color:var(--color-brand);">
          ${Math.round(p.elo)} ELO
        </td>
        <td style="text-align:center;">
          ${bountyHtml}
        </td>
        <td style="text-align:center;">
          ${streakHtml}
        </td>
      </tr>
    `;
  });
}

function renderDecksLeaderboard() {
  const deckStats = StorageManager.getDeckStats();
  DOM.decksLeaderboardBody.innerHTML = '';

  if (!deckStats.length) {
    DOM.decksLeaderboardBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding: 2rem 0; color:var(--text-muted);">
          No decks battles logged yet. Submit battle records in the "Log Match" tab to generate performance metrics!
        </td>
      </tr>
    `;
    return;
  }

  deckStats.forEach((d, idx) => {
    DOM.decksLeaderboardBody.innerHTML += `
      <tr>
        <td style="text-align:center; font-weight:bold; color:${idx === 0 ? 'var(--color-brand)' : 'inherit'};">
          #${idx + 1}
        </td>
        <td style="font-weight:600; color:${idx === 0 ? 'var(--color-blue)' : 'inherit'};">
          ${escapeHtml(d.deckName)}
        </td>
        <td>
          ${escapeHtml(d.playerName)}
        </td>
        <td style="text-align:center; color:var(--color-green); font-weight:bold;">
          ${d.wins}
        </td>
        <td style="text-align:center; color:var(--color-red); font-weight:bold;">
          ${d.losses}
        </td>
        <td style="text-align:center; font-weight:bold; color:var(--color-brand); font-family:var(--font-display);">
          ${d.winPercentage}%
        </td>
      </tr>
    `;
  });
}

function renderRecentMatches() {
  const matches = StorageManager.getMatches();
  DOM.matchesHistoryContainer.innerHTML = '';

  if (!matches.length) {
    DOM.matchesHistoryContainer.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-history"></i>
        <p>No logged match records for this playgroup yet.</p>
      </div>
    `;
    return;
  }

  matches.forEach(match => {
    const card = document.createElement('article');
    card.className = 'history-card';
    card.style.background = 'rgba(18, 22, 33, 0.4)';
    card.style.border = '1px solid rgba(255, 255, 255, 0.03)';

    const date = new Date(match.timestamp);
    const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    // Winner html
    let winnerBonusText = '';
    if (match.bountyClaims && match.bountyClaims.length > 0) {
      const claimsStr = match.bountyClaims.map(bc => `${bc.playerName} (${bc.bountyPercent}% Bounty)`).join(', ');
      winnerBonusText = `<div style="font-size:0.75rem; color:var(--color-brand); margin-top:0.25rem;"><i class="fa-solid fa-circle-dollar-to-slot"></i> Bounty claimed from: ${claimsStr} (+${match.bountyClaims.reduce((s,c)=>s+c.bonusPoints,0)} ELO Bonus!)</div>`;
    }

    const winnerHtml = `
      <div style="background:rgba(255,170,0,0.04); border:1px solid rgba(255,170,0,0.15); border-radius:6px; padding:0.5rem 0.75rem; margin-bottom:0.75rem;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight:700; color:var(--color-brand);"><i class="fa-solid fa-crown"></i> ${escapeHtml(match.winner.name)} (Winner)</span>
          <span class="elo-badge plus">+${match.winner.eloChange} ELO (New: ${Math.round(match.winner.newElo)})</span>
        </div>
        <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.2rem;">Deck: ${escapeHtml(match.winner.deck)} • Win Streak: ${match.winner.streak} ${match.winner.newBounty > 0 ? `• New Bounty: ${match.winner.newBounty}%` : ''}</div>
        ${winnerBonusText}
      </div>
    `;

    // Losers html
    let losersHtml = '';
    match.losers.forEach(loser => {
      const claimedText = loser.bountyClaimed > 0 ? `<span style="font-size:0.7rem; background:rgba(255,68,0,0.15); color:#ff5500; padding:0.1rem 0.3rem; border-radius:3px; font-weight:bold; margin-left:0.4rem;">Bounty ${loser.bountyClaimed}% Claimed</span>` : '';
      losersHtml += `
        <div style="background:rgba(255,255,255,0.01); border:1px solid rgba(255,255,255,0.03); border-radius:6px; padding:0.4rem 0.6rem; margin-bottom:0.4rem; display:flex; justify-content:space-between; align-items:center; font-size:0.85rem;">
          <div>
            <span style="font-weight:600; color:var(--text-main);">${escapeHtml(loser.name)}</span>
            <span style="font-size:0.75rem; color:var(--text-muted); margin-left:0.4rem;">Deck: ${escapeHtml(loser.deck)}</span>
            ${claimedText}
          </div>
          <span class="elo-badge minus">${loser.eloChange} ELO (New: ${Math.round(loser.newElo)})</span>
        </div>
      `;
    });

    card.innerHTML = `
      <div class="history-header" style="margin-bottom: 0.6rem;">
        <div class="history-meta">
          <span class="history-date">${dateStr} - ${timeStr}</span>
          <span class="history-details">Hub: ${escapeHtml(match.clubId || "Planeswalker Alliance")}</span>
        </div>
      </div>
      <div>
        ${winnerHtml}
        <div style="font-size:0.75rem; color:var(--text-muted); font-weight:bold; text-transform:uppercase; margin-bottom:0.4rem;">Defeated Rivals</div>
        ${losersHtml}
      </div>
    `;

    DOM.matchesHistoryContainer.appendChild(card);
  });
}

// --- ROSTER MATCH LOGGER CONTROLLERS ---

function setupMatchLoggerDropdowns() {
  const playersSelects = [
    { player: DOM.logWinnerSelect, deck: DOM.logWinnerDeck },
    { player: DOM.logLoser1Select, deck: DOM.logLoser1Deck },
    { player: DOM.logLoser2Select, deck: DOM.logLoser2Deck },
    { player: DOM.logLoser3Select, deck: DOM.logLoser3Deck }
  ];

  playersSelects.forEach(group => {
    group.player.addEventListener('change', () => {
      const playerId = group.player.value;
      populateDecksForSelector(playerId, group.deck);
    });
  });
}

function populateMatchDropdowns() {
  const players = StorageManager.getPlayers();
  
  const selectors = [
    DOM.logWinnerSelect,
    DOM.logLoser1Select,
    DOM.logLoser2Select,
    DOM.logLoser3Select
  ];

  selectors.forEach(sel => {
    const oldVal = sel.value;
    
    sel.innerHTML = `<option value="">-- Select Planeswalker --</option>`;
    players.forEach(p => {
      const streakText = p.winStreak >= 2 ? ` 🔥${p.winStreak}` : '';
      sel.innerHTML += `<option value="${p.id}">${escapeHtml(p.name)} (ELO: ${Math.round(p.elo)}${streakText})</option>`;
    });

    sel.value = oldVal;
  });
}

function populateDecksForSelector(playerId, deckDropdownElement) {
  if (!playerId) {
    deckDropdownElement.innerHTML = `<option value="">-- Select Deck --</option>`;
    return;
  }

  const players = StorageManager.getPlayers();
  const player = players.find(p => p.id === playerId);
  
  deckDropdownElement.innerHTML = '';
  
  if (player && player.decks && player.decks.length > 0) {
    player.decks.forEach(deck => {
      deckDropdownElement.innerHTML += `<option value="${escapeHtml(deck)}">${escapeHtml(deck)}</option>`;
    });
  } else {
    deckDropdownElement.innerHTML += `<option value="Default Deck">Default Deck</option>`;
  }
}

function handleMatchLoggingSubmit(e) {
  e.preventDefault();

  const winnerId = DOM.logWinnerSelect.value;
  const winnerDeck = DOM.logWinnerDeck.value;
  
  const loser1Id = DOM.logLoser1Select.value;
  const loser1Deck = DOM.logLoser1Deck.value;
  
  const loser2Id = DOM.logLoser2Select.value;
  const loser2Deck = DOM.logLoser2Deck.value;
  
  const loser3Id = DOM.logLoser3Select.value;
  const loser3Deck = DOM.logLoser3Deck.value;

  const selectedIds = [winnerId, loser1Id, loser2Id, loser3Id];
  const uniqueIds = new Set(selectedIds);
  
  if (uniqueIds.size < 4) {
    alert("Duplicate players selected! A 4-player game requires exactly 4 unique Planeswalker profiles.");
    return;
  }

  const losers = [
    { id: loser1Id, deck: loser1Deck },
    { id: loser2Id, deck: loser2Deck },
    { id: loser3Id, deck: loser3Deck }
  ];

  const matchResult = StorageManager.logMatch(winnerId, winnerDeck, losers);
  
  if (matchResult) {
    DOM.matchLoggerForm.reset();
    
    [DOM.logWinnerSelect, DOM.logLoser1Select, DOM.logLoser2Select, DOM.logLoser3Select].forEach(sel => sel.value = "");
    [DOM.logWinnerDeck, DOM.logLoser1Deck, DOM.logLoser2Deck, DOM.logLoser3Deck].forEach(d => d.innerHTML = `<option value="">-- Select Deck --</option>`);

    switchRosterTab('dashboard');
    renderRoster(); // Refresh ELO displays on organizer sidebar
    alert(" EDH Match logged successfully! ELO ratings and Bounty streaks updated.");
  }
}

// --- UTILITY HELPER FUNCTIONS ---
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
