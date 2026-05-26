import { StorageManager } from './storage.js';
import { generatePods, shuffleArray } from './pod-logic.js';

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
    const seatId = `seat_${i}`;
    
    // Choose a default guest player
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
      
      // Load their decks
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
    renderTableArena();
  });

  // Log table result shortcut
  DOM.btnLogTableGame.addEventListener('click', () => {
    // Collect players who played
    const activeTablePlayers = State.tableState.players.map(p => ({
      id: p.id,
      name: p.name,
      deck: p.deck
    }));

    // Filter out guests for logging (cannot log match with guests)
    const hasGuests = activeTablePlayers.some(p => p.id.startsWith('guest_'));
    if (hasGuests) {
      alert("Cannot log match history with Guest players. Please create and select full Planeswalker profiles for all seats in the Roster tab first!");
      return;
    }

    // Switch view to Roster, and go to Roster Match Logging tab
    switchView('roster');
    switchRosterTab('log');

    // Pre-populate dropdown selectors in the Match logger form
    // Dropdowns: log-winner-select, log-loser1-select, etc.
    const selects = [
      DOM.logWinnerSelect,
      DOM.logLoser1Select,
      DOM.logLoser2Select,
      DOM.logLoser3Select
    ];

    selects.forEach((sel, selIndex) => {
      if (selIndex < activeTablePlayers.length) {
        sel.value = activeTablePlayers[selIndex].id;
        // Trigger manual change to load their decks dropdown
        const event = new Event('change');
        sel.dispatchEvent(event);
        
        // Match deck selection
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
  
  // Set class on container for layout
  DOM.tableGridArenaContainer.className = `table-grid-arena grid-${State.tableState.playerCount}`;

  // Seeding mana themes
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

    // Prepare Commander Damage content
    let cmdDmgHtml = '';
    State.tableState.players.forEach((opp, oppIndex) => {
      if (oppIndex !== index) {
        const curDmg = player.cmdDamage[opp.id] || 0;
        const lethalClass = curDmg >= 21 ? 'streak-indicator' : '';
        cmdDmgHtml += `
          <div class="cmd-dmg-item-row">
            <span class="cmd-dmg-player-name"><i class="fa-solid fa-swords"></i> Damage from ${escapeHtml(opp.name)}:</span>
            <div class="drawer-counter-row">
              <button type="button" class="btn-drawer-counter" data-action="cmd-dmg-dec" data-opp="${opp.id}">-</button>
              <span class="drawer-counter-val ${lethalClass}">${curDmg}</span>
              <button type="button" class="btn-drawer-counter" data-action="cmd-dmg-inc" data-opp="${opp.id}">+</button>
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
        <span class="tax-val" style="font-size: 0.75rem; text-transform:uppercase;">Seat ${index + 1}</span>
      </div>

      <div class="life-counter-section">
        <button type="button" class="btn-life btn-life-minus" data-action="life-dec">-</button>
        <span class="life-val-display">${player.life}</span>
        <button type="button" class="btn-life btn-life-plus" data-action="life-inc">+</button>
      </div>

      <div class="commander-tax-sub">
        <span class="tax-label"><i class="fa-solid fa-gavel"></i> Commander Tax</span>
        <div class="tax-controls">
          <button type="button" class="tax-btn" data-action="tax-dec">-</button>
          <span class="tax-val">${player.tax}</span>
          <button type="button" class="tax-btn" data-action="tax-inc">+</button>
        </div>
      </div>

      <!-- Toggleable drawers overlay -->
      <button type="button" class="drawer-toggle-trigger" data-action="drawer-open">
        <i class="fa-solid fa-chart-line"></i> Trackers
      </button>

      <div class="drawer-panel" data-seat="${index}">
        <div class="drawer-handle" data-action="drawer-close"></div>
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

          <div class="drawer-commander-dmg-block">
            <span class="drawer-card-label" style="justify-content:flex-start; margin-bottom:0.25rem;"><i class="fa-solid fa-crown" style="color:var(--color-brand);"></i> Commander Damage Received (Max 21)</span>
            ${cmdDmgHtml}
          </div>

        </div>
      </div>
    `;

    // Bind Life & Tax Events directly on elements
    bindTableCardEvents(card, index);

    DOM.tableGridArenaContainer.appendChild(card);
  });
}

function bindTableCardEvents(card, seatIndex) {
  const p = State.tableState.players[seatIndex];

  // Life buttons
  card.querySelector('[data-action="life-dec"]').onclick = () => { p.life--; renderTableArena(); };
  card.querySelector('[data-action="life-inc"]').onclick = () => { p.life++; renderTableArena(); };

  // Tax buttons
  card.querySelector('[data-action="tax-dec"]').onclick = () => { p.tax = Math.max(0, p.tax - 2); renderTableArena(); };
  card.querySelector('[data-action="tax-inc"]').onclick = () => { p.tax += 2; renderTableArena(); };

  // Drawer slider triggers
  const drawer = card.querySelector('.drawer-panel');
  card.querySelector('[data-action="drawer-open"]').onclick = () => { drawer.classList.add('open'); };
  card.querySelector('[data-action="drawer-close"]').onclick = () => { drawer.classList.remove('open'); };

  // Poison buttons
  card.querySelector('[data-action="poison-dec"]').onclick = () => { p.poison = Math.max(0, p.poison - 1); renderTableArena(); };
  card.querySelector('[data-action="poison-inc"]').onclick = () => { p.poison++; renderTableArena(); };

  // Rads buttons
  card.querySelector('[data-action="rad-dec"]').onclick = () => { p.rad = Math.max(0, p.rad - 1); renderTableArena(); };
  card.querySelector('[data-action="rad-inc"]').onclick = () => { p.rad++; renderTableArena(); };

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

// ==========================================================================
// SERVICE 2: THE POD (LARGE GROUP ORGANIZER CONTROLLERS)
// ==========================================================================

function updateTargetSize(size) {
  State.targetSize = size;
  StorageManager.saveSettings({ targetSize: size });

  [DOM.size3Btn, DOM.size4Btn, DOM.size5Btn].forEach(btn => {
    if (btn) {
      const btnSize = parseInt(btn.dataset.size, 10);
      if (btnSize === size) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  });

  updateActiveCount();
}

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
  // Listeners on player selectors to dynamically load their deck selects
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
    // Preserve old selection if still valid
    const oldVal = sel.value;
    
    sel.innerHTML = `<option value="">-- Select Planeswalker --</option>`;
    players.forEach(p => {
      // Show their ELO and streak in dropdown
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

  // Strict Validation: ensure all selected players are unique
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

  // Log Match in Storage Manager (triggers standard ELO and Bounty calculations)
  const matchResult = StorageManager.logMatch(winnerId, winnerDeck, losers);
  
  if (matchResult) {
    // Reset form fields
    DOM.matchLoggerForm.reset();
    
    // Clear selects
    [DOM.logWinnerSelect, DOM.logLoser1Select, DOM.logLoser2Select, DOM.logLoser3Select].forEach(sel => sel.value = "");
    [DOM.logWinnerDeck, DOM.logLoser1Deck, DOM.logLoser2Deck, DOM.logLoser3Deck].forEach(d => d.innerHTML = `<option value="">-- Select Deck --</option>`);

    // Switch view to Dashboard and reload ELO listings
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
