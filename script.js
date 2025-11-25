// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
  getDatabase, 
  ref, 
  set, 
  get, 
  push, 
  onValue,
  query,
  orderByChild,
  equalTo,
  update
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

const firebaseConfig = {
  apiKey: "AIzaSyCDoNhMBdEIjYNkCGJgYh5ovp87IJNspmg",
  authDomain: "kollabjovac.firebaseapp.com",
  databaseURL: "https://kollabjovac-default-rtdb.firebaseio.com",
  projectId: "kollabjovac",
  storageBucket: "kollabjovac.firebasestorage.app",
  messagingSenderId: "231736706898",
  appId: "1:231736706898:web:e11d146cec5fc83fa71c8b",
  measurementId: "G-C2R04KMRG8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// Global state
let currentUser = null;
let currentProject = null;
let projectsListener = null;
let tasksListener = null;
let notificationsListener = null;

// Initialize app
document.addEventListener("DOMContentLoaded", function () {
  setupEventListeners();
  setupAuthListener();
});

function setupAuthListener() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // User is signed in
      const userRef = ref(database, `users/${user.uid}`);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        currentUser = {
          uid: user.uid,
          email: user.email,
          ...snapshot.val()
        };
        showDashboard();
        checkDeadlines();
      }
    } else {
      // User is signed out
      currentUser = null;
      document.getElementById("authSection").style.display = "block";
      document.getElementById("dashboard").style.display = "none";
      document.querySelector(".user-info").style.display = "none";
      
      // Clean up listeners
      if (projectsListener) projectsListener();
      if (tasksListener) tasksListener();
      if (notificationsListener) notificationsListener();
    }
  });
}

function setupEventListeners() {
  document.getElementById("loginForm").addEventListener("submit", handleLogin);
  document.getElementById("registerForm").addEventListener("submit", handleRegister);
  document.getElementById("createProjectForm").addEventListener("submit", handleCreateProject);
  document.getElementById("createTaskForm").addEventListener("submit", handleCreateTask);
}

function switchAuthTab(tab) {
  document.getElementById("loginTab").classList.toggle("active", tab === "login");
  document.getElementById("registerTab").classList.toggle("active", tab === "register");
  document.getElementById("loginForm").style.display = tab === "login" ? "block" : "none";
  document.getElementById("registerForm").style.display = tab === "register" ? "block" : "none";
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    showNotification("Welcome back!", "success");
    document.getElementById("loginForm").reset();
  } catch (error) {
    console.error("Login error:", error);
    showNotification(getErrorMessage(error.code), "warning");
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById("registerName").value;
  const email = document.getElementById("registerEmail").value;
  const password = document.getElementById("registerPassword").value;

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Save user profile to database
    await set(ref(database, `users/${user.uid}`), {
      name: name,
      email: email,
      createdAt: new Date().toISOString()
    });

    showNotification("Account created successfully!", "success");
    document.getElementById("registerForm").reset();
  } catch (error) {
    console.error("Registration error:", error);
    showNotification(getErrorMessage(error.code), "warning");
  }
}

function showDashboard() {
  document.getElementById("authSection").style.display = "none";
  document.getElementById("dashboard").style.display = "block";
  document.querySelector(".user-info").style.display = "flex";
  document.getElementById("currentUser").textContent = currentUser.name;

  loadProjects();
  loadMyTasks();
  loadNotifications();
}

async function logout() {
  try {
    await signOut(auth);
    document.getElementById("loginForm").reset();
    document.getElementById("registerForm").reset();
    switchAuthTab("login");
    showNotification("Logged out successfully", "success");
  } catch (error) {
    console.error("Logout error:", error);
    showNotification("Error logging out", "warning");
  }
}

function switchSection(section) {
  document.querySelectorAll(".nav-btn").forEach((btn) => btn.classList.remove("active"));
  document.querySelectorAll(".section").forEach((sec) => sec.classList.remove("active"));

  event.target.classList.add("active");
  document.getElementById(section + "Section").classList.add("active");
}

function openCreateProjectModal() {
  document.getElementById("createProjectModal").style.display = "block";
}

function openCreateTaskModal() {
  populateAssigneeDropdown();
  document.getElementById("createTaskModal").style.display = "block";
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
  if (modalId === "createProjectModal") {
    document.getElementById("createProjectForm").reset();
  }
  if (modalId === "createTaskModal") {
    document.getElementById("createTaskForm").reset();
  }
}

