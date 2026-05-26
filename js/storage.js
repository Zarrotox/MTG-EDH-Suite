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

export const StorageManager = {
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
