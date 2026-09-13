// Login Form Data Store (username ya email dono se login allow)
document.getElementById('loginForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const emailOrUsername = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  // Sirf backend ko request bhejein
  fetch('http://localhost:3000/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrUsername, password })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      alert('Login successful!');
      window.location.href = "index.html";
    } else {
      alert(data.message || 'Invalid email/username or password!');
    }
  })
  .catch(() => alert('Server se connect nahi ho pa raha!'));
});

// Sign Up Form Data Store
document.getElementById('signupForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const username = document.getElementById('signup-username').value.trim();
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;

  // Sirf backend ko request bhejein
  fetch('http://localhost:3000/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, name, email, password })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      alert('Sign Up successful! Now you can login.');
      document.getElementById('signupForm').reset();
      document.getElementById('signupForm').style.display = 'none';
      document.getElementById('loginForm').style.display = 'block';
      document.getElementById('form-title').textContent = 'Login';
    } else {
      alert(data.message || 'Sign Up failed!');
    }
  })
  .catch(() => alert('Server se connect nahi ho pa raha!'));
});

// Show/Hide Forms
document.getElementById('show-signup').onclick = function(e) {
  e.preventDefault();
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('signupForm').style.display = 'block';
  document.getElementById('form-title').textContent = 'Sign Up';
};
document.getElementById('show-login').onclick = function(e) {
  e.preventDefault();
  document.getElementById('signupForm').style.display = 'none';
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('form-title').textContent = 'Login';
};