async function handleCreateProject(e) {
  e.preventDefault();
  const title = document.getElementById("projectTitle").value;
  const description = document.getElementById("projectDescription").value;

  try {
    const projectsRef = ref(database, 'projects');
    const newProjectRef = push(projectsRef);

    await set(newProjectRef, {
      title,
      description,
      ownerId: currentUser.uid,
      ownerName: currentUser.name,
      createdAt: new Date().toISOString()
    });

    closeModal("createProjectModal");
    showNotification("Project created successfully!", "success");
  } catch (error) {
    console.error("Error creating project:", error);
    showNotification("Error creating project", "warning");
  }
}

async function handleCreateTask(e) {
  e.preventDefault();
  const title = document.getElementById("taskTitle").value;
  const assigneeId = document.getElementById("taskAssignee").value;
  const deadline = document.getElementById("taskDeadline").value;

  try {
    // Get assignee details
    const assigneeRef = ref(database, `users/${assigneeId}`);
    const assigneeSnapshot = await get(assigneeRef);
    const assignee = assigneeSnapshot.val();

    // Create task
    const tasksRef = ref(database, 'tasks');
    const newTaskRef = push(tasksRef);

    await set(newTaskRef, {
      title,
      projectId: currentProject.id,
      projectTitle: currentProject.title,
      assigneeId,
      assigneeName: assignee.name,
      deadline,
      status: "pending",
      createdAt: new Date().toISOString()
    });

    // Create notification for assignee
    const notificationsRef = ref(database, 'notifications');
    const newNotificationRef = push(notificationsRef);

    await set(newNotificationRef, {
      userId: assigneeId,
      message: `You have been assigned a new task: "${title}" in project "${currentProject.title}"`,
      type: "task_assigned",
      read: false,
      createdAt: new Date().toISOString()
    });

    closeModal("createTaskModal");
    showNotification("Task created and assigned!", "success");
  } catch (error) {
    console.error("Error creating task:", error);
    showNotification("Error creating task", "warning");
  }
}

function loadProjects() {
  const projectsRef = ref(database, 'projects');
  const userProjectsQuery = query(projectsRef, orderByChild('ownerId'), equalTo(currentUser.uid));

  // Clean up previous listener
  if (projectsListener) projectsListener();

  projectsListener = onValue(userProjectsQuery, async (snapshot) => {
    const projectGrid = document.getElementById("projectGrid");
    
    if (!snapshot.exists()) {
      projectGrid.innerHTML = '<p style="text-align: center; color: #666; grid-column: 1 / -1;">No projects yet. Create your first project!</p>';
      return;
    }

    const projects = [];
    snapshot.forEach((childSnapshot) => {
      projects.push({
        id: childSnapshot.key,
        ...childSnapshot.val()
      });
    });

    // Get task counts for each project
    const projectsHTML = await Promise.all(projects.map(async (project) => {
      const tasksRef = ref(database, 'tasks');
      const projectTasksQuery = query(tasksRef, orderByChild('projectId'), equalTo(project.id));
      const tasksSnapshot = await get(projectTasksQuery);

      let pendingTasks = 0;
      let progressTasks = 0;
      let completedTasks = 0;

      if (tasksSnapshot.exists()) {
        tasksSnapshot.forEach((taskSnapshot) => {
          const task = taskSnapshot.val();
          if (task.status === 'pending') pendingTasks++;
          else if (task.status === 'progress') progressTasks++;
          else if (task.status === 'completed') completedTasks++;
        });
      }

      return `
        <div class="project-card" onclick='openProjectModal(${JSON.stringify(project).replace(/'/g, "&#39;")})'>
          <div class="project-title">${project.title}</div>
          <div class="project-description">${project.description}</div>
          <div class="task-stats">
            <span class="stat-badge stat-pending">Pending: ${pendingTasks}</span>
            <span class="stat-badge stat-progress">In Progress: ${progressTasks}</span>
            <span class="stat-badge stat-completed">Completed: ${completedTasks}</span>
          </div>
        </div>
      `;
    }));

    projectGrid.innerHTML = projectsHTML.join('');
  });
}

