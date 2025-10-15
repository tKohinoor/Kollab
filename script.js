// Global state
let currentUser = null;
let users = JSON.parse(localStorage.getItem("kollabUsers")) || [];
let projects = JSON.parse(localStorage.getItem("kollabProjects")) || [];
let tasks = JSON.parse(localStorage.getItem("kollabTasks")) || [];
let notifications =
  JSON.parse(localStorage.getItem("kollabNotifications")) || [];
let currentProject = null;

// Initialize app
document.addEventListener("DOMContentLoaded", function () {
  checkAuth();
  setupEventListeners();
  checkDeadlines();
});

function setupEventListeners() {
  document.getElementById("loginForm").addEventListener("submit", handleLogin);
  document
    .getElementById("registerForm")
    .addEventListener("submit", handleRegister);
  document
    .getElementById("createProjectForm")
    .addEventListener("submit", handleCreateProject);
  document
    .getElementById("createTaskForm")
    .addEventListener("submit", handleCreateTask);
}

function checkAuth() {
  const savedUser = localStorage.getItem("kollabCurrentUser");
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    showDashboard();
  }
}

function switchAuthTab(tab) {
  document
    .getElementById("loginTab")
    .classList.toggle("active", tab === "login");
  document
    .getElementById("registerTab")
    .classList.toggle("active", tab === "register");
  document.getElementById("loginForm").style.display =
    tab === "login" ? "block" : "none";
  document.getElementById("registerForm").style.display =
    tab === "register" ? "block" : "none";
}

function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  const user = users.find((u) => u.email === email && u.password === password);
  if (user) {
    currentUser = user;
    localStorage.setItem("kollabCurrentUser", JSON.stringify(currentUser));
    showDashboard();
    showNotification("Welcome back, " + user.name + "!", "success");
  } else {
    showNotification("Invalid credentials!", "warning");
  }
}

function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById("registerName").value;
  const email = document.getElementById("registerEmail").value;
  const password = document.getElementById("registerPassword").value;

  if (users.find((u) => u.email === email)) {
    showNotification("Email already exists!", "warning");
    return;
  }

  const newUser = {
    id: Date.now(),
    name,
    email,
    password,
  };

  users.push(newUser);
  localStorage.setItem("kollabUsers", JSON.stringify(users));

  currentUser = newUser;
  localStorage.setItem("kollabCurrentUser", JSON.stringify(currentUser));
  showDashboard();
  showNotification("Account created successfully!", "success");
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

function logout() {
  currentUser = null;
  localStorage.removeItem("kollabCurrentUser");
  document.getElementById("authSection").style.display = "block";
  document.getElementById("dashboard").style.display = "none";
  document.querySelector(".user-info").style.display = "none";

  // Reset forms
  document.getElementById("loginForm").reset();
  document.getElementById("registerForm").reset();
  switchAuthTab("login");
}

