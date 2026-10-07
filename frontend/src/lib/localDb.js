// Smart Local Database Engine for WorkflowDrive (Standalone & Offline Mode)
// Stores all users, projects, workflow stages, tasks, and deliverables in localStorage.

const STORAGE_KEYS = {
  USERS: "wd_local_users",
  CURRENT_USER: "wd_user",
  TOKEN: "wd_token",
  PROJECTS: "wd_local_projects",
  TASKS: "wd_local_tasks",
  MEMBERS: "wd_local_members",
  DELIVERABLES: "wd_local_deliverables",
  EMAIL_LOGS: "wd_local_logs",
};

function getItem(key, defaultVal = []) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : defaultVal;
  } catch {
    return defaultVal;
  }
}

function setItem(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error("Storage save error", e);
  }
}

function getCurrentUser() {
  return getItem(STORAGE_KEYS.CURRENT_USER, null);
}

// Seed initial sample data for demo
export function seedDemoData() {
  const now = new Date().toISOString();
  const demoUserId = "demo-user-001";
  const demoEmail = "demo@workflowdrive.com";
  const demoUser = {
    id: demoUserId,
    email: demoEmail,
    name: "Demo Surveyor",
    created_at: now,
  };

  const users = getItem(STORAGE_KEYS.USERS, []);
  if (!users.find((u) => u.email === demoEmail)) {
    users.push(demoUser);
    setItem(STORAGE_KEYS.USERS, users);
  }

  const projId = "demo-project-001";
  const projects = getItem(STORAGE_KEYS.PROJECTS, []);
  if (!projects.find((p) => p.id === projId)) {
    const demoProject = {
      id: projId,
      name: "Peta Tematik RTRW Kab. Bangkalan",
      description: "Digitasi batas administrasi, kawasan lindung, dan validasi data spasial ke BIG.",
      drive_folder_url: "https://drive.google.com/drive/folders/sample-spatial-data",
      stages: [
        { name: "Drafter", sla_hours: 24 },
        { name: "Koordinator", sla_hours: 48 },
        { name: "Submit BIG", sla_hours: 72 },
      ],
      owner_id: demoUserId,
      created_at: now,
      role: "owner",
    };
    projects.push(demoProject);
    setItem(STORAGE_KEYS.PROJECTS, projects);

    const demoTasks = [
      {
        id: "task-001",
        project_id: projId,
        title: "Digitasi Layer Kawasan Hutan Lindung",
        description: "Perbaiki topologi polygon jangan ada overlap.",
        stage: "Drafter",
        stage_entered_at: now,
        assignee: { id: demoUserId, name: "Demo Surveyor", email: demoEmail },
        created_at: now,
      },
      {
        id: "task-002",
        project_id: projId,
        title: "Koreksi Topologi Jaringan Jalan & Sungai",
        description: "Validasi geometri dengan koordinator sebelum diekspor ke format Geodatabase.",
        stage: "Koordinator",
        stage_entered_at: new Date(Date.now() - 30 * 3600 * 1000).toISOString(),
        assignee: { id: demoUserId, name: "Demo Surveyor", email: demoEmail },
        created_at: now,
      },
      {
        id: "task-003",
        project_id: projId,
        title: "Penyusunan Metadata Katalog BIG",
        description: "Upload file SHP dan metadata XML ke portal simojang BIG.",
        stage: "Submit BIG",
        stage_entered_at: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
        assignee: { id: demoUserId, name: "Demo Surveyor", email: demoEmail },
        created_at: now,
      },
    ];
    setItem(STORAGE_KEYS.TASKS, demoTasks);

    const demoMembers = [
      {
        id: "member-001",
        project_id: projId,
        user_id: "user-budi",
        email: "budi.drafter@gis.id",
        name: "Budi Santoso",
        role: "drafter",
        created_at: now,
      },
      {
        id: "member-002",
        project_id: projId,
        user_id: "user-siti",
        email: "siti.qc@gis.id",
        name: "Siti Rahma",
        role: "koordinator",
        created_at: now,
      },
    ];
    setItem(STORAGE_KEYS.MEMBERS, demoMembers);

    const demoDeliverables = [
      {
        id: "deliv-001",
        project_id: projId,
        task_id: "task-001",
        task_title: "Digitasi Layer Kawasan Hutan Lindung",
        stage: "Drafter",
        user_id: demoUserId,
        user_name: "Demo Surveyor",
        note: "Selesai digitasi 14 kecamatan wilayah utara",
        drive_link: "https://drive.google.com/drive/folders/sample-spatial-data",
        file_name: "Kawasan_Lindung_Bangkalan_v1.shp",
        created_at: now,
      },
    ];
    setItem(STORAGE_KEYS.DELIVERABLES, demoDeliverables);
  }

  return demoUser;
}

