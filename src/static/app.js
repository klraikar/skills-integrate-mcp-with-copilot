document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const loginForm = document.getElementById("login-form");
  const logoutButton = document.getElementById("logout-button");
  const authMessage = document.getElementById("auth-message");
  const messageDiv = document.getElementById("message");
  const dashboardContainer = document.getElementById("dashboard-container");
  const dashboardContent = document.getElementById("dashboard-content");

  let authToken = localStorage.getItem("authToken");

  function setMessage(element, text, type = "info") {
    element.textContent = text;
    element.className = type;
    element.classList.remove("hidden");
  }

  function clearMessage(element) {
    element.textContent = "";
    element.className = "hidden";
  }

  function getAuthHeaders() {
    return authToken
      ? { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" }
      : { "Content-Type": "application/json" };
  }

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      activitiesList.innerHTML = "";
      activitySelect.innerHTML = "<option value=\"\">-- Select an activity --</option>";

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span><button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button></li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  async function fetchDashboard() {
    if (!authToken) {
      dashboardContainer.classList.add("hidden");
      return;
    }

    try {
      const response = await fetch("/dashboard", {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        clearMessage(authMessage);
        dashboardContainer.classList.add("hidden");
        return;
      }

      const data = await response.json();
      dashboardContent.innerHTML = "";
      dashboardContainer.classList.remove("hidden");

      dashboardContent.innerHTML = `<p><strong>Role:</strong> ${data.role}</p><p>${data.message}</p>`;

      if (data.role === "student") {
        dashboardContent.innerHTML += `<h4>My Activities</h4>`;
        if (data.my_activities.length === 0) {
          dashboardContent.innerHTML += `<p>No current signups.</p>`;
        } else {
          dashboardContent.innerHTML += `<ul>${data.my_activities
            .map((activity) => `<li>${activity.name}</li>`)
            .join("")}</ul>`;
        }
      } else if (data.role === "provider") {
        dashboardContent.innerHTML += `<h4>Provider Activity Summary</h4><ul>${data.activity_summary
          .map(
            (activity) =>
              `<li>${activity.name}: ${activity.participants} participants, ${activity.spots_left} spots left</li>`
          )
          .join("")}</ul>`;
      } else if (data.role === "admin") {
        dashboardContent.innerHTML += `<h4>Admin Activity Overview</h4><ul>${data.activities
          .map(
            (activity) =>
              `<li>${activity.name}: ${activity.participants.length} participants, ${activity.spots_left} spots left</li>`
          )
          .join("")}</ul>`;
      }
    } catch (error) {
      console.error("Error fetching dashboard:", error);
      setMessage(authMessage, "Failed to load dashboard.", "error");
    }
  }

  async function handleAuthAction(url, options, successMessage) {
    try {
      const response = await fetch(url, options);
      const result = await response.json();

      if (!response.ok) {
        setMessage(authMessage, result.detail || result.message || "Authentication failed.", "error");
        return null;
      }

      if (successMessage) {
        setMessage(authMessage, successMessage, "success");
      }
      return result;
    } catch (error) {
      console.error("Authentication error:", error);
      setMessage(authMessage, "Network error during authentication.", "error");
      return null;
    }
  }

  async function handleUnregister(event) {
    event.preventDefault();
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    if (!authToken) {
      setMessage(messageDiv, "You must log in before unregistering.", "error");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        setMessage(messageDiv, result.message, "success");
        fetchActivities();
        fetchDashboard();
      } else {
        setMessage(messageDiv, result.detail || "An error occurred", "error");
      }
    } catch (error) {
      setMessage(messageDiv, "Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!authToken) {
      setMessage(messageDiv, "You must log in before signing up.", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        setMessage(messageDiv, result.message, "success");
        signupForm.reset();
        fetchActivities();
        fetchDashboard();
      } else {
        setMessage(messageDiv, result.detail || "An error occurred", "error");
      }
    } catch (error) {
      setMessage(messageDiv, "Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("auth-email").value;
    const password = document.getElementById("auth-password").value;

    const result = await handleAuthAction("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (result && result.token) {
      authToken = result.token;
      localStorage.setItem("authToken", authToken);
      setMessage(authMessage, `Logged in as ${result.email} (${result.role})`, "success");
      updateAuthUI();
      fetchDashboard();
    }
  });

  logoutButton.addEventListener("click", async () => {
    if (!authToken) {
      return;
    }

    const result = await handleAuthAction("/auth/logout", {
      method: "POST",
      headers: getAuthHeaders(),
    });

    if (result) {
      authToken = null;
      localStorage.removeItem("authToken");
      updateAuthUI();
      fetchDashboard();
    }
  });

  function updateAuthUI() {
    if (authToken) {
      loginForm.classList.add("hidden");
      logoutButton.classList.remove("hidden");
      dashboardContainer.classList.remove("hidden");
      authMessage.classList.remove("hidden");
    } else {
      loginForm.classList.remove("hidden");
      logoutButton.classList.add("hidden");
      dashboardContainer.classList.add("hidden");
      authMessage.classList.add("hidden");
    }
  }

  updateAuthUI();
  fetchActivities();
  if (authToken) {
    fetchDashboard();
  }
});
