const USERS_KEY = "authPortalUsers";
const SESSION_KEY = "authPortalSession";

const getUsers = () => JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
const setUsers = (users) => localStorage.setItem(USERS_KEY, JSON.stringify(users));
const normalize = (value) => value.trim().toLowerCase();
const hashPassword = async (password) => {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
const showMessage = (message, success = false) => {
  const output = document.querySelector("#formMessage");
  if (!output) return;
  output.textContent = message;
  output.classList.toggle("success", success);
};
const redirectIfAuthenticated = () => {
  if (sessionStorage.getItem(SESSION_KEY)) window.location.replace("dashboard.html");
};

document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.querySelector("#registerForm");
  const loginForm = document.querySelector("#loginForm");
  const logoutButton = document.querySelector("#logoutButton");

  if (registerForm) {
    redirectIfAuthenticated();
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const username = document.querySelector("#username").value.trim();
      const email = normalize(document.querySelector("#email").value);
      const password = document.querySelector("#password").value;
      if (!username || !email || !password) return showMessage("Please complete every field.");
      if (!/^\S+@\S+\.\S+$/.test(email)) return showMessage("Enter a valid email address.");
      if (password.length < 8 || !/\d/.test(password)) return showMessage("Password must be at least 8 characters and include a number.");
      const users = getUsers();
      if (users.some((user) => user.username.toLowerCase() === username.toLowerCase() || user.email === email)) return showMessage("That username or email is already registered.");
      users.push({ username, email, passwordHash: await hashPassword(password) });
      setUsers(users);
      showMessage("Account created. Redirecting you to sign in…", true);
      setTimeout(() => window.location.assign("index.html"), 700);
    });
  }

  if (loginForm) {
    redirectIfAuthenticated();
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const identity = normalize(document.querySelector("#identity").value);
      const password = document.querySelector("#password").value;
      if (!identity || !password) return showMessage("Please enter your username/email and password.");
      const passwordHash = await hashPassword(password);
      const user = getUsers().find((item) => (item.username.toLowerCase() === identity || item.email === identity) && item.passwordHash === passwordHash);
      if (!user) return showMessage("Incorrect username/email or password.");
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username: user.username, email: user.email }));
      window.location.assign("dashboard.html");
    });
  }

  if (logoutButton) {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    if (!session) { window.location.replace("index.html"); return; }
    document.querySelector("#welcomeHeading").textContent = `Welcome, ${session.username}.`;
    logoutButton.addEventListener("click", () => {
      sessionStorage.removeItem(SESSION_KEY);
      window.location.replace("index.html");
    });
  }
});
