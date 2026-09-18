document.addEventListener("DOMContentLoaded", function () {

  const SERVER_ORIGIN = (window.location.hostname === "127.0.0.1" ? "http://127.0.0.1:3000" : (window.location.port === "3000" ? window.location.origin : "http://localhost:3000"));
  const API = SERVER_ORIGIN + "/api";

  /* ================================================================
     DOM REFERENCES
  ================================================================ */
  var choiceCards       = document.querySelectorAll(".choice-card");
  var resetBtn          = document.getElementById("reset-btn");
  var modal             = document.getElementById("result-modal");
  var resultTitle       = document.getElementById("result-title");
  var resultMessage     = document.getElementById("result-message");
  var nextRoundBtn      = document.getElementById("next-round-btn");
  var blastEffect       = document.getElementById("blast-effect");
  var userScoreSpan     = document.getElementById("user-score");
  var computerScoreSpan = document.getElementById("computer-score");
  var roundDisplay      = document.getElementById("round-display");

  // Game Over Modal
  var gameoverModal     = document.getElementById("gameover-modal");
  var gameoverIcon      = document.getElementById("gameover-icon");
  var gameoverTitle     = document.getElementById("gameover-title");
  var gameoverSub       = document.getElementById("gameover-sub");
  var goPlayerScore     = document.getElementById("go-player-score");
  var goCpuScore        = document.getElementById("go-cpu-score");
  var goPlayerLabel     = document.getElementById("go-player-label");
  var gameoverPlayAgain = document.getElementById("gameover-play-again");

  // Leaderboard Modal
  var leaderboardModal  = document.getElementById("leaderboard-modal");
  var leaderboardList   = document.getElementById("leaderboard-list");
  var leaderboardCloseBtn = document.getElementById("leaderboard-close-btn");
  var navLeaderboard    = document.getElementById("nav-leaderboard");

  /* ================================================================
     GAME STATE & ONLINE MULTIPLAYER (Socket.IO)
  ================================================================ */
  var userChoice         = null;
  var round              = 1;
  var userScore          = 0;
  var computerScore      = 0;
  var CHOICES            = ["Rock", "Paper", "Scissors"];
  var MAX_ROUNDS         = 5;

  var gameMode           = "ai"; // "ai" or "online"
  var currentOnlineRoom  = null;
  var myPlayerId         = null;
  var isPlayer1          = false;
  var opponentName       = "AI BOT (CPU)";
  var onlineChoiceLocked = false;

  var tabModeAi          = document.getElementById("tab-mode-ai");
  var tabModeOnline      = document.getElementById("tab-mode-online");
  var onlineLobbyBar     = document.getElementById("online-lobby-bar");
  var btnQuickMatch      = document.getElementById("btn-quick-match");
  var btnCreateRoom      = document.getElementById("btn-create-room");
  var btnJoinRoom        = document.getElementById("btn-join-room");
  var joinRoomInput      = document.getElementById("join-room-input");
  var lobbyStatusTxt     = document.getElementById("lobby-status-text");
  var btnLeaveRoom       = document.getElementById("btn-leave-room");

  var socket = null;
  if (typeof io !== "undefined") {
    try {
      socket = io(SERVER_ORIGIN);
    } catch(e) {
      console.log("Socket connection deferred:", e);
    }
  }

  /* ================================================================
     HAND CLASH ARENA DOM & STATE
  ================================================================ */
  var HAND_ASSETS = {
    human: {
      0: "src/hands/human-rock.jpg",
      1: "src/hands/human-paper.jpg",
      2: "src/hands/human-scissors.jpg",
      default: "src/hands/human-rock.jpg"
    },
    robot: {
      0: "src/hands/robot-rock.jpg",
      1: "src/hands/robot-paper.jpg",
      2: "src/hands/robot-scissors.jpg",
      default: "src/hands/robot-rock.jpg"
    }
  };

  var playerHandImg        = document.getElementById("player-hand-img");
  var opponentHandImg      = document.getElementById("opponent-hand-img");
  var playerHandFrame      = document.getElementById("player-hand-frame");
  var opponentHandFrame    = document.getElementById("opponent-hand-frame");
  var playerNameTag        = document.getElementById("player-name-tag");
  var opponentNameTag      = document.getElementById("opponent-name-tag");
  var playerGestureBadge   = document.getElementById("player-gesture-badge");
  var opponentGestureBadge = document.getElementById("opponent-gesture-badge");
  var clashStatusBubble    = document.getElementById("clash-status-bubble");
  var weaponBtnGroup       = document.querySelector(".weapon-btn-group");
  var isClashing           = false;

  function lockWeapons() {
    if (weaponBtnGroup) weaponBtnGroup.classList.add("weapons-locked");
    choiceCards.forEach(function(c) { c.setAttribute("disabled", "true"); });
  }

  function unlockWeapons() {
    if (weaponBtnGroup) weaponBtnGroup.classList.remove("weapons-locked");
    choiceCards.forEach(function(c) { c.removeAttribute("disabled"); });
  }

  function syncArenaMode() {
    if (roundDisplay) roundDisplay.textContent = Math.min(round, MAX_ROUNDS);
    if (playerHandFrame) playerHandFrame.className = "hand-frame";
    if (opponentHandFrame) opponentHandFrame.className = "hand-frame";

    // Player (always Human)
    if (playerNameTag) {
      var dName = getMyDisplayName();
      playerNameTag.textContent = (dName && dName !== "PLAYER") ? ("YOU (" + dName.toUpperCase() + ")") : "YOU (PLAYER)";
    }
    if (playerHandImg) {
      playerHandImg.src = HAND_ASSETS.human.default;
      playerHandImg.classList.remove("mirror-hand");
    }
    if (playerGestureBadge) {
      playerGestureBadge.innerHTML = '<span class="gesture-icon">✊</span> <span class="gesture-text">READY</span>';
    }

    if (gameMode === "online") {
      // 1v1 Matching Mode: Both sides are HUMAN HANDS!
      if (opponentNameTag) {
        opponentNameTag.textContent = opponentName || "ONLINE RIVAL";
      }
      if (opponentHandImg) {
        opponentHandImg.src = HAND_ASSETS.human.default;
        opponentHandImg.classList.add("mirror-hand"); // mirrored to face inward
      }
      if (opponentGestureBadge) {
        opponentGestureBadge.innerHTML = '<span class="gesture-icon">✊</span> <span class="gesture-text">READY</span>';
      }
      if (clashStatusBubble) {
        clashStatusBubble.innerHTML = '<i class="fa-solid fa-earth-americas"></i> 1v1 HUMAN MATCH';
      }
    } else {
      // AI Mode: Opponent is ROBOT HAND!
      if (opponentNameTag) {
        opponentNameTag.textContent = "CPU BOT";
      }
      if (opponentHandImg) {
        opponentHandImg.src = HAND_ASSETS.robot.default;
        opponentHandImg.classList.remove("mirror-hand");
      }
      if (opponentGestureBadge) {
        opponentGestureBadge.innerHTML = '<span class="gesture-icon">🦾</span> <span class="gesture-text">READY</span>';
      }
      if (clashStatusBubble) {
        clashStatusBubble.innerHTML = '<i class="fa-solid fa-crosshairs"></i> PICK WEAPON';
      }
    }
  }

  function performHandClash(pChoice, oChoice, isOnline, outcome, callback) {
    if (!playerHandImg || !opponentHandImg) {
      if (callback) callback();
      return;
    }

    isClashing = true;
    if (roundDisplay) roundDisplay.textContent = Math.min(round, MAX_ROUNDS);
    if (clashStatusBubble) {
      clashStatusBubble.innerHTML = '<i class="fa-solid fa-bolt fa-spin"></i> CLASHING...';
    }

    // Reset frame highlights and start shake from idle fists
    playerHandFrame.className = "hand-frame";
    opponentHandFrame.className = "hand-frame";

    playerHandImg.src = HAND_ASSETS.human[0];
    if (isOnline) {
      opponentHandImg.src = HAND_ASSETS.human[0];
      opponentHandImg.classList.add("mirror-hand");
    } else {
      opponentHandImg.src = HAND_ASSETS.robot[0];
      opponentHandImg.classList.remove("mirror-hand");
    }

    if (playerGestureBadge) {
      playerGestureBadge.innerHTML = '<span class="gesture-icon">✊</span> <span class="gesture-text">1... 2... 3...</span>';
    }
    if (opponentGestureBadge) {
      opponentGestureBadge.innerHTML = '<span class="gesture-icon">' + (isOnline ? "✊" : "🦾") + '</span> <span class="gesture-text">1... 2... 3...</span>';
    }

    // Trigger anticipation shake animation
    playerHandImg.classList.add("hand-shaking-left");
    opponentHandImg.classList.add(isOnline ? "hand-shaking-right-mirrored" : "hand-shaking-right");

    // Reveal choices at 220ms
    setTimeout(function () {
      playerHandImg.classList.remove("hand-shaking-left");
      opponentHandImg.classList.remove("hand-shaking-right", "hand-shaking-right-mirrored");

      // Switch to picked gesture images
      playerHandImg.src = HAND_ASSETS.human[pChoice];
      if (isOnline) {
        opponentHandImg.src = HAND_ASSETS.human[oChoice];
        opponentHandImg.classList.add("mirror-hand");
      } else {
        opponentHandImg.src = HAND_ASSETS.robot[oChoice];
        opponentHandImg.classList.remove("mirror-hand");
      }

      var choiceIcons = ["✊", "✋", "✌️"];
      if (playerGestureBadge) {
        playerGestureBadge.innerHTML = '<span class="gesture-icon">' + choiceIcons[pChoice] + '</span> <span class="gesture-text">' + CHOICES[pChoice] + '</span>';
      }
      if (opponentGestureBadge) {
        opponentGestureBadge.innerHTML = '<span class="gesture-icon">' + (isOnline ? choiceIcons[oChoice] : "🦾") + '</span> <span class="gesture-text">' + CHOICES[oChoice] + '</span>';
      }

      // Apply Winner / Loser / Draw aura glows
      if (outcome === "win") {
        playerHandFrame.classList.add("hand-winner");
        opponentHandFrame.classList.add("hand-loser");
        if (clashStatusBubble) clashStatusBubble.innerHTML = '<i class="fa-solid fa-trophy" style="color:#39ff14;"></i> YOU WIN!';
      } else if (outcome === "lose") {
        playerHandFrame.classList.add("hand-loser");
        opponentHandFrame.classList.add("hand-winner");
        if (clashStatusBubble) clashStatusBubble.innerHTML = '<i class="fa-solid fa-skull" style="color:#ff3366;"></i> OPPONENT WINS!';
      } else {
        playerHandFrame.classList.add("hand-draw");
        opponentHandFrame.classList.add("hand-draw");
        if (clashStatusBubble) clashStatusBubble.innerHTML = '<i class="fa-solid fa-handshake" style="color:#ffd700;"></i> ROUND DRAW!';
      }

      setTimeout(function () {
        isClashing = false;
        if (callback) callback();
      }, 180);
    }, 220);
  }

  /* ================================================================
     SCORE & UI HELPERS
  ================================================================ */
  function updateScore() {
    if (userScoreSpan) userScoreSpan.textContent = userScore;
    if (computerScoreSpan) computerScoreSpan.textContent = computerScore;
    if (roundDisplay) roundDisplay.textContent = Math.min(round, MAX_ROUNDS);
  }

  function updateLastResultBar() {}

  function showInlineResult(title, outcome) {
    // outcome: "win", "lose", "draw", "gameover-win", "gameover-lose", "gameover-draw"
    if (!clashStatusBubble) return;
    var icon = "", color = "";
    if (outcome === "win")           { icon = '&#127942;'; color = "#39ff14"; }
    else if (outcome === "lose")     { icon = '&#128128;'; color = "#ff3366"; }
    else if (outcome === "draw")     { icon = '&#129309;'; color = "#ffd700"; }
    else if (outcome === "gameover-win")  { icon = '&#128081;'; color = "#39ff14"; }
    else if (outcome === "gameover-lose") { icon = '&#129302;'; color = "#ff3366"; }
    else if (outcome === "gameover-draw") { icon = '&#129309;'; color = "#ffd700"; }
    clashStatusBubble.innerHTML = '<span style="color:' + color + ';font-size:1.1em">' + icon + '</span> <b style="color:' + color + '">' + title + '</b>';
    clashStatusBubble.style.borderColor = color;
    clashStatusBubble.style.background = 'rgba(0,0,0,0.55)';
  }

  function showModal(title, message, blast) {
    // Legacy: do nothing — results are shown inline
  }

  function hideModal() {
    if (modal) modal.style.display = "none";
  }

  function clearChoiceHighlights() {
    choiceCards.forEach(function (c) {
      c.classList.remove("selected", "computer-pick");
    });
    userChoice = null;
  }

  /* ================================================================
     RESET GAME
  ================================================================ */
  function resetGame(silent) {
    userScore     = 0;
    computerScore = 0;
    round         = 1;
    isClashing    = false;
    updateScore();
    clearChoiceHighlights();
    unlockWeapons();
    syncArenaMode();
    if (nextRoundBtn) nextRoundBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Next Round';
    if (!silent) {
      updateLastResultBar('<i class="fa-solid fa-rotate-right"></i> Game reset! Choose your weapon.', "");
    }
    hideModal();
  }


  if (resetBtn) {
    resetBtn.addEventListener("click", function (e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      resetGame();
    });
  }

  /* ================================================================
     SAVE FULL GAME RESULT TO SERVER
  ================================================================ */
  function saveGameResult(yourScore, cpuScore, outcome) {
    var token = localStorage.getItem("rps_token");
    if (!token) return;
    fetch(API + "/game-result", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body:    JSON.stringify({ yourScore: yourScore, cpuScore: cpuScore, outcome: outcome })
    }).catch(function () {});
  }

  /* ================================================================
     SHOW GAME OVER POPUP
  ================================================================ */
  function showGameOverModal(myScore, cpuScore, outcome) {
    if (!gameoverModal) return;
    var playerName = getMyDisplayName();
    if (goPlayerLabel) goPlayerLabel.textContent = playerName.toUpperCase();
    if (goPlayerScore) goPlayerScore.textContent  = myScore;
    if (goCpuScore)   goCpuScore.textContent      = cpuScore;

    if (outcome === "win") {
      if (gameoverIcon)  gameoverIcon.textContent  = "\uD83C\uDFC6"; // 🏆
      if (gameoverTitle) { gameoverTitle.textContent = "YOU WIN!"; gameoverTitle.style.color = "#39ff14"; }
      if (gameoverSub)   gameoverSub.textContent   = "Champion! You dominated " + cpuScore + " - " + myScore + " rounds in your favour.";
      // blast effect
      var gb = document.getElementById("gameover-blast");
      if (gb) { gb.innerHTML = '<div class="blast"></div>'; setTimeout(function(){ gb.innerHTML = ""; }, 800); }
    } else if (outcome === "lose") {
      if (gameoverIcon)  gameoverIcon.textContent  = "\uD83E\uDD16"; // 🤖
      if (gameoverTitle) { gameoverTitle.textContent = "CPU WINS!"; gameoverTitle.style.color = "#ff3366"; }
      if (gameoverSub)   gameoverSub.textContent   = "CPU dominated this round. Try again!";
    } else {
      if (gameoverIcon)  gameoverIcon.textContent  = "\uD83E\uDD1D"; // 🤝
      if (gameoverTitle) { gameoverTitle.textContent = "IT'S A DRAW!"; gameoverTitle.style.color = "#ffd700"; }
      if (gameoverSub)   gameoverSub.textContent   = "Equal strength! A perfectly balanced match.";
    }
    gameoverModal.style.display = "flex";
  }

  if (gameoverPlayAgain) {
    gameoverPlayAgain.addEventListener("click", function () {
      if (gameoverModal) gameoverModal.style.display = "none";
      resetGame(true);
    });
  }
  if (gameoverModal) {
    gameoverModal.addEventListener("click", function (e) {
      if (e.target === gameoverModal) { gameoverModal.style.display = "none"; resetGame(true); }
    });
  }

  /* ================================================================
     SAVE HISTORY TO MONGODB (if logged in)
  ================================================================ */
  function saveHistoryToServer(entry) {
    var token = localStorage.getItem("rps_token");
    if (!token) return;  // Guest — don't save
    fetch(API + "/history", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify(entry)
    }).catch(function () { /* silent fail */ });
  }

  /* ================================================================
     CORE GAME LOGIC
  ================================================================ */
  function playRound() {
    var computerChoice = Math.floor(Math.random() * 3);

    choiceCards.forEach(function (c) { c.classList.remove("computer-pick"); });
    choiceCards[computerChoice].classList.add("computer-pick");

    var result  = "";
    var barType = "";
    var barText = "";

    if (userChoice === computerChoice) {
      result  = "Draw!";
      barType = "bar-draw";
      barText = '<i class="fa-solid fa-handshake"></i> Round ' + round + ': Draw! Both chose ' + CHOICES[userChoice];
    } else if (
      (userChoice === 0 && computerChoice === 2) ||
      (userChoice === 1 && computerChoice === 0) ||
      (userChoice === 2 && computerChoice === 1)
    ) {
      result  = "You Win!";
      barType = "bar-win";
      barText = '<i class="fa-solid fa-trophy"></i> Round ' + round + ': You Win! ' + CHOICES[userChoice] + ' beat ' + CHOICES[computerChoice];
      userScore++;
    } else {
      result  = "AI Wins!";
      barType = "bar-lose";
      barText = '<i class="fa-solid fa-robot"></i> Round ' + round + ': AI Wins! ' + CHOICES[computerChoice] + ' beat ' + CHOICES[userChoice];
      computerScore++;
    }

    var roundEntry = {
      round:  round,
      you:    CHOICES[userChoice],
      cpu:    CHOICES[computerChoice],
      result: result
    };

    saveHistoryToServer(roundEntry);

    var outcome = (userChoice === computerChoice) ? "draw" : (result === "You Win!" ? "win" : "lose");
    updateScore();

    performHandClash(userChoice, computerChoice, false, outcome, function () {
      updateLastResultBar(barText, barType);

      round++;
      var isGameOver = (round > MAX_ROUNDS);

      if (isGameOver) {
        var finalOutcome;
        if (userScore > computerScore)       finalOutcome = "win";
        else if (userScore < computerScore)  finalOutcome = "lose";
        else                                 finalOutcome = "draw";

        // Save game result to server
        saveGameResult(userScore, computerScore, finalOutcome);

        // Show in VS bubble briefly
        var bubbleTitle = finalOutcome === "win" ? "CHAMPION! " + userScore + ":" + computerScore
                        : finalOutcome === "lose" ? "CPU WINS! " + userScore + ":" + computerScore
                        : "DRAW! " + userScore + ":" + computerScore;
        isClashing = true;
        showInlineResult(bubbleTitle, "gameover-" + finalOutcome);

        // Show game over popup after short delay
        setTimeout(function () {
          isClashing = false;
          showGameOverModal(userScore, computerScore, finalOutcome);
        }, 800);

      } else {
        isClashing = true;
        showInlineResult(result, outcome);
        setTimeout(function () {
          clearChoiceHighlights();
          updateScore();
          syncArenaMode();
          isClashing = false;
          unlockWeapons();
        }, 1500);
      }
    });
  }

  /* ================================================================
     ONLINE MULTIPLAYER LOGIC & SOCKET LISTENERS
  ================================================================ */
  function getMyDisplayName() {
    if (currentUser && (currentUser.username || currentUser.name)) {
      return currentUser.username || currentUser.name;
    }
    var storedUser = localStorage.getItem("rps_user") || sessionStorage.getItem("rps_session");
    if (storedUser) {
      try {
        var parsed = JSON.parse(storedUser);
        return parsed.username || parsed.name || "PLAYER";
      } catch(e) {}
    }
    return "PLAYER";
  }

  if (tabModeAi && tabModeOnline) {
    tabModeAi.addEventListener("click", function () {
      gameMode = "ai";
      tabModeAi.classList.add("active");
      tabModeOnline.classList.remove("active");
      if (onlineLobbyBar) onlineLobbyBar.classList.add("hidden");
      if (currentOnlineRoom && socket) socket.emit("leave-room");
      currentOnlineRoom = null;
      var cpuLabel = document.querySelector(".score-box-cpu .score-label");
      var cpuTag   = document.querySelector(".score-box-cpu .score-tag");
      if (cpuLabel) cpuLabel.innerHTML = '<i class="fa-solid fa-robot"></i> AI BOT (CPU)';
      if (cpuTag)   cpuTag.innerHTML   = '<i class="fa-solid fa-microchip"></i> OPPONENT';
      resetGame(true);
      syncArenaMode();
    });

    tabModeOnline.addEventListener("click", function () {
      gameMode = "online";
      tabModeOnline.classList.add("active");
      tabModeAi.classList.remove("active");
      if (onlineLobbyBar) onlineLobbyBar.classList.remove("hidden");
      resetGame(true);
      syncArenaMode();
      var cpuLabel = document.querySelector(".score-box-cpu .score-label");
      var cpuTag   = document.querySelector(".score-box-cpu .score-tag");
      if (cpuLabel) cpuLabel.innerHTML = '<i class="fa-solid fa-earth-americas"></i> ONLINE RIVAL';
      if (cpuTag)   cpuTag.innerHTML   = '<i class="fa-solid fa-signal"></i> 1v1 LIVE';
    });
  }

  if (btnQuickMatch) {
    btnQuickMatch.addEventListener("click", function () {
      if (!socket) return alert("Multiplayer server is connecting... Please ensure the server is running!");
      lobbyStatusTxt.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Searching for an online challenger...';
      socket.emit("quick-match", { username: getMyDisplayName() });
    });
  }

  if (btnCreateRoom) {
    btnCreateRoom.addEventListener("click", function () {
      if (!socket) return alert("Multiplayer server is connecting...");
      lobbyStatusTxt.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating custom arena room...';
      socket.emit("create-room", { username: getMyDisplayName() });
    });
  }

  if (btnJoinRoom) {
    btnJoinRoom.addEventListener("click", function () {
      if (!socket) return alert("Multiplayer server is connecting...");
      var code = (joinRoomInput ? joinRoomInput.value : "").trim();
      if (!code) return alert("Please enter a room code!");
      lobbyStatusTxt.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Joining room ' + code + '...';
      socket.emit("join-room", { roomId: code, username: getMyDisplayName() });
    });
  }

  if (btnLeaveRoom) {
    btnLeaveRoom.addEventListener("click", function () {
      if (socket) socket.emit("leave-room");
      currentOnlineRoom = null;
      btnLeaveRoom.classList.add("hidden");
      lobbyStatusTxt.textContent = "Left room. Click Quick Match or Create Room to play.";
      resetGame();
    });
  }

  if (socket) {
    socket.on("waiting-match", function (data) {
      lobbyStatusTxt.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + data.message;
    });

    socket.on("room-created", function (data) {
      currentOnlineRoom = data.roomId;
      btnLeaveRoom.classList.remove("hidden");
      lobbyStatusTxt.innerHTML = 'Room <b>' + data.roomId + '</b> created! Share this code with a friend. Waiting for challenger...';
      updateLastResultBar('Waiting for friend to join room ' + data.roomId, "bar-draw");
    });

    socket.on("join-error", function (data) {
      alert(data.message);
      lobbyStatusTxt.textContent = data.message;
    });

    socket.on("match-start", function (data) {
      currentOnlineRoom = data.roomId;
      myPlayerId = socket.id;
      isPlayer1 = (data.player1.id === socket.id);
      opponentName = isPlayer1 ? data.player2.name : data.player1.name;

      btnLeaveRoom.classList.remove("hidden");
      lobbyStatusTxt.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#39ff14;"></i> <b>MATCH ACTIVE!</b> Fighting against <b>' + opponentName + '</b> in room ' + data.roomId;

      var cpuLabel = document.querySelector(".score-box-cpu .score-label");
      var youLabel = document.querySelector(".score-box-you .score-label");
      if (cpuLabel) cpuLabel.innerHTML = '<i class="fa-solid fa-user-astronaut"></i> ' + opponentName;
      if (youLabel) youLabel.innerHTML = '<i class="fa-solid fa-user-ninja"></i> YOU (' + (isPlayer1 ? data.player1.name : data.player2.name) + ')';

      userScore = 0;
      computerScore = 0;
      round = data.round || 1;
      updateScore();
      clearChoiceHighlights();
      syncArenaMode();
      onlineChoiceLocked = false;
      updateLastResultBar('<i class="fa-solid fa-swords"></i> Connected! Both players make your choice!', "bar-win");
    });

    socket.on("opponent-moved", function () {
      if (onlineChoiceLocked) {
        updateLastResultBar('<i class="fa-solid fa-bolt"></i> Opponent has made their pick! Clash calculating...', "bar-draw");
      } else {
        updateLastResultBar('<i class="fa-solid fa-bell"></i> Opponent is ready! Make your choice now!', "bar-draw");
      }
    });

    socket.on("round-result", function (data) {
      onlineChoiceLocked = false;
      var myData  = isPlayer1 ? data.player1 : data.player2;
      var oppData = isPlayer1 ? data.player2 : data.player1;

      userScore     = myData.score;
      computerScore = oppData.score;
      updateScore();

      choiceCards.forEach(function (c) { c.classList.remove("selected", "computer-pick"); });
      if (choiceCards[myData.choice])  choiceCards[myData.choice].classList.add("selected");
      if (choiceCards[oppData.choice]) choiceCards[oppData.choice].classList.add("computer-pick");

      var outcome = "draw";
      var title   = "Round " + data.round + ": Draw!";
      var barType = "bar-draw";

      if (data.winnerCode === "draw") {
        outcome = "draw";
        title = "Round Stalemate!";
        updateLastResultBar('<i class="fa-solid fa-handshake"></i> Round ' + data.round + ': Draw! Both chose ' + myData.choiceName, "bar-draw");
      } else if ((isPlayer1 && data.winnerCode === "player1") || (!isPlayer1 && data.winnerCode === "player2")) {
        outcome = "win";
        title = "You Win Round " + data.round + "!";
        barType = "bar-win";
        updateLastResultBar('<i class="fa-solid fa-trophy"></i> Round ' + data.round + ': You Win! ' + myData.choiceName + ' beat ' + oppData.choiceName, "bar-win");
      } else {
        outcome = "lose";
        title = opponentName + " Wins Round " + data.round + "!";
        barType = "bar-lose";
        updateLastResultBar('<i class="fa-solid fa-skull"></i> Round ' + data.round + ': ' + opponentName + ' Won with ' + oppData.choiceName, "bar-lose");
      }

      // Both players use Human Hands in online matching!
      performHandClash(myData.choice, oppData.choice, true, outcome, function () {
        updateScore();

        var modalHtml =
          "<b>Round:</b> " + data.round + " / " + data.maxRounds + "<br>" +
          "<b>Your Choice:</b> " + myData.choiceName + "<br>" +
          "<b>" + opponentName + "'s Choice:</b> " + oppData.choiceName + "<br>" +
          "<hr style='border-color:#ffffff44;margin:10px 0;'>" +
          "<b>Series Score:</b> You <b>" + userScore + "</b> : <b>" + computerScore + "</b> " + opponentName;

        if (data.isGameOver) {
          var finalMsg = modalHtml + "<br><br>";
          if (userScore > computerScore) {
            finalMsg += "<b class='win-text'><i class='fa-solid fa-crown'></i> YOU ARE THE MATCH CHAMPION!</b>";
          } else if (userScore < computerScore) {
            finalMsg += "<b class='lose-text'><i class='fa-solid fa-skull'></i> " + opponentName + " wins the series!</b>";
          } else {
            finalMsg += "<b><i class='fa-solid fa-handshake'></i> Series ended in a draw!</b>";
          }
          showModal("Game Over", finalMsg, userScore > computerScore);
          nextRoundBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Rematch';
          nextRoundBtn.onclick = function () {
            socket.emit("rematch-request", { roomId: currentOnlineRoom });
            hideModal();
          };
        } else {
          showModal(title, modalHtml, outcome === "win");
          nextRoundBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Next Round';
          nextRoundBtn.onclick = function () {
            socket.emit("next-round", { roomId: currentOnlineRoom });
            hideModal();
          };
        }
      });
    });

    socket.on("round-ready", function (data) {
      round = data.round;
      if (roundDisplay) roundDisplay.textContent = round;
      clearChoiceHighlights();
      onlineChoiceLocked = false;
      syncArenaMode();
      hideModal();
      updateLastResultBar('<i class="fa-solid fa-swords"></i> Round ' + round + ' started! Make your choice!', "bar-win");
    });

    socket.on("opponent-left", function (data) {
      alert(data.message || "Opponent disconnected.");
      lobbyStatusTxt.textContent = "Opponent disconnected. Click Quick Match or Create Room to play again.";
      currentOnlineRoom = null;
      btnLeaveRoom.classList.add("hidden");
      resetGame();
    });
  }

  function playOnlineRound(choice) {
    if (!currentOnlineRoom) return;
    if (onlineChoiceLocked) return;
    onlineChoiceLocked = true;
    updateLastResultBar('<i class="fa-solid fa-lock"></i> Locked in ' + CHOICES[choice] + '! Waiting for ' + opponentName + '...', "bar-draw");
    socket.emit("make-choice", { roomId: currentOnlineRoom, choice: choice });
  }

  /* ================================================================
     CARD CLICK
  ================================================================ */
  choiceCards.forEach(function (card) {
    card.addEventListener("click", function () {
      if (isClashing) return;
      if (gameMode === "online" && !currentOnlineRoom) {
        alert("Please find an opponent with Quick Match or join a Room first!");
        return;
      }
      if (gameMode === "online" && onlineChoiceLocked) {
        return;
      }
      choiceCards.forEach(function (c) {
        c.classList.remove("selected", "computer-pick");
      });
      card.classList.add("selected");
      userChoice = parseInt(card.dataset.choice, 10);

      // Lock buttons immediately while processing
      lockWeapons();

      if (gameMode === "online") {
        playOnlineRound(userChoice);
      } else {
        playRound();
      }
    });
  });


  /* ================================================================
     SMOOTH SCROLL
  ================================================================ */
  var gameRulesLink = document.querySelector('.nav-links a[href="#game-rule-section"]');
  var gameRuleDiv   = document.getElementById("game-rule-section");
  if (gameRulesLink && gameRuleDiv) {
    gameRulesLink.addEventListener("click", function (e) {
      e.preventDefault();
      gameRuleDiv.scrollIntoView({ behavior: "smooth" });
    });
  }

  var gameNavLink = document.querySelector('.nav-links a[href="#game-section"]');
  var gameSection = document.getElementById("game-section");
  if (gameNavLink && gameSection) {
    gameNavLink.addEventListener("click", function (e) {
      e.preventDefault();
      gameSection.scrollIntoView({ behavior: "smooth" });
    });
  }

  /* ================================================================
     CLOSE MODAL: click outside
  ================================================================ */
  if (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === modal) hideModal();
    });
  }

  /* ================================================================
     HAMBURGER MENU
  ================================================================ */
  var hamburgerBtn = document.getElementById("hamburger-btn");
  var navLinks     = document.getElementById("nav-links");
  if (hamburgerBtn && navLinks) {
    hamburgerBtn.addEventListener("click", function () {
      navLinks.classList.toggle("open");
      hamburgerBtn.classList.toggle("active");
    });

    navLinks.querySelectorAll(".nav-link").forEach(function(link) {
      link.addEventListener("click", function() {
        navLinks.classList.remove("open");
        hamburgerBtn.classList.remove("active");
      });
    });
  }

  /* ================================================================
     AUTH STATE — Read from URL param or localStorage (set by auth.html)
  ================================================================ */
  var btnLogin        = document.getElementById("btn-login");
  var btnSignup       = document.getElementById("btn-signup");
  var btnLogout       = document.getElementById("btn-logout");
  var welcomeMsg      = document.getElementById("welcome-msg");
  var usernameDisplay = document.getElementById("username-display");
  var navHistory      = document.getElementById("nav-history");

  var isLoggedIn  = false;
  var currentUser = null;

  function applyAuthState(userData) {
    if (!userData) return;
    isLoggedIn  = true;
    currentUser = userData;

    var displayName = userData.username || userData.name || "Player";

    if (welcomeMsg) welcomeMsg.classList.remove("hidden");
    if (usernameDisplay) usernameDisplay.textContent = displayName;
    if (btnLogin) btnLogin.classList.add("hidden");
    if (btnSignup) btnSignup.classList.add("hidden");
    if (btnLogout) btnLogout.classList.remove("hidden");
    if (navHistory) navHistory.classList.remove("hidden");

    // Update Player Tag in the Clash Arena HUD!
    if (playerNameTag) {
      playerNameTag.textContent = "YOU (" + displayName.toUpperCase() + ")";
    }
  }

  function clearAuthState() {
    isLoggedIn  = false;
    currentUser = null;

    try {
      localStorage.removeItem("rps_token");
      localStorage.removeItem("rps_user");
      sessionStorage.removeItem("rps_session");
    } catch(e) {}

    if (welcomeMsg) welcomeMsg.classList.add("hidden");
    if (btnLogin) btnLogin.classList.remove("hidden");
    if (btnSignup) btnSignup.classList.remove("hidden");
    if (btnLogout) btnLogout.classList.add("hidden");
    if (navHistory) navHistory.classList.add("hidden");

    if (playerNameTag) playerNameTag.textContent = "YOU (PLAYER)";
  }

  // Check if already logged in (URL query param or localStorage / sessionStorage)
  (function initAuth() {
    // 1. Check URL redirect params from auth.html?login_success=1&user=...
    try {
      var urlParams = new URLSearchParams(window.location.search);
      var userParam = urlParams.get("user");
      var loginSuccess = urlParams.get("login_success");
      if (userParam && userParam.trim()) {
        var cleanUser = userParam.trim();
        var authUser = { username: cleanUser, name: cleanUser };
        localStorage.setItem("rps_user", JSON.stringify(authUser));
        sessionStorage.setItem("rps_session", JSON.stringify(authUser));
        applyAuthState(authUser);
        if (loginSuccess) {
          setTimeout(function() {
            showToast("Welcome back, " + cleanUser + "!");
          }, 350);
        }
        if (window.history && window.history.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        syncArenaMode();
        return;
      }
    } catch (e) {
      console.warn("URL auth parsing skipped:", e);
    }

    // 2. Check localStorage / sessionStorage
    var userJson = null;
    try {
      userJson = localStorage.getItem("rps_user") || sessionStorage.getItem("rps_session");
    } catch(e) {}

    if (userJson) {
      try {
        var user = JSON.parse(userJson);
        applyAuthState(user);
      } catch (e) {
        clearAuthState();
      }
    } else {
      clearAuthState();
    }
    syncArenaMode();
  })();

  // Login → redirect to auth.html
  if (btnLogin)  btnLogin.addEventListener("click",  function () { window.location.href = "auth.html"; });
  if (btnSignup) btnSignup.addEventListener("click",  function () { window.location.href = "auth.html?tab=signup"; });

  // Logout
  if (btnLogout) {
    btnLogout.addEventListener("click", function () {
      if (confirm("Logout karna chahte hain?")) {
        clearAuthState();
        showToast("Logged out successfully!");
      }
    });
  }

  /* ================================================================
     TOAST NOTIFICATION
  ================================================================ */
  function showToast(msg, type) {
    var existing = document.getElementById("rps-toast");
    if (existing) {
      if (typeof existing.remove === "function") {
        existing.remove();
      } else if (existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }
    }

    var toast = document.createElement("div");
    toast.id = "rps-toast";
    toast.className = "rps-toast" + (type === "error" ? " toast-error" : "");
    toast.innerHTML = (type === "error"
      ? '<i class="fa-solid fa-circle-exclamation"></i> '
      : '<i class="fa-solid fa-circle-check"></i> ') + msg;
    if (document.body && typeof document.body.appendChild === "function") {
      document.body.appendChild(toast);
    }

    setTimeout(function () {
      if (toast && toast.classList) toast.classList.add("show");
    }, 10);
    setTimeout(function () {
      if (toast && toast.classList) toast.classList.remove("show");
      setTimeout(function () {
        if (toast) {
          if (typeof toast.remove === "function") toast.remove();
          else if (toast.parentNode) toast.parentNode.removeChild(toast);
        }
      }, 400);
    }, 3200);
  }

  /* ================================================================
     HISTORY MODAL — Game Summaries from /api/game-history
  ================================================================ */
  var historyModal    = document.getElementById("history-modal");
  var historyList     = document.getElementById("history-list");
  var historyCloseBtn = document.getElementById("history-close-btn");
  var clearHistoryBtn = document.getElementById("history-clear-btn");

  if (navHistory) {
    navHistory.addEventListener("click", function (e) {
      e.preventDefault();
      if (!isLoggedIn) { window.location.href = "auth.html"; return; }

      historyList.innerHTML = "<p style='text-align:center;padding:30px;color:#888;'><i class='fa-solid fa-spinner fa-spin' style='font-size:1.4rem;margin-bottom:10px;display:block;'></i> Loading history...</p>";
      historyModal.style.display = "flex";

      var token = localStorage.getItem("rps_token");
      fetch(API + "/game-history", { headers: { "Authorization": "Bearer " + token } })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data.success || !data.history || data.history.length === 0) {
            historyList.innerHTML = "<div style='text-align:center;color:#aaa;padding:30px;'><i class='fa-solid fa-inbox' style='font-size:2rem;display:block;margin-bottom:10px;color:#444;'></i>No completed games yet!<br><span style='font-size:0.8rem;'>Finish a 5-round match to see your game history here.</span></div>";
            return;
          }
          var html = "<div class='game-history-list'>";
          data.history.forEach(function (g, idx) {
            var isWin  = g.outcome === "win";
            var isLose = g.outcome === "lose";
            var cls    = isWin ? "ghist-win" : (isLose ? "ghist-lose" : "ghist-draw");
            var icon   = isWin ? "fa-trophy" : (isLose ? "fa-robot" : "fa-handshake");
            var label  = isWin ? "YOU WON" : (isLose ? "CPU WON" : "DRAW");
            var margin = isWin ? (g.yourScore - g.cpuScore) : (isLose ? (g.cpuScore - g.yourScore) : 0);
            var dateStr = g.playedAt ? new Date(g.playedAt).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "";
            html += "<div class='ghist-row " + cls + "'>" +
              "<div class='ghist-outcome'><i class='fa-solid " + icon + "'></i> " + label + "</div>" +
              "<div class='ghist-score'>" + g.yourScore + " — " + g.cpuScore + "</div>" +
              "<div class='ghist-margin'>" + (margin > 0 ? "+" + margin + " pts" : "Equal") + "</div>" +
              "<div class='ghist-date'>" + dateStr + "</div>" +
            "</div>";
          });
          html += "</div>";
          historyList.innerHTML = html;
        })
        .catch(function () {
          historyList.innerHTML = "<p style='text-align:center;color:#ff6688;padding:20px;'><i class='fa-solid fa-triangle-exclamation'></i> Could not load history. Is the server running?</p>";
        });
    });
  }

  if (historyCloseBtn) {
    historyCloseBtn.addEventListener("click", function () { historyModal.style.display = "none"; });
  }
  historyModal && historyModal.addEventListener("click", function (e) {
    if (e.target === historyModal) historyModal.style.display = "none";
  });

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", function () {
      if (!isLoggedIn) return;
      if (!confirm("Apni poori game history delete karna chahte hain?")) return;
      var token = localStorage.getItem("rps_token");
      fetch(API + "/history", { method: "DELETE", headers: { "Authorization": "Bearer " + token } })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.success) {
            historyList.innerHTML = "<p style='text-align:center;color:#aaa;padding:20px;'><i class='fa-solid fa-trash'></i> History cleared!</p>";
            showToast("History cleared!");
          }
        })
        .catch(function () { showToast("Server error!", "error"); });
    });
  }

  /* ================================================================
     LEADERBOARD MODAL
  ================================================================ */
  if (navLeaderboard) {
    navLeaderboard.addEventListener("click", function (e) {
      e.preventDefault();
      leaderboardList.innerHTML = "<p style='text-align:center;padding:30px;color:#888;'><i class='fa-solid fa-spinner fa-spin' style='font-size:1.4rem;margin-bottom:10px;display:block;'></i> Loading leaderboard...</p>";
      leaderboardModal.style.display = "flex";

      fetch(API + "/leaderboard")
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data.success || !data.leaderboard || data.leaderboard.length === 0) {
            leaderboardList.innerHTML = "<p style='text-align:center;color:#aaa;padding:30px;'>No players yet! Be the first to complete a game.</p>";
            return;
          }
          var myUsername = currentUser ? (currentUser.username || "") : "";
          var html = "<div class='lb-table-wrap'><table class='lb-table'><thead><tr><th>#</th><th>Player</th><th><i class='fa-solid fa-trophy'></i> Wins</th><th>Played</th><th>Win%</th></tr></thead><tbody>";
          data.leaderboard.forEach(function (p, i) {
            var rank = i + 1;
            var pct  = p.gamesPlayed > 0 ? Math.round((p.wins / p.gamesPlayed) * 100) : 0;
            var isMe = (p.username === myUsername);
            var rankIcon = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank;
            html += "<tr class='" + (isMe ? "lb-me" : "") + "'>" +
              "<td class='lb-rank'>" + rankIcon + "</td>" +
              "<td class='lb-name'>" + (isMe ? "<b>" : "") + p.username + (isMe ? " ⟵ You</b>" : "") + "</td>" +
              "<td class='lb-wins'>" + (p.wins || 0) + "</td>" +
              "<td class='lb-played'>" + (p.gamesPlayed || 0) + "</td>" +
              "<td class='lb-pct'>" + pct + "%</td>" +
            "</tr>";
          });
          html += "</tbody></table></div>";
          leaderboardList.innerHTML = html;
        })
        .catch(function () {
          leaderboardList.innerHTML = "<p style='text-align:center;color:#ff6688;padding:20px;'>Could not load leaderboard.</p>";
        });
    });
  }

  if (leaderboardCloseBtn) {
    leaderboardCloseBtn.addEventListener("click", function () { leaderboardModal.style.display = "none"; });
  }
  leaderboardModal && leaderboardModal.addEventListener("click", function (e) {
    if (e.target === leaderboardModal) leaderboardModal.style.display = "none";
  });

  // Close mobile menu on clicking any nav link & update active class
  document.querySelectorAll(".nav-link").forEach(function (link) {
    link.addEventListener("click", function () {
      if (navLinks) navLinks.classList.remove("open");
      document.querySelectorAll(".nav-link").forEach(function (l) { l.classList.remove("active"); });
      link.classList.add("active");
    });
  });


  /* ================================================================
     CONTACT SECTION — COPY EMAIL
  ================================================================ */
  var copyEmailBtn = document.getElementById("copy-email-btn");
  if (copyEmailBtn) {
    copyEmailBtn.addEventListener("click", function () {
      var email = "gk5376604@gmail.com";
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(email).then(function () {
          showToast("Email copied: " + email, "success");
        }).catch(function () {
          showToast("Email: " + email, "success");
        });
      } else {
        var tempInput = document.createElement("input");
        tempInput.value = email;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand("copy");
        document.body.removeChild(tempInput);
        showToast("Email copied: " + email, "success");
      }
    });
  }

  // Initial sync of arena mode
  syncArenaMode();

});
