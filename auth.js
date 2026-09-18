const API = (window.location.hostname === "127.0.0.1" ? "http://127.0.0.1:3000" : (window.location.port === "3000" ? window.location.origin : "http://localhost:3000")) + "/api";

/* ============================================================
   TAB SWITCHING
   ============================================================ */
function switchTab(tab) {
  var loginForm  = document.getElementById("login-form");
  var signupForm = document.getElementById("signup-form");
  var tabLogin   = document.getElementById("tab-login");
  var tabSignup  = document.getElementById("tab-signup");

  if (tab === "login") {
    loginForm.classList.remove("hidden");
    signupForm.classList.add("hidden");
    tabLogin.classList.add("active");
    tabSignup.classList.remove("active");
  } else {
    signupForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
    tabSignup.classList.add("active");
    tabLogin.classList.remove("active");
  }
}

/* ============================================================
   PASSWORD VISIBILITY TOGGLE
   ============================================================ */
function togglePassword(inputId, btn) {
  var input = document.getElementById(inputId);
  var icon  = btn.querySelector("i");
  if (input.type === "password") {
    input.type = "text";
    icon.classList.replace("fa-eye", "fa-eye-slash");
  } else {
    input.type = "password";
    icon.classList.replace("fa-eye-slash", "fa-eye");
  }
}

/* ============================================================
   PASSWORD STRENGTH METER
   ============================================================ */
var signupPassInput = document.getElementById("signup-password");
var strengthBar     = document.getElementById("strength-bar");
var strengthLabel   = document.getElementById("strength-label");

if (signupPassInput) {
  signupPassInput.addEventListener("input", function () {
    var val = this.value;
    var score = 0;
    if (val.length >= 6)                              score++;
    if (val.length >= 10)                             score++;
    if (/[A-Z]/.test(val) && /[a-z]/.test(val))      score++;
    if (/[0-9]/.test(val))                            score++;
    if (/[^A-Za-z0-9]/.test(val))                    score++;

    strengthBar.className = "strength-bar";
    strengthLabel.className = "strength-label";

    if (!val) {
      strengthBar.style.width = "0"; strengthLabel.textContent = ""; return;
    }
    if (score <= 2) {
      strengthBar.classList.add("weak");   strengthLabel.classList.add("weak");   strengthLabel.textContent = "Weak";
    } else if (score <= 3) {
      strengthBar.classList.add("medium"); strengthLabel.classList.add("medium"); strengthLabel.textContent = "Medium";
    } else {
      strengthBar.classList.add("strong"); strengthLabel.classList.add("strong"); strengthLabel.textContent = "Strong";
    }
  });
}

/* ============================================================
   SHOW MESSAGE (error / success)
   ============================================================ */
function showMsg(id, text, type) {
  var el = document.getElementById(id);
  if (!el) return;
  el.className = "form-message " + (type || "error");
  el.innerHTML = '<i class="fa-solid ' + (type === "success" ? "fa-circle-check" : "fa-circle-exclamation") + '"></i> ' + text;
  el.style.display = "flex";
}

function hideMsg(id) {
  var el = document.getElementById(id);
  if (el) el.style.display = "none";
}

/* ============================================================
   SET BUTTON LOADING STATE
   ============================================================ */
function setLoading(btnId, loading) {
  var btn     = document.getElementById(btnId);
  if (!btn) return;
  var span    = btn.querySelector("span");
  var spinner = btn.querySelector(".btn-spinner");
  var icon    = btn.querySelector("i:not(.btn-spinner)");
  btn.disabled = loading;
  if (loading) {
    if (spinner) spinner.style.display = "inline-block";
    if (icon)    icon.style.display    = "none";
    if (span)    span.textContent      = "Please wait...";
  } else {
    if (spinner) spinner.style.display = "none";
    if (icon)    icon.style.display    = "";
    if (span)    span.textContent      = btn.id === "login-btn" ? "Login" : "Create Account";
  }
}

/* ============================================================
   SAVE SESSION & REDIRECT
   ============================================================ */