// Router dispatcher for local requests
export async function handleLocalRequest(method, url, data) {
  const cleanUrl = url.replace(/^\/?api/, "").replace(/^\/+/, "");
  const parts = cleanUrl.split("?")[0].split("/");
  const now = new Date().toISOString();
  const currentUser = getCurrentUser();

  // Helper response wrapper
  const ok = (responseData) => ({ data: responseData, status: 200, statusText: "OK" });

  // 1. AUTH
  if (cleanUrl.startsWith("auth/register") && method === "post") {
    const users = getItem(STORAGE_KEYS.USERS, []);
    const existing = users.find((u) => u.email.toLowerCase() === data.email.toLowerCase());
    if (existing) {
      const err = new Error("Email sudah terdaftar");
      err.response = { data: { detail: "Email sudah terdaftar" }, status: 400 };
      throw err;
    }
    const newUser = {
      id: "usr-" + Date.now(),
      email: data.email.toLowerCase(),
      name: data.name || data.email.split("@")[0],
      created_at: now,
    };
    users.push(newUser);
    setItem(STORAGE_KEYS.USERS, users);
    const token = "local-jwt-" + Date.now();
    return ok({ token, user: newUser });
  }

  if (cleanUrl.startsWith("auth/login") && method === "post") {
    const users = getItem(STORAGE_KEYS.USERS, []);
    let user = users.find((u) => u.email.toLowerCase() === data.email.toLowerCase());
    if (!user) {
      // Auto-create user for frictionless login if not found
      user = {
        id: "usr-" + Date.now(),
        email: data.email.toLowerCase(),
        name: data.email.split("@")[0],
        created_at: now,
      };
      users.push(user);
      setItem(STORAGE_KEYS.USERS, users);
    }
    const token = "local-jwt-" + Date.now();
    return ok({ token, user });
  }

  if (cleanUrl.startsWith("auth/demo") && method === "post") {
    const demoUser = seedDemoData();
    const token = "demo-jwt-token";
    return ok({ token, user: demoUser });
  }

  if (cleanUrl.startsWith("auth/me") && method === "get") {
    if (!currentUser) {
      const err = new Error("Unauthorized");
      err.response = { data: { detail: "Unauthorized" }, status: 401 };
      throw err;
    }
    return ok(currentUser);
  }

  // 2. DASHBOARD
  if (cleanUrl === "dashboard" && method === "get") {
    const projects = getItem(STORAGE_KEYS.PROJECTS, []);
    const tasks = getItem(STORAGE_KEYS.TASKS, []);
    const uid = currentUser?.id || "";

    const userProjects = projects.filter((p) => p.owner_id === uid || p.role === "owner" || p.role === "member");
    const projIds = userProjects.map((p) => p.id);
    const userTasks = tasks.filter((t) => projIds.includes(t.project_id));
    const myTasks = userTasks.filter((t) => t.assignee?.id === uid);

    const stageCounts = {};
    userTasks.forEach((t) => {
      const s = t.stage || "Drafter";
      stageCounts[s] = (stageCounts[s] || 0) + 1;
    });

    const emails = getItem(STORAGE_KEYS.EMAIL_LOGS, []);

    return ok({
      total_projects: userProjects.length,
      owned_projects: userProjects.filter((p) => p.owner_id === uid).length,
      total_tasks: userTasks.length,
      my_tasks: myTasks.length,
      stage_counts: stageCounts,
      recent_emails: emails.slice(-10),
    });
  }

  // 3. PROJECTS LIST & CREATE
  if (cleanUrl === "projects" && method === "get") {
    let projects = getItem(STORAGE_KEYS.PROJECTS, []);
    if (projects.length === 0) {
      seedDemoData();
      projects = getItem(STORAGE_KEYS.PROJECTS, []);
    }
    return ok(projects);
  }

  if (cleanUrl === "projects" && method === "post") {
    const projects = getItem(STORAGE_KEYS.PROJECTS, []);
    const defaultStages = [
      { name: "Drafter", sla_hours: 24 },
      { name: "Koordinator", sla_hours: 48 },
      { name: "Submit BIG", sla_hours: 72 },
    ];
    const newProj = {
      id: "proj-" + Date.now(),
      name: data.name,
      description: data.description || "",
      drive_folder_url: data.drive_folder_url || "",
      stages: data.stages && data.stages.length ? data.stages : defaultStages,
      owner_id: currentUser?.id || "usr-default",
      created_at: now,
      role: "owner",
    };
    projects.push(newProj);
    setItem(STORAGE_KEYS.PROJECTS, projects);
    return ok(newProj);
  }

  // 4. PROJECT DETAIL /projects/:id
  if (parts[0] === "projects" && parts.length === 2) {
    const projId = parts[1];
    const projects = getItem(STORAGE_KEYS.PROJECTS, []);
    let proj = projects.find((p) => p.id === projId);
    if (!proj) {
      if (projId === "demo-project-001") {
        seedDemoData();
        proj = getItem(STORAGE_KEYS.PROJECTS, []).find((p) => p.id === projId);
      }
    }
    if (!proj) {
      const err = new Error("Project not found");
      err.response = { data: { detail: "Project not found" }, status: 404 };
      throw err;
    }

    if (method === "get") {
      return ok({ ...proj, role: proj.owner_id === currentUser?.id ? "owner" : "member" });
    }
    if (method === "patch") {
      const updated = { ...proj, ...data };
      const updatedList = projects.map((p) => (p.id === projId ? updated : p));
      setItem(STORAGE_KEYS.PROJECTS, updatedList);
      return ok(updated);
    }
  }

  // 5. PROJECT WORKFLOW /projects/:id/workflow
  if (parts[0] === "projects" && parts[2] === "workflow" && method === "put") {
    const projId = parts[1];
    const projects = getItem(STORAGE_KEYS.PROJECTS, []);
    const updated = projects.map((p) => (p.id === projId ? { ...p, stages: data.stages } : p));
    setItem(STORAGE_KEYS.PROJECTS, updated);
    return ok({ message: "Workflow updated", stages: data.stages });
  }

  // 6. TASKS /projects/:id/tasks
  if (parts[0] === "projects" && parts[2] === "tasks") {
    const projId = parts[1];
    const tasks = getItem(STORAGE_KEYS.TASKS, []);

    if (parts.length === 3 && method === "get") {
      return ok(tasks.filter((t) => t.project_id === projId));
    }

    if (parts.length === 3 && method === "post") {
      const newTask = {
        id: "task-" + Date.now(),
        project_id: projId,
        title: data.title,
        description: data.description || "",
        stage: data.stage || "Drafter",
        stage_entered_at: now,
        assignee: data.assignee || {
          id: currentUser?.id || "usr-1",
          name: currentUser?.name || "Surveyor",
          email: currentUser?.email || "surveyor@gis.id",
        },
        created_at: now,
      };
      tasks.push(newTask);
      setItem(STORAGE_KEYS.TASKS, tasks);
      return ok(newTask);
    }

    // Task move: /projects/:id/tasks/:taskId/move
    if (parts.length === 5 && parts[4] === "move" && method === "post") {
      const taskId = parts[3];
      const taskIndex = tasks.findIndex((t) => t.id === taskId);
      if (taskIndex !== -1) {
        tasks[taskIndex].stage = data.stage;
        tasks[taskIndex].stage_entered_at = now;
        setItem(STORAGE_KEYS.TASKS, tasks);
        return ok(tasks[taskIndex]);
      }
    }

    // Task delete: /projects/:id/tasks/:taskId
    if (parts.length === 4 && method === "delete") {
      const taskId = parts[3];
      const filtered = tasks.filter((t) => t.id !== taskId);
      setItem(STORAGE_KEYS.TASKS, filtered);
      return ok({ message: "Task deleted" });
    }
  }

  // 7. MEMBERS /projects/:id/members
  if (parts[0] === "projects" && parts[2] === "members" && method === "get") {
    const projId = parts[1];
    const members = getItem(STORAGE_KEYS.MEMBERS, []).filter((m) => m.project_id === projId);
    return ok({
      owner: currentUser || { id: "usr-owner", name: "Project Owner", email: "owner@gis.id" },
      members,
    });
  }

  // Member invite: /projects/:id/invite
  if (parts[0] === "projects" && parts[2] === "invite" && method === "post") {
    const projId = parts[1];
    const members = getItem(STORAGE_KEYS.MEMBERS, []);
    const newMember = {
      id: "mem-" + Date.now(),
      project_id: projId,
      user_id: "usr-" + Date.now(),
      email: data.email,
      name: data.email.split("@")[0],
      role: data.role || "drafter",
      created_at: now,
    };
    members.push(newMember);
    setItem(STORAGE_KEYS.MEMBERS, members);
    return ok(newMember);
  }

  // Member remove: /projects/:id/members/:memberId
  if (parts[0] === "projects" && parts[2] === "members" && parts.length === 4 && method === "delete") {
    const memId = parts[3];
    const members = getItem(STORAGE_KEYS.MEMBERS, []).filter((m) => m.id !== memId);
    setItem(STORAGE_KEYS.MEMBERS, members);
    return ok({ message: "Member removed" });
  }

  // 8. DELIVERABLES /projects/:id/deliverables
  if (parts[0] === "projects" && parts[2] === "deliverables" && method === "get") {
    const projId = parts[1];
    const delivs = getItem(STORAGE_KEYS.DELIVERABLES, []).filter((d) => d.project_id === projId);
    return ok(delivs);
  }

  // Deliverable submit: /projects/:id/tasks/:taskId/submit
  if (parts[0] === "projects" && parts[2] === "tasks" && parts[4] === "submit" && method === "post") {
    const projId = parts[1];
    const taskId = parts[3];
    const tasks = getItem(STORAGE_KEYS.TASKS, []);
    const task = tasks.find((t) => t.id === taskId);
    const delivs = getItem(STORAGE_KEYS.DELIVERABLES, []);

    const newDeliv = {
      id: "deliv-" + Date.now(),
      project_id: projId,
      task_id: taskId,
      task_title: task?.title || "Deliverable File",
      stage: task?.stage || "Submit BIG",
      user_id: currentUser?.id || "usr-1",
      user_name: currentUser?.name || "Surveyor",
      note: data.note || "",
      drive_link: data.drive_link || "",
      file_name: data.file_name || "output_spasial.zip",
      created_at: now,
    };
    delivs.unshift(newDeliv);
    setItem(STORAGE_KEYS.DELIVERABLES, delivs);
    return ok(newDeliv);
  }

  // Fallback for any other request
  return ok({ success: true, timestamp: now });
}