async function openProjectModal(project) {
  currentProject = project;
  document.getElementById("modalProjectTitle").textContent = project.title;
  document.getElementById("modalProjectDescription").textContent = project.description;

  const tasksRef = ref(database, 'tasks');
  const projectTasksQuery = query(tasksRef, orderByChild('projectId'), equalTo(project.id));
  
  const snapshot = await get(projectTasksQuery);
  const taskList = document.getElementById("modalTaskList");

  if (!snapshot.exists()) {
    taskList.innerHTML = '<p style="text-align: center; color: #666;">No tasks yet. Add your first task!</p>';
  } else {
    const tasksHTML = [];
    snapshot.forEach((childSnapshot) => {
      const task = {
        id: childSnapshot.key,
        ...childSnapshot.val()
      };

      const deadlineDate = new Date(task.deadline);
      const isOverdue = deadlineDate < new Date() && task.status !== "completed";

      tasksHTML.push(`
        <div class="task-item ${isOverdue ? "overdue" : ""}">
          <div class="task-header">
            <div class="task-title">${task.title}</div>
            <div class="task-status status-${task.status}" onclick="cycleTaskStatus('${task.id}', '${task.status}')">
              ${task.status.charAt(0).toUpperCase() + task.status.slice(1)}
            </div>
          </div>
          <div class="task-details">
            <span>Assigned to: ${task.assigneeName}</span>
            <span>Due: ${deadlineDate.toLocaleDateString()} ${isOverdue ? "(Overdue!)" : ""}</span>
          </div>
        </div>
      `);
    });

    taskList.innerHTML = tasksHTML.join('');
  }

  document.getElementById("projectModal").style.display = "block";
}

async function populateAssigneeDropdown() {
  const dropdown = document.getElementById("taskAssignee");
  dropdown.innerHTML = '<option value="">Select team member</option>';

  const usersRef = ref(database, 'users');
  const snapshot = await get(usersRef);

  if (snapshot.exists()) {
    snapshot.forEach((childSnapshot) => {
      const userId = childSnapshot.key;
      const user = childSnapshot.val();
      dropdown.innerHTML += `<option value="${userId}">${user.name}</option>`;
    });
  }
}

async function cycleTaskStatus(taskId, currentStatus) {
  const statuses = ["pending", "progress", "completed"];
  const currentIndex = statuses.indexOf(currentStatus);
  const nextIndex = (currentIndex + 1) % statuses.length;
  const newStatus = statuses[nextIndex];

  try {
    const taskRef = ref(database, `tasks/${taskId}`);
    await update(taskRef, {
      status: newStatus
    });

    showNotification(`Task status updated to ${newStatus}!`, "success");
    
    // Reload current project modal if open
    if (currentProject) {
      openProjectModal(currentProject);
    }
  } catch (error) {
    console.error("Error updating task status:", error);
    showNotification("Error updating task status", "warning");
  }
}

function loadMyTasks() {
  const tasksRef = ref(database, 'tasks');
  const myTasksQuery = query(tasksRef, orderByChild('assigneeId'), equalTo(currentUser.uid));

  // Clean up previous listener
  if (tasksListener) tasksListener();

  tasksListener = onValue(myTasksQuery, (snapshot) => {
    const tasksList = document.getElementById("myTasksList");

    if (!snapshot.exists()) {
      tasksList.innerHTML = '<p style="text-align: center; color: #666;">No tasks assigned to you yet.</p>';
      return;
    }

    const tasksHTML = [];
    snapshot.forEach((childSnapshot) => {
      const task = {
        id: childSnapshot.key,
        ...childSnapshot.val()
      };

      const deadlineDate = new Date(task.deadline);
      const isOverdue = deadlineDate < new Date() && task.status !== "completed";

      tasksHTML.push(`
        <div class="task-item ${isOverdue ? "overdue" : ""}">
          <div class="task-header">
            <div class="task-title">${task.title}</div>
            <div class="task-status status-${task.status}" onclick="cycleTaskStatus('${task.id}', '${task.status}')">
              ${task.status.charAt(0).toUpperCase() + task.status.slice(1)}
            </div>
          </div>
          <div class="task-details">
            <span>Project: ${task.projectTitle}</span>
            <span>Due: ${deadlineDate.toLocaleDateString()} ${isOverdue ? "(Overdue!)" : ""}</span>
          </div>
        </div>
      `);
    });

    tasksList.innerHTML = tasksHTML.join('');
  });
}