function saveAndRedirect(data) {
  var uname = (data.user && (data.user.username || data.user.name)) || "";
  localStorage.setItem("rps_token",    data.token || "guest-token");
  localStorage.setItem("rps_user",     JSON.stringify(data.user || { username: uname, name: uname }));
  sessionStorage.setItem("rps_session", JSON.stringify({ username: uname, name: (data.user && data.user.name) || uname }));
  // Redirect back to game with query parameter as infallible fallback
  setTimeout(function () {
    window.location.href = "index.html?login_success=1&user=" + encodeURIComponent(uname);
  }, 900);
}

/* ============================================================
   CHECK SERVER STATUS
   ============================================================ */
function checkServer(callback) {
  fetch(API.replace("/api", "") + "/ping")
    .then(function (r) { return r.json(); })
    .then(function () { callback(true); })
    .catch(function () {
      var alt = API.includes("127.0.0.1") ? "http://localhost:3000/ping" : "http://127.0.0.1:3000/ping";
      fetch(alt)
        .then(function (r) { return r.json(); })
        .then(function () { callback(true); })
        .catch(function () { callback(false); });
    });
}

/* ============================================================
   LOGIN FORM SUBMIT
   ============================================================ */
var loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    hideMsg("login-msg");

    var emailOrUsername = document.getElementById("login-emailOrUsername").value.trim();
    var password        = document.getElementById("login-password").value;

    if (!emailOrUsername || !password) {
      showMsg("login-msg", "Please fill in all fields!", "error");
      return;
    }

    setLoading("login-btn", true);

    checkServer(function (online) {
      if (!online) {
        setLoading("login-btn", false);
        showMsg("login-msg", "Cannot connect to server! Make sure the server is running on port 3000.", "error");
        return;
      }

      fetch(API + "/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ emailOrUsername, password })
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          setLoading("login-btn", false);
          if (data.success) {
            showMsg("login-msg", "Login successful! Redirecting...", "success");
            saveAndRedirect(data);
          } else {
            showMsg("login-msg", data.message || "Login failed!", "error");
          }
        })
        .catch(function (err) {
          setLoading("login-btn", false);
          showMsg("login-msg", "Server error: " + err.message, "error");
        });
    });
  });
}

/* ============================================================
   SIGNUP FORM SUBMIT
   ============================================================ */
var signupForm = document.getElementById("signup-form");
if (signupForm) {
  signupForm.addEventListener("submit", function (e) {
    e.preventDefault();
    hideMsg("signup-msg");

    var name     = document.getElementById("signup-name").value.trim();
    var username = document.getElementById("signup-username").value.trim();
    var email    = document.getElementById("signup-email").value.trim();
    var password = document.getElementById("signup-password").value;

    if (!name || !username || !email || !password) {
      showMsg("signup-msg", "Please fill in all fields!", "error");
      return;
    }
    if (password.length < 6) {
      showMsg("signup-msg", "Password must be at least 6 characters!", "error");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      showMsg("signup-msg", "Username can only contain letters, numbers, and underscores!", "error");
      return;
    }

    setLoading("signup-btn", true);

    checkServer(function (online) {
      if (!online) {
        setLoading("signup-btn", false);
        showMsg("signup-msg", "Cannot connect to server! Make sure the server is running on port 3000.", "error");
        return;
      }

      fetch(API + "/signup", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ username, name, email, password })
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          setLoading("signup-btn", false);
          if (data.success) {
            showMsg("signup-msg", "Account created! Welcome to RPSPro 🎉", "success");
            saveAndRedirect(data);
          } else {
            showMsg("signup-msg", data.message || "Signup failed!", "error");
          }
        })
        .catch(function (err) {
          setLoading("signup-btn", false);
          showMsg("signup-msg", "Server error: " + err.message, "error");
        });
    });
  });
}
(function checkAlreadyLoggedIn() {
  var token = localStorage.getItem("rps_token");
  if (token) {
    window.location.href = "index.html";
  }
})();

(function checkTabParam() {
  var params = new URLSearchParams(window.location.search);
  if (params.get("tab") === "signup") {
    switchTab("signup");
  }
})();