function switchSection(section) {
  document
    .querySelectorAll(".nav-btn")
    .forEach((btn) => btn.classList.remove("active"));
  document
    .querySelectorAll(".section")
    .forEach((sec) => sec.classList.remove("active"));

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

function handleCreateProject(e) {
  e.preventDefault();
  const title = document.getElementById("projectTitle").value;
  const description = document.getElementById("projectDescription").value;

  const newProject = {
    id: Date.now(),
    title,
    description,
    ownerId: currentUser.id,
    createdAt: new Date().toISOString(),
  };

  projects.push(newProject);
  localStorage.setItem("kollabProjects", JSON.stringify(projects));

  closeModal("createProjectModal");
  loadProjects();
  showNotification("Project created successfully!", "success");
}

function handleCreateTask(e) {
  e.preventDefault();
  const title = document.getElementById("taskTitle").value;
  const assigneeId = parseInt(document.getElementById("taskAssignee").value);
  const deadline = document.getElementById("taskDeadline").value;

  const newTask = {
    id: Date.now(),
    title,
    projectId: currentProject.id,
    assigneeId,
    deadline,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  tasks.push(newTask);
  localStorage.setItem("kollabTasks", JSON.stringify(tasks));

  // Create notification for assignee
  const assignee = users.find((u) => u.id === assigneeId);
  if (assignee) {
    const notification = {
      id: Date.now(),
      userId: assigneeId,
      message: `You have been assigned a new task: "${title}" in project "${currentProject.title}"`,
      type: "task_assigned",
      read: false,
      createdAt: new Date().toISOString(),
    };
    notifications.push(notification);
    localStorage.setItem("kollabNotifications", JSON.stringify(notifications));
  }

  closeModal("createTaskModal");
  openProjectModal(currentProject);
  showNotification("Task created and assigned!", "success");
}

function loadProjects() {
  const userProjects = projects.filter((p) => p.ownerId === currentUser.id);
  const projectGrid = document.getElementById("projectGrid");

  if (userProjects.length === 0) {
    projectGrid.innerHTML =
      '<p style="text-align: center; color: #666; grid-column: 1 / -1;">No projects yet. Create your first project!</p>';
    return;
  }

  projectGrid.innerHTML = userProjects
    .map((project) => {
      const projectTasks = tasks.filter((t) => t.projectId === project.id);
      const pendingTasks = projectTasks.filter(
        (t) => t.status === "pending"
      ).length;
      const progressTasks = projectTasks.filter(
        (t) => t.status === "progress"
      ).length;
      const completedTasks = projectTasks.filter(
        (t) => t.status === "completed"
      ).length;

      return `
                    <div class="project-card" onclick="openProjectModal(${JSON.stringify(
                      project
                    ).replace(/"/g, "&quot;")})">
                        <div class="project-title">${project.title}</div>
                        <div class="project-description">${
                          project.description
                        }</div>
                        <div class="task-stats">
                            <span class="stat-badge stat-pending">Pending: ${pendingTasks}</span>
                            <span class="stat-badge stat-progress">In Progress: ${progressTasks}</span>
                            <span class="stat-badge stat-completed">Completed: ${completedTasks}</span>
                        </div>
                    </div>
                `;
    })
    .join("");
}
function openProjectModal(project) {
  currentProject = project;
  document.getElementById("modalProjectTitle").textContent = project.title;
  document.getElementById("modalProjectDescription").textContent =
    project.description;

  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const taskList = document.getElementById("modalTaskList");

  if (projectTasks.length === 0) {
    taskList.innerHTML =
      '<p style="text-align: center; color: #666;">No tasks yet. Add your first task!</p>';
  } else {
    taskList.innerHTML = projectTasks
      .map((task) => {
        const assignee = users.find((u) => u.id === task.assigneeId);
        const deadlineDate = new Date(task.deadline);
        const isOverdue =
          deadlineDate < new Date() && task.status !== "completed";

        return `
                        <div class="task-item ${isOverdue ? "overdue" : ""}">
                            <div class="task-header">
                                <div class="task-title">${task.title}</div>
                                <div class="task-status status-${
                                  task.status
                                }" onclick="cycleTaskStatus(${task.id})">
                                    ${
                                      task.status.charAt(0).toUpperCase() +
                                      task.status.slice(1)
                                    }
                                </div>
                            </div>
                            <div class="task-details">
                                <span>Assigned to: ${
                                  assignee ? assignee.name : "Unknown"
                                }</span>
                                <span>Due: ${deadlineDate.toLocaleDateString()} ${
          isOverdue ? "(Overdue!)" : ""
        }</span>
                            </div>
                        </div>
                    `;
      })
      .join("");
  }

  document.getElementById("projectModal").style.display = "block";
}

function populateAssigneeDropdown() {
  const dropdown = document.getElementById("taskAssignee");
  dropdown.innerHTML = '<option value="">Select team member</option>';

  users.forEach((user) => {
    dropdown.innerHTML += <option value="${user.id}">${user.name}</option>;
  });
}

function cycleTaskStatus(taskId) {
  const task = tasks.find((t) => t.id === taskId);
  const statuses = ["pending", "progress", "completed"];
  const currentIndex = statuses.indexOf(task.status);
  const nextIndex = (currentIndex + 1) % statuses.length;

  task.status = statuses[nextIndex];
  localStorage.setItem("kollabTasks", JSON.stringify(tasks));

  openProjectModal(currentProject);
  loadProjects();
  loadMyTasks();

  showNotification(Task status updated to ${task.status}!, "success");
}

function loadMyTasks() {
  const myTasks = tasks.filter((t) => t.assigneeId === currentUser.id);
  const tasksList = document.getElementById("myTasksList");

  if (myTasks.length === 0) {
    tasksList.innerHTML =
      '<p style="text-align: center; color: #666;">No tasks assigned to you yet.</p>';
    return;
  }

  tasksList.innerHTML = myTasks
    .map((task) => {
      const project = projects.find((p) => p.id === task.projectId);
      const deadlineDate = new Date(task.deadline);
      const isOverdue =
        deadlineDate < new Date() && task.status !== "completed";

      return `
                    <div class="task-item ${isOverdue ? "overdue" : ""}">
                        <div class="task-header">
                            <div class="task-title">${task.title}</div>
                            <div class="task-status status-${
                              task.status
                            }" onclick="cycleTaskStatus(${task.id})">
                                ${
                                  task.status.charAt(0).toUpperCase() +
                                  task.status.slice(1)
                                }
                            </div>
                        </div>
                        <div class="task-details">
                            <span>Project: ${
                              project ? project.title : "Unknown Project"
                            }</span>
                            <span>Due: ${deadlineDate.toLocaleDateString()} ${
        isOverdue ? "(Overdue!)" : ""
      }</span>
                        </div>
                    </div>
                `;
    })
    .join("");
}

function loadNotifications() {
  const userNotifications = notifications.filter(
    (n) => n.userId === currentUser.id
  );
  const notificationsList = document.getElementById("notificationsList");

  if (userNotifications.length === 0) {
    notificationsList.innerHTML =
      '<p style="text-align: center; color: #666;">No notifications yet.</p>';
    return;
  }

  notificationsList.innerHTML = userNotifications
    .map((notification) => {
      const notificationDate = new Date(notification.createdAt);
      return `
                    <div class="task-item ${
                      notification.read ? "" : "unread"
                    }" onclick="markNotificationRead(${notification.id})">
                        <div class="task-header">
                            <div class="task-title">${
                              notification.message
                            }</div>
                            <div style="font-size: 12px; color: #666;">
                                ${notificationDate.toLocaleDateString()} ${notificationDate.toLocaleTimeString()}
                            </div>
                        </div>
                    </div>
                `;
    })
    .reverse()
    .join("");
}

function markNotificationRead(notificationId) {
  const notification = notifications.find((n) => n.id === notificationId);
  if (notification) {
    notification.read = true;
    localStorage.setItem("kollabNotifications", JSON.stringify(notifications));
    loadNotifications();
  }
}

function showNotification(message, type = "info") {
  const notification = document.getElementById("notification");
  notification.textContent = message;
  notification.className = notification ${type};
  notification.classList.add("show");

  setTimeout(() => {
    notification.classList.remove("show");
  }, 3000);
}

function checkDeadlines() {
  if (!currentUser) return;

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const myTasks = tasks.filter(
    (t) => t.assigneeId === currentUser.id && t.status !== "completed"
  );

  myTasks.forEach((task) => {
    const deadline = new Date(task.deadline);
    const project = projects.find((p) => p.id === task.projectId);

    if (deadline.toDateString() === tomorrow.toDateString()) {
      const notification = {
        id: Date.now() + Math.random(),
        userId: currentUser.id,
        message: `Task "${task.title}" in project "${
          project ? project.title : "Unknown"
        }" is due tomorrow!`,
        type: "deadline_reminder",
        read: false,
        createdAt: new Date().toISOString(),
      };
      notifications.push(notification);
      localStorage.setItem(
        "kollabNotifications",
        JSON.stringify(notifications)
      );
    }

    if (deadline < today) {
      const notification = {
        id: Date.now() + Math.random(),
        userId: currentUser.id,
        message: `Task "${task.title}" in project "${
          project ? project.title : "Unknown"
        }" is overdue!`,
        type: "overdue",
        read: false,
        createdAt: new Date().toISOString(),
      };
      notifications.push(notification);
      localStorage.setItem(
        "kollabNotifications",
        JSON.stringify(notifications)
      );
    }
  });

  // Check again in 1 hour
  setTimeout(checkDeadlines, 3600000);
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

// Add some demo data for testing
if (users.length === 0) {
  const demoUsers = [
    {
      id: 1,
      name: "John Doe",
      email: "john@example.com",
      password: "password",
    },
    {
      id: 2,
      name: "Jane Smith",
      email: "jane@example.com",
      password: "password",
    },
    {
      id: 3,
      name: "Bob Johnson",
      email: "bob@example.com",
      password: "password",
    },
  ];
  users.push(...demoUsers);
  localStorage.setItem("kollabUsers", JSON.stringify(users));
}

// const x = setTimeout(()=>{console.log(Working Fine)}, 1000);
// console.log (x);
