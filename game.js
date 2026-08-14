// ==========================================================================
// 5 IN 5 - MOTORE DI GIOCO PRINCIPALE (game.js)
// ==========================================================================

(() => {
  "use strict";

  const APP_VERSION = "1.0.0";
  const TOTAL_SECONDS = 300; 
  const ROUND_LENGTHS = [4, 5, 6, 7, 8];

  let currentPuzzle = null;
  let currentRoundIndex = 0;
  let activeWordLength = ROUND_LENGTHS[0];

  // Griglia: 30 oggetti { id: number, letter: string, isUsed: boolean }
  let gridLetters = [];
  let currentSelection = [];
  
  // Set di ID specifici per le tessere colorate in giallo nel round corrente
  let yellowTileIds = new Set();
  // Set di caratteri unici scoperti per il testo di aiuto (es. "C, E")
  let discoveredLetters = new Set();

  let timeRemaining = TOTAL_SECONDS;
  let timerInterval = null;
  let isTimerRunning = false;
  let isPaused = false;
  let isGameOver = false;
  let isGameWon = false;

  let roundAttempts = [0, 0, 0, 0, 0];

  // --- RIFERIMENTI DOM ---
  const gameTag = document.getElementById("game-tag");
  const timerDisplay = document.getElementById("timer-display");
  const roundTracker = document.getElementById("round-tracker");
  const slotsContainer = document.getElementById("current-word-slots");
  const hintTextElem = document.getElementById("hint-text");
  const letterGrid = document.getElementById("letter-grid");
  const toastContainer = document.getElementById("toast-container");

  const btnBackspace = document.getElementById("btn-backspace");
  const btnPause = document.getElementById("btn-pause");
  const btnSubmit = document.getElementById("btn-submit");

  const btnHelp = document.getElementById("btn-help");
  const btnAbout = document.getElementById("btn-about");
  const btnStats = document.getElementById("btn-stats");
  const modalHelp = document.getElementById("modal-help");
  const modalAbout = document.getElementById("modal-about");
  const modalStats = document.getElementById("modal-stats");
  const modalPause = document.getElementById("modal-pause");
  const btnResume = document.getElementById("btn-resume");

  const gameResultBanner = document.getElementById("game-result-banner");
  const solutionsReveal = document.getElementById("solutions-reveal");
  const solutionsList = document.getElementById("solutions-list");
  const shareSection = document.getElementById("share-section");
  const btnShare = document.getElementById("btn-share");

  // --- INIZIALIZZAZIONE ---
  function initGame() {
    currentPuzzle = getDailyPuzzle();
    activeWordLength = ROUND_LENGTHS[currentRoundIndex];

    if (gameTag) {
      gameTag.textContent = `v${APP_VERSION} • Giorno #${currentPuzzle.dayNumber}`;
    }

    setupGridData();
    loadSavedState(); 

    renderRoundTracker();
    renderSlots();
    renderGrid();
    updateHintDisplay();
    setupEventListeners();

    if (!localStorage.getItem("cinque_in_cinque_seen_help")) {
      openModal(modalHelp);
      localStorage.setItem("cinque_in_cinque_seen_help", "true");
    }
  }

  function setupGridData() {
    const allLetters = currentPuzzle.words.join("").split("");
    const shuffled = shuffleArrayWithSeed(allLetters, currentPuzzle.dayNumber * 7919);

    gridLetters = shuffled.map((char, index) => ({
      id: Number(index),
      letter: char.toUpperCase(),
      isUsed: false
    }));
  }

  // --- RENDER UI ---

  function renderRoundTracker() {
    const dots = roundTracker.querySelectorAll(".tracker-dot");
    dots.forEach((dot, idx) => {
      dot.className = "tracker-dot";
      if (idx < currentRoundIndex) {
        dot.classList.add("completed");
      } else if (idx === currentRoundIndex) {
        dot.classList.add("active");
      }
    });
  }

  function renderSlots() {
    slotsContainer.innerHTML = "";
    activeWordLength = ROUND_LENGTHS[currentRoundIndex];

    for (let i = 0; i < activeWordLength; i++) {
      const slot = document.createElement("div");
      slot.className = "word-slot";

      if (i < currentSelection.length) {
        const item = currentSelection[i];
        slot.textContent = item.letter;
        slot.classList.add("filled");
      } else {
        slot.textContent = "";
      }

      slotsContainer.appendChild(slot);
    }
  }

  function renderGrid() {
    letterGrid.innerHTML = "";

    const selectedTileIds = new Set(currentSelection.map(item => Number(item.tileId)));

    gridLetters.forEach((tile) => {
      const btn = document.createElement("button");
      btn.className = "tile-btn";
      btn.textContent = tile.letter;
      btn.dataset.id = String(tile.id);

      if (tile.isUsed) {
        btn.classList.add("used-letter");
        btn.disabled = true;
      } else {
        if (selectedTileIds.has(tile.id)) {
          btn.classList.add("selected");
        } else if (yellowTileIds.has(tile.id)) {
          btn.classList.add("present-hint");
        }
      }

      btn.addEventListener("click", () => handleTileClick(tile.id));
      letterGrid.appendChild(btn);
    });
  }

  function updateHintDisplay() {
    if (!hintTextElem) return;

    if (discoveredLetters.size > 0) {
      const sortedChars = Array.from(discoveredLetters).sort().join(", ");
      hintTextElem.textContent = `Lettere contenute: ${sortedChars}`;
    } else {
      hintTextElem.textContent = "";
    }
  }

  // --- GESTIONE INPUT & CLICK ---

  function handleTileClick(tileId) {
    if (isGameOver || isPaused) return;
    startTimerIfNeeded();

    const numericId = Number(tileId);
    const tile = gridLetters.find(t => t.id === numericId);
    if (!tile || tile.isUsed) return;

    const existingIndex = currentSelection.findIndex(item => item.tileId === numericId);

    if (existingIndex !== -1) {
      currentSelection.splice(existingIndex, 1);
    } else {
      if (currentSelection.length < activeWordLength) {
        currentSelection.push({
          tileId: numericId,
          letter: tile.letter
        });
      } else {
        showToast(`Lunghezza massima: ${activeWordLength} lettere!`);
        return;
      }
    }

    renderSlots();
    renderGrid();
  }

  function handleBackspace() {
    if (isGameOver || isPaused || currentSelection.length === 0) return;
    currentSelection.pop();
    renderSlots();
    renderGrid();
  }

  function handleSubmit() {
    if (isGameOver || isPaused) return;
    startTimerIfNeeded();

    if (currentSelection.length < activeWordLength) {
      showToast(`Inserisci tutte le ${activeWordLength} lettere!`);
      shakeElement(slotsContainer);
      return;
    }

    const enteredWord = currentSelection.map(item => item.letter).join("");
    const targetWord = currentPuzzle.words[currentRoundIndex];

    // VERIFICA VALIDITA NEL VOCABOLARIO (Anti-Cheat)
    const isTarget = (enteredWord === targetWord);
    const isValidDictionaryWord = typeof isWordInDictionary === "function" ? isWordInDictionary(enteredWord) : true;

    if (!isTarget && !isValidDictionaryWord) {
      showToast("Parola non presente nel database! ❌");
      shakeElement(slotsContainer);
      return;
    }

    roundAttempts[currentRoundIndex]++;

    if (isTarget) {
      handleRoundSuccess();
    } else {
      handleRoundError(enteredWord, targetWord);
    }
  }

  // --- ESITO ROUND ---

  function handleRoundSuccess() {
    const slots = slotsContainer.querySelectorAll(".word-slot");
    slots.forEach(slot => slot.classList.add("correct"));

    currentSelection.forEach(item => {
      const tile = gridLetters.find(t => t.id === item.tileId);
      if (tile) tile.isUsed = true;
    });

    yellowTileIds.clear();
    discoveredLetters.clear();
    updateHintDisplay();

    showToast("Parola corretta! 🎉");

    setTimeout(() => {
      currentRoundIndex++;
      currentSelection = [];

      if (currentRoundIndex >= ROUND_LENGTHS.length) {
        handleGameVictory();
      } else {
        activeWordLength = ROUND_LENGTHS[currentRoundIndex];
        renderRoundTracker();
        renderSlots();
        renderGrid();
        saveGameState();
      }
    }, 600);
  }

  function handleRoundError(enteredWord, targetWord) {
    shakeElement(slotsContainer);
    showToast("Non è la parola corretta!");

    const targetCounts = {};
    for (const char of targetWord) {
      targetCounts[char] = (targetCounts[char] || 0) + 1;
    }

    currentSelection.forEach(item => {
      if (targetCounts[item.letter] && targetCounts[item.letter] > 0) {
        targetCounts[item.letter]--;
        yellowTileIds.add(item.tileId);
        discoveredLetters.add(item.letter);
      }
    });

    currentSelection = [];

    updateHintDisplay();
    renderSlots();
    renderGrid();
  }

  // --- TIMER & PAUSA ---

  function startTimerIfNeeded() {
    if (isTimerRunning || isGameOver || isPaused) return;
    isTimerRunning = true;

    timerInterval = setInterval(() => {
      timeRemaining--;
      updateTimerDisplay();

      if (timeRemaining <= 0) {
        clearInterval(timerInterval);
        handleTimeExpired();
      }
    }, 1000);
  }

  function pauseGame() {
    if (isGameOver || isPaused) return;
    
    if (isTimerRunning) {
      clearInterval(timerInterval);
      isTimerRunning = false;
    }
    isPaused = true;

    openModal(modalPause);
  }

  function resumeGame() {
    if (!isPaused || isGameOver) return;
    closeModal(modalPause);
    isPaused = false;
    startTimerIfNeeded();
  }

  function updateTimerDisplay() {
    const minutes = Math.floor(Math.max(0, timeRemaining) / 60);
    const seconds = Math.max(0, timeRemaining) % 60;
    const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    timerDisplay.textContent = formatted;

    if (timeRemaining <= 60) {
      timerDisplay.classList.add("urgent");
    } else {
      timerDisplay.classList.remove("urgent");
    }
  }

  // --- FINE PARTITA ---

  function handleGameVictory() {
    isGameOver = true;
    isGameWon = true;
    clearInterval(timerInterval);

    const elapsedSeconds = TOTAL_SECONDS - timeRemaining;
    saveGameStats(true, elapsedSeconds);
    saveGameState();

    setTimeout(() => {
      openEndGameModal(true);
    }, 500);
  }

  function handleTimeExpired() {
    isGameOver = true;
    isGameWon = false;
    timeRemaining = 0;
    updateTimerDisplay();

    showToast("Tempo scaduto! ⌛");
    saveGameStats(false, null);
    saveGameState();

    setTimeout(() => {
      openEndGameModal(false);
    }, 800);
  }

  // --- STORAGE & STATISTICHE ---

  function getStats() {
    const defaultStats = {
      played: 0,
      wins: 0,
      currentStreak: 0,
      maxStreak: 0,
      bestTimeSeconds: null,
      lastPlayedDay: null
    };
    try {
      const stored = localStorage.getItem("cinque_in_cinque_stats");
      return stored ? { ...defaultStats, ...JSON.parse(stored) } : defaultStats;
    } catch {
      return defaultStats;
    }
  }

  function saveGameStats(won, elapsedSeconds) {
    const stats = getStats();
    const dayKey = currentPuzzle.dayNumber;

    if (stats.lastPlayedDay !== dayKey) {
      stats.played++;
      if (won) {
        stats.wins++;
        stats.currentStreak++;
        if (stats.currentStreak > stats.maxStreak) {
          stats.maxStreak = stats.currentStreak;
        }
      } else {
        stats.currentStreak = 0;
      }
      stats.lastPlayedDay = dayKey;
    } else if (won && stats.wins === 0) {
      stats.wins = 1;
      stats.currentStreak = 1;
      stats.maxStreak = Math.max(stats.maxStreak, 1);
    }

    if (won && elapsedSeconds !== null) {
      if (stats.bestTimeSeconds === null || elapsedSeconds < stats.bestTimeSeconds) {
        stats.bestTimeSeconds = elapsedSeconds;
      }
    }

    localStorage.setItem("cinque_in_cinque_stats", JSON.stringify(stats));
  }

  function saveGameState() {
    const saveKey = `cinque_save_day_${currentPuzzle.dayNumber}`;
    const state = {
      dayNumber: currentPuzzle.dayNumber,
      currentRoundIndex,
      gridLetters,
      yellowTileIds: Array.from(yellowTileIds),
      discoveredLetters: Array.from(discoveredLetters),
      timeRemaining,
      isGameOver,
      isGameWon,
      roundAttempts
    };
    localStorage.setItem(saveKey, JSON.stringify(state));
  }

  function loadSavedState() {
    try {
      const saveKey = `cinque_save_day_${currentPuzzle.dayNumber}`;
      const saved = localStorage.getItem(saveKey);
      if (!saved) return;

      const state = JSON.parse(saved);

      if (state.dayNumber !== currentPuzzle.dayNumber || !state.gridLetters || state.gridLetters.length !== 30) {
        localStorage.removeItem(saveKey);
        return;
      }

      currentRoundIndex = state.currentRoundIndex || 0;
      gridLetters = state.gridLetters || gridLetters;
      yellowTileIds = new Set(state.yellowTileIds || []);
      discoveredLetters = new Set(state.discoveredLetters || []);
      timeRemaining = state.timeRemaining !== undefined ? state.timeRemaining : TOTAL_SECONDS;
      isGameOver = state.isGameOver || false;
      isGameWon = state.isGameWon || false;
      roundAttempts = state.roundAttempts || [0, 0, 0, 0, 0];

      updateTimerDisplay();
      renderRoundTracker();
      renderSlots();
      renderGrid();
      updateHintDisplay();

      if (isGameOver) {
        openEndGameModal(isGameWon);
      }
    } catch (e) {
      console.error("Errore nel ripristino", e);
    }
  }

  function formatSeconds(secs) {
    if (secs === null || secs === undefined) return "--:--";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${String(s).padStart(2, "0")}s`;
  }

  // --- MODALI & CONDIVISIONE ---

  function openModal(modal) {
    modal.classList.remove("hidden");
  }

  function closeModal(modal) {
    modal.classList.add("hidden");
  }

  function openEndGameModal(won) {
    const stats = getStats();

    document.getElementById("stat-played").textContent = stats.played;
    const winPct = stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0;
    document.getElementById("stat-win-pct").textContent = `${winPct}%`;
    document.getElementById("stat-streak").textContent = stats.currentStreak;
    document.getElementById("stat-best-time").textContent = formatSeconds(stats.bestTimeSeconds);

    gameResultBanner.classList.remove("hidden", "win", "loss");
    if (won) {
      const elapsed = TOTAL_SECONDS - timeRemaining;
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      gameResultBanner.classList.add("win");
      gameResultBanner.textContent = `Vittoria in ${mins}m ${secs}s! 🎉`;
    } else {
      gameResultBanner.classList.add("loss");
      gameResultBanner.textContent = "Tempo Scaduto! Ritenta domani ⌛";
    }

    solutionsList.innerHTML = "";
    currentPuzzle.words.forEach(w => {
      const span = document.createElement("span");
      span.className = "solution-tag";
      span.textContent = w;
      solutionsList.appendChild(span);
    });
    solutionsReveal.classList.remove("hidden");
    shareSection.classList.remove("hidden");

    openModal(modalStats);
  }

  function generateShareText() {
    const elapsed = TOTAL_SECONDS - timeRemaining;
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

    let text = `5 in 5 (v${APP_VERSION}) • Giorno #${currentPuzzle.dayNumber}\n`;
    text += isGameWon ? `Completato in ${timeStr} ⏱️\n\n` : `Tempo scaduto ⌛\n\n`;

    for (let i = 0; i < ROUND_LENGTHS.length; i++) {
      if (i < currentRoundIndex || isGameWon) {
        text += `Round ${i + 1} (${ROUND_LENGTHS[i]} lett.): 🟩 (${roundAttempts[i]} tent.)\n`;
      } else {
        text += `Round ${i + 1} (${ROUND_LENGTHS[i]} lett.): 🟥\n`;
      }
    }

    text += "\nGioca a 5 in 5!";
    return text;
  }

  // --- LISTENERS ---

  function setupEventListeners() {
    btnBackspace.addEventListener("click", handleBackspace);
    btnSubmit.addEventListener("click", handleSubmit);

    btnPause.addEventListener("click", pauseGame);
    btnResume.addEventListener("click", resumeGame);

    btnHelp.addEventListener("click", () => {
      if (isTimerRunning) pauseGame();
      openModal(modalHelp);
    });

    btnAbout.addEventListener("click", () => {
      if (isTimerRunning) pauseGame();
      openModal(modalAbout);
    });

    btnStats.addEventListener("click", () => {
      const stats = getStats();
      document.getElementById("stat-played").textContent = stats.played;
      const winPct = stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0;
      document.getElementById("stat-win-pct").textContent = `${winPct}%`;
      document.getElementById("stat-streak").textContent = stats.currentStreak;
      document.getElementById("stat-best-time").textContent = formatSeconds(stats.bestTimeSeconds);
      if (isTimerRunning) pauseGame();
      openModal(modalStats);
    });

    document.querySelectorAll("[data-close]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const modalId = e.target.getAttribute("data-close");
        const targetModal = document.getElementById(modalId);
        if (targetModal) closeModal(targetModal);
      });
    });

    btnShare.addEventListener("click", async () => {
      const shareText = generateShareText();
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(shareText);
          showToast("Risultato copiato negli appunti! 📋");
        } else {
          const textArea = document.createElement("textarea");
          textArea.value = shareText;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand("copy");
          document.body.removeChild(textArea);
          showToast("Risultato copiato negli appunti! 📋");
        }
      } catch {
        showToast("Impossibile copiare automaticamente.");
      }
    });

    // Supporto tastiera fisica
    window.addEventListener("keydown", (e) => {
      if (isGameOver || isPaused) return;

      if (e.key === "Enter") {
        handleSubmit();
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key === "Escape" || e.key.toLowerCase() === "p") {
        pauseGame();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        const pressedChar = e.key.toUpperCase();
        const selectedIds = new Set(currentSelection.map(item => item.tileId));
        
        let matchingTiles = gridLetters.filter(t => 
          t.letter === pressedChar && 
          !t.isUsed && 
          yellowTileIds.has(t.id) &&
          !selectedIds.has(t.id)
        );

        if (matchingTiles.length === 0) {
          matchingTiles = gridLetters.filter(t => 
            t.letter === pressedChar && 
            !t.isUsed && 
            !selectedIds.has(t.id)
          );
        }

        if (matchingTiles.length > 0) {
          handleTileClick(matchingTiles[0].id);
        }
      }
    });
  }

  // --- UTILITY ---

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 2000);
  }

  function shakeElement(elem) {
    elem.classList.remove("shake");
    void elem.offsetWidth;
    elem.classList.add("shake");
  }

  document.addEventListener("DOMContentLoaded", initGame);
})();