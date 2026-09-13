document.addEventListener("DOMContentLoaded", function () {

  const API = "http://localhost:3000/api";

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
  var lastResultBar     = document.getElementById("last-result-bar");
  var lastResultText    = document.getElementById("last-result-text");

  /* ================================================================
     GAME STATE
  ================================================================ */
  var userChoice    = null;
  var round         = 1;
  var userScore     = 0;
  var computerScore = 0;
  var CHOICES       = ["Rock", "Paper", "Scissors"];
  var MAX_ROUNDS    = 5;

  /* ================================================================
     SCORE & UI HELPERS
  ================================================================ */
  function updateScore() {
    userScoreSpan.textContent     = userScore;
    computerScoreSpan.textContent = computerScore;
    if (roundDisplay) roundDisplay.textContent = Math.min(round, MAX_ROUNDS);
  }

  function updateLastResultBar(text, type) {
    lastResultText.innerHTML = text;
    lastResultBar.className  = "last-result-bar " + (type || "");
  }

  function showModal(title, message, blast) {
    resultTitle.textContent = title;
    resultMessage.innerHTML = message;
    modal.style.display     = "flex";
    if (blast) {
      blastEffect.innerHTML = '<div class="blast"></div>';
      setTimeout(function () { blastEffect.innerHTML = ""; }, 800);
    }
  }

  function hideModal() { modal.style.display = "none"; }

  function clearChoiceHighlights() {
    choiceCards.forEach(function (c) {
      c.classList.remove("selected", "computer-pick");
    });
    userChoice = null;
  }

  /* ================================================================
     RESET GAME
  ================================================================ */
  function resetGame() {
    userScore     = 0;
    computerScore = 0;
    round         = 1;
    updateScore();
    clearChoiceHighlights();
    nextRoundBtn.innerHTML   = '<i class="fa-solid fa-arrow-right"></i> Next Round';
    updateLastResultBar('<i class="fa-solid fa-rotate-right"></i> Game reset! Choose your weapon.', "");
    hideModal();
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      if (confirm("Reset the game? All scores will be cleared!")) {
        resetGame();
      }
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
    var blast   = false;
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
      blast   = true;
      barType = "bar-win";
      barText = '<i class="fa-solid fa-trophy"></i> Round ' + round + ': You Win! ' + CHOICES[userChoice] + ' beat ' + CHOICES[computerChoice];
      userScore++;
    } else {
      result  = "Computer Wins!";
      barType = "bar-lose";
      barText = '<i class="fa-solid fa-robot"></i> Round ' + round + ': Computer Wins! ' + CHOICES[computerChoice] + ' beat ' + CHOICES[userChoice];
      computerScore++;
    }

    var roundEntry = {
      round:  round,
      you:    CHOICES[userChoice],
      cpu:    CHOICES[computerChoice],
      result: result
    };

    // Save to MongoDB if logged in
    saveHistoryToServer(roundEntry);

    updateScore();
    updateLastResultBar(barText, barType);

    var msg =
      "<b>Round:</b> " + round + " / " + MAX_ROUNDS + "<br>" +
      "<b>Your Choice:</b> " + CHOICES[userChoice] + "<br>" +
      "<b>Computer Choice:</b> " + CHOICES[computerChoice] + "<br>" +
      "<hr style='border-color:#ffffff44;margin:10px 0;'>" +
      "<b>Result:</b> <span class='result-highlight'>" + result + "</span><br>" +
      "<b>Score:</b> You <b>" + userScore + "</b> : <b>" + computerScore + "</b> CPU";

    showModal(result, msg, blast);

    nextRoundBtn.onclick = function () {
      clearChoiceHighlights();
      round++;

      if (round > MAX_ROUNDS) {
        var finalMsg =
          "<b>Game Over!</b><br>" +
          "<b>Final Score:</b> You <b>" + userScore + "</b> : <b>" + computerScore + "</b> CPU<br><br>";

        if (userScore > computerScore) {
          finalMsg += "<b class='win-text'><i class='fa-solid fa-trophy'></i> You are the Champion!</b>";
          updateLastResultBar('<i class="fa-solid fa-crown"></i> GAME OVER: You are the Champion! ' + userScore + " - " + computerScore, "bar-win");
        } else if (userScore < computerScore) {
          finalMsg += "<b class='lose-text'><i class='fa-solid fa-robot'></i> Computer Wins! Try again!</b>";
          updateLastResultBar('<i class="fa-solid fa-robot"></i> GAME OVER: Computer Wins! ' + userScore + " - " + computerScore, "bar-lose");
        } else {
          finalMsg += "<b><i class='fa-solid fa-handshake'></i> Overall Draw!</b>";
          updateLastResultBar('<i class="fa-solid fa-handshake"></i> GAME OVER: Overall Draw! ' + userScore + " - " + computerScore, "bar-draw");
        }

        showModal("Game Over", finalMsg, false);
        nextRoundBtn.innerHTML  = '<i class="fa-solid fa-rotate-right"></i> Play Again';
        nextRoundBtn.onclick    = function () { resetGame(); };
      } else {
        updateScore();
        hideModal();
      }
    };
  }

  /* ================================================================
     CARD CLICK
  ================================================================ */
  choiceCards.forEach(function (card) {
    card.addEventListener("click", function () {
      choiceCards.forEach(function (c) {
        c.classList.remove("selected", "computer-pick");
      });
      card.classList.add("selected");
      userChoice = parseInt(card.dataset.choice, 10);
      playRound();
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
  modal.addEventListener("click", function (e) {
    if (e.target === modal) hideModal();
  });

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
  }

  /* ================================================================
     AUTH STATE — Read from localStorage (set by auth.html)
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
    isLoggedIn  = true;
    currentUser = userData;

    welcomeMsg.classList.remove("hidden");
    usernameDisplay.textContent = userData.name || userData.username;
    btnLogin.classList.add("hidden");
    btnSignup.classList.add("hidden");
    btnLogout.classList.remove("hidden");
    navHistory.classList.remove("hidden");

    if (guestNotice) guestNotice.classList.add("hidden");
  }

  function clearAuthState() {
    isLoggedIn  = false;
    currentUser = null;

    localStorage.removeItem("rps_token");
    localStorage.removeItem("rps_user");

    welcomeMsg.classList.add("hidden");
    btnLogin.classList.remove("hidden");
    btnSignup.classList.remove("hidden");
    btnLogout.classList.add("hidden");
    navHistory.classList.add("hidden");

    if (guestNotice) guestNotice.classList.remove("hidden");
  }

  // Check if already logged in (token in localStorage)
  (function initAuth() {
    var token    = localStorage.getItem("rps_token");
    var userJson = localStorage.getItem("rps_user");
    if (token && userJson) {
      try {
        var user = JSON.parse(userJson);
        applyAuthState(user);
      } catch (e) {
        clearAuthState();
      }
    }
  })();

  // Login → redirect to auth.html
  if (btnLogin)  btnLogin.addEventListener("click",  function () { window.location.href = "auth.html"; });
  if (btnSignup) btnSignup.addEventListener("click",  function () { window.location.href = "auth.html?tab=signup"; });

  // Guest notice btn → redirect to auth.html
  if (noticeLoginBtn) noticeLoginBtn.addEventListener("click", function () {
    window.location.href = "auth.html";
  });

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
    if (existing) existing.remove();

    var toast = document.createElement("div");
    toast.id = "rps-toast";
    toast.className = "rps-toast" + (type === "error" ? " toast-error" : "");
    toast.innerHTML = (type === "error"
      ? '<i class="fa-solid fa-circle-exclamation"></i> '
      : '<i class="fa-solid fa-circle-check"></i> ') + msg;
    document.body.appendChild(toast);

    setTimeout(function () { toast.classList.add("show"); }, 10);
    setTimeout(function () {
      toast.classList.remove("show");
      setTimeout(function () { toast.remove(); }, 400);
    }, 3200);
  }

  /* ================================================================
     HISTORY MODAL — fetch from MongoDB
  ================================================================ */
  var historyModal    = document.getElementById("history-modal");
  var historyList     = document.getElementById("history-list");
  var historyCloseBtn = document.getElementById("history-close-btn");
  var clearHistoryBtn = document.getElementById("history-clear-btn");

  if (navHistory) {
    navHistory.addEventListener("click", function (e) {
      e.preventDefault();
      if (!isLoggedIn) {
        window.location.href = "auth.html";
        return;
      }

      // Show loading
      historyList.innerHTML = "<p style='text-align:center;padding:30px;color:#888;'><i class='fa-solid fa-spinner fa-spin' style='font-size:1.4rem;margin-bottom:10px;display:block;'></i> Loading history...</p>";
      historyModal.style.display = "flex";

      var token = localStorage.getItem("rps_token");
      fetch(API + "/history", {
        headers: { "Authorization": "Bearer " + token }
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data.success || data.history.length === 0) {
            historyList.innerHTML = "<p style='text-align:center;color:#aaa;padding:30px;'><i class='fa-solid fa-inbox' style='font-size:2rem;display:block;margin-bottom:10px;color:#444;'></i>No game history yet!<br><span style='font-size:0.8rem;'>Play some rounds to see your history here.</span></p>";
            return;
          }
          var rows = "<table class='history-table'><thead><tr><th>Round</th><th>You</th><th>CPU</th><th>Result</th><th>Date</th></tr></thead><tbody>";
          data.history.forEach(function (h) {
            var cls     = h.result === "You Win!" ? "hist-win" : h.result === "Draw!" ? "hist-draw" : "hist-lose";
            var icon    = h.result === "You Win!" ? "fa-trophy" : h.result === "Draw!" ? "fa-handshake" : "fa-robot";
            var dateStr = h.playedAt ? new Date(h.playedAt).toLocaleDateString("en-IN") : "";
            rows += "<tr class='" + cls + "'><td>" + h.round + "</td><td>" + h.you + "</td><td>" + h.cpu + "</td><td><i class='fa-solid " + icon + "'></i> " + h.result + "</td><td style='font-size:0.75rem;color:#888;'>" + dateStr + "</td></tr>";
          });
          rows += "</tbody></table>";
          historyList.innerHTML = rows;
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
      fetch(API + "/history", {
        method: "DELETE",
        headers: { "Authorization": "Bearer " + token }
      })
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
     MOBILE MENU & NAVBAR INTERACTIVITY
  ================================================================ */
  var hamburgerBtn = document.getElementById("hamburger-btn");
  var navLinks     = document.getElementById("nav-links");

  if (hamburgerBtn && navLinks) {
    hamburgerBtn.addEventListener("click", function () {
      navLinks.classList.toggle("open");
    });
  }

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

});
