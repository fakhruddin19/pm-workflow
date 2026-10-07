import { supabase } from "./supabase";

export async function handleSupabaseRequest(method, url, data) {
  if (!supabase) throw new Error("Supabase is not configured");

  const cleanUrl = url.replace(/^\/?api/, "").replace(/^\/+/, "");
  const parts = cleanUrl.split("?")[0].split("/");
  const now = new Date().toISOString();

  // Get current user session
  const { data: sessionData } = await supabase.auth.getSession();
  const sessionUser = sessionData?.session?.user;
  const currentUserId = sessionUser?.id || "anon";
  const currentUserName = sessionUser?.user_metadata?.name || sessionUser?.email?.split("@")[0] || "User";
  const currentUserEmail = sessionUser?.email || "user@gis.id";

  const ok = (resData) => ({ data: resData, status: 200, statusText: "OK" });

  // 1. AUTH /auth/me
  if (cleanUrl === "auth/me" && method === "get") {
    return ok({
      id: currentUserId,
      email: currentUserEmail,
      name: currentUserName,
      created_at: sessionUser?.created_at || now,
    });
  }

  // Demo Auth
  if (cleanUrl === "auth/demo" && method === "post") {
    const { data: existingProjs } = await supabase.from("projects").select("id").limit(1);
    if (!existingProjs || existingProjs.length === 0) {
      await seedSupabaseDemo(currentUserId);
    }
    return ok({
      token: "demo-token",
      user: {
        id: currentUserId,
        email: currentUserEmail,
        name: currentUserName,
        created_at: now,
      },
    });
  }

  // 2. EMAIL LOGS (INBOX)
  if (cleanUrl === "email-logs" && method === "get") {
    try {
      const logs = JSON.parse(localStorage.getItem("wd_email_logs") || "[]");
      return ok(Array.isArray(logs) ? logs : []);
    } catch {
      return ok([]);
    }
  }

  // 3. DASHBOARD
  if (cleanUrl === "dashboard" && method === "get") {
    const { data: projects } = await supabase.from("projects").select("*");
    const { data: tasks } = await supabase.from("tasks").select("*");

    const projs = projects || [];
    const tsks = tasks || [];

    const myTasks = tsks.filter((t) => t.assignee?.id === currentUserId);
    const stageCounts = {};
    tsks.forEach((t) => {
      const s = t.stage || "Drafter";
      stageCounts[s] = (stageCounts[s] || 0) + 1;
    });

    let emailLogs = [];
    try {
      emailLogs = JSON.parse(localStorage.getItem("wd_email_logs") || "[]");
    } catch {}

    return ok({
      total_projects: projs.length,
      owned_projects: projs.filter((p) => p.owner_id === currentUserId).length,
      total_tasks: tsks.length,
      my_tasks: myTasks.length,
      stage_counts: stageCounts,
      recent_emails: Array.isArray(emailLogs) ? emailLogs.slice(0, 10) : [],
    });
  }

  // 4. PROJECTS LIST & CREATE
  if (cleanUrl === "projects" && method === "get") {
    const { data: projects, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const list = (projects || []).map((p) => ({
      ...p,
      role: p.owner_id === currentUserId ? "owner" : "member",
    }));
    return ok(list);
  }

  if (cleanUrl === "projects" && method === "post") {
    const defaultStages = [
      { name: "Drafter" },
      { name: "Koordinator" },
      { name: "Submit BIG" },
    ];
    const newProj = {
      id: "proj-" + Date.now(),
      name: data.name,
      description: data.description || "",
      drive_folder_url: data.drive_folder_url || "",
      stages: data.stages && data.stages.length ? data.stages : defaultStages,
      owner_id: currentUserId,
      created_at: now,
    };
    const { data: created, error } = await supabase.from("projects").insert(newProj).select().single();
    if (error) throw error;
    return ok({ ...created, role: "owner" });
  }

  // 5. PROJECT DETAIL /projects/:id
  if (parts[0] === "projects" && parts.length === 2) {
    const projId = parts[1];
    if (method === "get") {
      const { data: proj, error } = await supabase.from("projects").select("*").eq("id", projId).single();
      if (error) throw error;
      return ok({ ...proj, role: proj.owner_id === currentUserId ? "owner" : "member" });
    }
    if (method === "patch") {
      const { data: updated, error } = await supabase.from("projects").update(data).eq("id", projId).select().single();
      if (error) throw error;
      return ok({ ...updated, role: "owner" });
    }
  }

  // 6. WORKFLOW /projects/:id/workflow
  if (parts[0] === "projects" && parts[2] === "workflow" && method === "put") {
    const projId = parts[1];
    const { error } = await supabase.from("projects").update({ stages: data.stages }).eq("id", projId);
    if (error) throw error;
    return ok({ message: "Workflow updated", stages: data.stages });
  }

  // 7. TASKS /projects/:id/tasks
  if (parts[0] === "projects" && parts[2] === "tasks") {
    const projId = parts[1];

    if (parts.length === 3 && method === "get") {
      const { data: tasks, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ok(tasks || []);
    }

    if (parts.length === 3 && method === "post") {
      const newTask = {
        id: "task-" + Date.now(),
        project_id: projId,
        title: data.title,
        description: data.description || "",
        stage: data.stage || "Drafter",
        sla_days: Number(data.sla_days) || 2,
        stage_entered_at: now,
        assignee: data.assignee || {
          id: currentUserId,
          name: currentUserName,
          email: currentUserEmail,
        },
        created_at: now,
      };
      const { data: created, error } = await supabase.from("tasks").insert(newTask).select().single();
      if (error) throw error;

      // Add task assignment notification to inbox
      try {
        const projectLink = typeof window !== "undefined" ? `${window.location.origin}/projects/${projId}` : "";
        const logs = JSON.parse(localStorage.getItem("wd_email_logs") || "[]");
        logs.unshift({
          id: "log-" + Date.now(),
          to: newTask.assignee.email,
          subject: `Penugasan Tugas: ${newTask.title}`,
          kind: "TASK_ASSIGNED",
          body: `Anda ditugaskan pada "${newTask.title}".\nBatas Waktu (SLA): ${newTask.sla_days} Hari.\n\nKlik link di bawah untuk membuka proyek:\n${projectLink}`,
          link: projectLink,
          sent_at: now,
        });
        localStorage.setItem("wd_email_logs", JSON.stringify(logs));
      } catch {}

      return ok(created);
    }

    // Move task: /projects/:id/tasks/:taskId/move
    if (parts.length === 5 && parts[4] === "move" && method === "post") {
      const taskId = parts[3];
      const { data: updated, error } = await supabase
        .from("tasks")
        .update({ stage: data.stage, stage_entered_at: now })
        .eq("id", taskId)
        .select()
        .single();
      if (error) throw error;
      return ok(updated);
    }

    // Delete task: /projects/:id/tasks/:taskId
    if (parts.length === 4 && method === "delete") {
      const taskId = parts[3];
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
      return ok({ message: "Task deleted" });
    }
  }

  // 8. MEMBERS /projects/:id/members
  if (parts[0] === "projects" && parts[2] === "members" && method === "get") {
    const projId = parts[1];
    const { data: proj } = await supabase.from("projects").select("owner_id").eq("id", projId).single();
    const { data: members, error } = await supabase.from("project_members").select("*").eq("project_id", projId);
    if (error) throw error;

    return ok({
      owner: { id: proj?.owner_id || currentUserId, name: currentUserName, email: currentUserEmail },
      members: members || [],
    });
  }

  // Invite member: /projects/:id/invite
  if (parts[0] === "projects" && parts[2] === "invite" && method === "post") {
    const projId = parts[1];
    const newMember = {
      id: "mem-" + Date.now(),
      project_id: projId,
      user_id: "usr-" + Date.now(),
      email: data.email,
      name: data.email.split("@")[0],
      role: data.role || "drafter",
      created_at: now,
    };
    const { data: created, error } = await supabase.from("project_members").insert(newMember).select().single();
    if (error) throw error;

    // Log invite email with direct project link
    try {
      const projectLink = data.project_link || (typeof window !== "undefined" ? `${window.location.origin}/projects/${projId}` : "");
      const logs = JSON.parse(localStorage.getItem("wd_email_logs") || "[]");
      logs.unshift({
        id: "log-" + Date.now(),
        to: data.email,
        subject: `Undangan Bergabung ke Proyek`,
        kind: "INVITE",
        body: `Anda diundang oleh ${currentUserName} untuk bergabung ke proyek sebagai ${data.role || "drafter"}.\n\nKlik link di bawah ini untuk langsung membuka proyek:\n${projectLink}`,
        link: projectLink,
        sent_at: now,
      });
      localStorage.setItem("wd_email_logs", JSON.stringify(logs));
    } catch {}

    return ok(created);
  }

  // Remove member: /projects/:id/members/:memberId
  if (parts[0] === "projects" && parts[2] === "members" && parts.length === 4 && method === "delete") {
    const memId = parts[3];
    const { error } = await supabase.from("project_members").delete().eq("id", memId);
    if (error) throw error;
    return ok({ message: "Member removed" });
  }

  // 9. DELIVERABLES /projects/:id/deliverables
  if (parts[0] === "projects" && parts[2] === "deliverables" && method === "get") {
    const projId = parts[1];
    const { data: delivs, error } = await supabase
      .from("deliverables")
      .select("*")
      .eq("project_id", projId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ok(delivs || []);
  }

  // Submit Deliverable: /projects/:id/tasks/:taskId/submit
  if (parts[0] === "projects" && parts[2] === "tasks" && parts[4] === "submit" && method === "post") {
    const projId = parts[1];
    const taskId = parts[3];
    const { data: task } = await supabase.from("tasks").select("*").eq("id", taskId).single();

    const newDeliv = {
      id: "deliv-" + Date.now(),
      project_id: projId,
      task_id: taskId,
      task_title: task?.title || "Deliverable",
      stage: task?.stage || "Submit BIG",
      user_id: currentUserId,
      user_name: currentUserName,
      note: data.note || "",
      drive_link: data.drive_link || "",
      file_name: data.file_name || "output_spasial.zip",
      created_at: now,
    };
    const { data: created, error } = await supabase.from("deliverables").insert(newDeliv).select().single();
    if (error) throw error;
    return ok(created);
  }

  return ok({ success: true, timestamp: now });
}

// Seed initial sample project into Supabase if empty
export async function seedSupabaseDemo(ownerId = "demo-owner") {
  const now = new Date().toISOString();
  const projId = "demo-project-001";
  const demoProj = {
    id: projId,
    name: "Peta Tematik RTRW Kab. Bangkalan",
    description: "Digitasi batas administrasi, kawasan lindung, dan validasi data spasial ke BIG.",
    drive_folder_url: "https://drive.google.com/drive/folders/sample-spatial-data",
    stages: [
      { name: "Drafter" },
      { name: "Koordinator" },
      { name: "Submit BIG" },
    ],
    owner_id: ownerId,
    created_at: now,
  };
  await supabase.from("projects").upsert(demoProj);

  const demoTasks = [
    {
      id: "task-001",
      project_id: projId,
      title: "Digitasi Layer Kawasan Hutan Lindung",
      description: "Perbaiki topologi polygon jangan ada overlap.",
      stage: "Drafter",
      sla_days: 2,
      stage_entered_at: now,
      assignee: { id: ownerId, name: "Surveyor Spasial", email: "surveyor@gis.id" },
      created_at: now,
    },
    {
      id: "task-002",
      project_id: projId,
      title: "Koreksi Topologi Jaringan Jalan & Sungai",
      description: "Validasi geometri dengan koordinator sebelum diekspor ke format Geodatabase.",
      stage: "Koordinator",
      sla_days: 3,
      stage_entered_at: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
      assignee: { id: ownerId, name: "Surveyor Spasial", email: "surveyor@gis.id" },
      created_at: now,
    },
    {
      id: "task-003",
      project_id: projId,
      title: "Penyusunan Metadata Katalog BIG",
      description: "Upload file SHP dan metadata XML ke portal simojang BIG.",
      stage: "Submit BIG",
      sla_days: 1,
      stage_entered_at: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
      assignee: { id: ownerId, name: "Surveyor Spasial", email: "surveyor@gis.id" },
      created_at: now,
    },
  ];
  await supabase.from("tasks").upsert(demoTasks);
}