function loadNotifications() {
  const notificationsRef = ref(database, 'notifications');
  const userNotificationsQuery = query(notificationsRef, orderByChild('userId'), equalTo(currentUser.uid));

  // Clean up previous listener
  if (notificationsListener) notificationsListener();

  notificationsListener = onValue(userNotificationsQuery, (snapshot) => {
    const notificationsList = document.getElementById("notificationsList");

    if (!snapshot.exists()) {
      notificationsList.innerHTML = '<p style="text-align: center; color: #666;">No notifications yet.</p>';
      return;
    }

    const notifications = [];
    snapshot.forEach((childSnapshot) => {
      notifications.push({
        id: childSnapshot.key,
        ...childSnapshot.val()
      });
    });

    // Sort by date (newest first)
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const notificationsHTML = notifications.map((notification) => {
      const notificationDate = new Date(notification.createdAt);
      return `
        <div class="task-item ${notification.read ? "" : "unread"}" onclick="markNotificationRead('${notification.id}', ${notification.read})">
          <div class="task-header">
            <div class="task-title">${notification.message}</div>
            <div style="font-size: 12px; color: #666;">
              ${notificationDate.toLocaleDateString()} ${notificationDate.toLocaleTimeString()}
            </div>
          </div>
        </div>
      `;
    });

    notificationsList.innerHTML = notificationsHTML.join('');
  });
}

async function markNotificationRead(notificationId, isRead) {
  if (!isRead) {
    try {
      const notificationRef = ref(database, `notifications/${notificationId}`);
      await update(notificationRef, {
        read: true
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }
}

function showNotification(message, type = "info") {
  const notification = document.getElementById("notification");
  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.classList.add("show");

  setTimeout(() => {
    notification.classList.remove("show");
  }, 3000);
}

async function checkDeadlines() {
  if (!currentUser) return;

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const tasksRef = ref(database, 'tasks');
  const myTasksQuery = query(tasksRef, orderByChild('assigneeId'), equalTo(currentUser.uid));
  
  const snapshot = await get(myTasksQuery);

  if (snapshot.exists()) {
    snapshot.forEach(async (childSnapshot) => {
      const task = childSnapshot.val();
      
      if (task.status === 'completed') return;

      const deadline = new Date(task.deadline);

      // Tomorrow reminder
      if (deadline.toDateString() === tomorrow.toDateString()) {
        const notificationsRef = ref(database, 'notifications');
        const newNotificationRef = push(notificationsRef);

        await set(newNotificationRef, {
          userId: currentUser.uid,
          message: `Task "${task.title}" in project "${task.projectTitle}" is due tomorrow!`,
          type: "deadline_reminder",
          read: false,
          createdAt: new Date().toISOString()
        });
      }

      // Overdue
      if (deadline < today) {
        const notificationsRef = ref(database, 'notifications');
        const newNotificationRef = push(notificationsRef);

        await set(newNotificationRef, {
          userId: currentUser.uid,
          message: `Task "${task.title}" in project "${task.projectTitle}" is overdue!`,
          type: "overdue",
          read: false,
          createdAt: new Date().toISOString()
        });
      }
    });
  }

  // Check again in 1 hour
  setTimeout(checkDeadlines, 3600000);
}

function getErrorMessage(errorCode) {
  const errorMessages = {
    'auth/email-already-in-use': 'Email already exists!',
    'auth/invalid-email': 'Invalid email address!',
    'auth/weak-password': 'Password should be at least 6 characters!',
    'auth/user-not-found': 'User not found!',
    'auth/wrong-password': 'Invalid credentials!',
    'auth/invalid-credential': 'Invalid credentials!'
  };
  
  return errorMessages[errorCode] || 'An error occurred. Please try again.';
}

// Close modals when clicking outside
window.onclick = function (event) {
  const modals = document.querySelectorAll(".modal");
  modals.forEach((modal) => {
    if (event.target === modal) {
      modal.style.display = "none";
    }
  });
};

// Make functions globally available
window.switchAuthTab = switchAuthTab;
window.logout = logout;
window.switchSection = switchSection;
window.openCreateProjectModal = openCreateProjectModal;
window.openCreateTaskModal = openCreateTaskModal;
window.closeModal = closeModal;
window.openProjectModal = openProjectModal;
window.cycleTaskStatus = cycleTaskStatus;
window.markNotificationRead = markNotificationRead;
