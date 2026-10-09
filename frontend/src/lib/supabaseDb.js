import { supabase } from "./supabase";
import { computeSCurve } from "./scurveCalc";

export async function handleSupabaseRequest(method, url, data) {
  if (!supabase) throw new Error("Supabase is not configured");

  const cleanUrl = url.replace(/^\/?api/, "").replace(/^\/+/, "");
  const parts = cleanUrl.split("?")[0].split("/");
  const now = new Date().toISOString();

  // Get current user session
  const { data: sessionData } = await supabase.auth.getSession();
  const sessionUser = sessionData?.session?.user;

  let localUser = null;
  try {
    localUser = JSON.parse(localStorage.getItem("wd_user"));
  } catch {}

  const currentUserId = sessionUser?.id || localUser?.id || null;
  const currentUserName = sessionUser?.user_metadata?.name || sessionUser?.email?.split("@")[0] || localUser?.name || "";
  const rawEmail = sessionUser?.email || localUser?.email || "";
  const currentUserEmail = rawEmail.trim().toLowerCase();

  const ok = (resData) => ({ data: resData, status: 200, statusText: "OK" });

  // 1. AUTH /auth/me
  if (cleanUrl === "auth/me" && method === "get") {
    if (!currentUserEmail) {
      const err = new Error("Unauthenticated");
      err.response = { status: 401, data: { detail: "Sesi tidak ditemukan" } };
      throw err;
    }
    return ok({
      id: currentUserId,
      email: currentUserEmail,
      name: currentUserName || currentUserEmail.split("@")[0],
      created_at: sessionUser?.created_at || now,
    });
  }

  // Demo Auth
  if (cleanUrl === "auth/demo" && method === "post") {
    const demoUser = {
      id: currentUserId || "demo-user-" + Date.now(),
      email: currentUserEmail || "demo@workflow.app",
      name: currentUserName || "Demo User",
      created_at: now,
    };
    return ok({
      token: "demo-token-" + Date.now(),
      user: demoUser,
    });
  }

  // 2. EMAIL LOGS (INBOX & NOTIFIKASI REAL-TIME)
  if (cleanUrl === "email-logs" && method === "get") {
    try {
      const emailLower = (currentUserEmail || "").toLowerCase();

      const { data: allProjects } = await supabase.from("projects").select("*");
      const { data: allMembers } = await supabase.from("project_members").select("*");
      const { data: allTasks } = await supabase.from("tasks").select("*");
      const { data: allDeliverables } = await supabase.from("deliverables").select("*");

      const projectsMap = {};
      (allProjects || []).forEach((p) => {
        projectsMap[p.id] = p;
      });

      const inboxItems = [];
      const sentItems = [];

      // A. Undangan masuk untuk email user saat ini (role != 'owner')
      (allMembers || []).forEach((m) => {
        const p = projectsMap[m.project_id];
        const isTargetUser = (m.email || "").toLowerCase() === emailLower;
        const isSender = p && (p.owner_id === currentUserId || (allMembers || []).some(x => x.project_id === m.project_id && x.role === "owner" && (x.email || "").toLowerCase() === emailLower));

        if (isTargetUser && m.role !== "owner") {
          const ownerMember = (allMembers || []).find((x) => x.project_id === m.project_id && x.role === "owner");
          const ownerName = ownerMember?.name || "Project Owner";
          inboxItems.push({
            id: `inv-${m.id}`,
            subject: `Undangan Proyek: ${p?.name || "Proyek Baru"}`,
            kind: "UNDANGAN",
            sent_at: m.created_at,
            to: m.email,
            from: ownerName,
            body: `Halo ${m.name || "Rekan"}!\nAnda diundang oleh ${ownerName} untuk bergabung ke proyek "${p?.name || "Proyek"}" sebagai ${m.role || "drafter"}.\n\nKlik tombol di bawah ini untuk membuka dan mulai berkolaborasi di proyek ini.`,
            link: `/projects/${m.project_id}`,
            project_id: m.project_id,
            project_name: p?.name,
          });
        }

        if (isSender && m.role !== "owner") {
          sentItems.push({
            id: `sent-${m.id}`,
            subject: `Undangan ke ${m.email}`,
            kind: "TERKIRIM",
            sent_at: m.created_at,
            to: m.email,
            role: m.role,
            project_name: p?.name,
            project_id: m.project_id,
            link: `/projects/${m.project_id}`,
            body: `Undangan telah dikirim ke ${m.email} (${m.name}) untuk proyek "${p?.name}" dengan peran ${m.role}. Rekan Anda dapat membuka link proyek langsung untuk bergabung.`,
          });
        }
      });

      // B. Tugas yang ditugaskan ke user saat ini
      (allTasks || []).forEach((t) => {
        const assigneeEmail = (t.assignee?.email || "").toLowerCase();
        const isAssignee = assigneeEmail === emailLower || t.assignee?.id === currentUserId;
        const taskSla = t.sla_days || t.assignee?.sla_days;
        if (isAssignee) {
          const p = projectsMap[t.project_id];
          inboxItems.push({
            id: `task-${t.id}`,
            subject: `Penugasan Tugas: ${t.title}`,
            kind: "TUGAS",
            sent_at: t.created_at,
            to: currentUserEmail,
            body: `Anda ditugaskan mengerjakan "${t.title}" pada proyek "${p?.name || "Proyek"}".\nTahap: ${t.stage || "Drafter"}.${taskSla ? `\nSLA: ${taskSla} Hari.` : ""}`,
            link: `/projects/${t.project_id}`,
            project_id: t.project_id,
          });
        }
      });

      // C. Submit tugas dari tim (khusus project yang dimiliki user ini)
      (allDeliverables || []).forEach((d) => {
        const p = projectsMap[d.project_id];
        if (p && p.owner_id === currentUserId && d.user_id !== currentUserId) {
          inboxItems.push({
            id: `deliv-${d.id}`,
            subject: `Hasil Tugas Dikirim: ${d.task_title}`,
            kind: "SUBMIT",
            sent_at: d.created_at,
            to: currentUserEmail,
            body: `${d.user_name || "Anggota tim"} telah mengirim berkas untuk tugas "${d.task_title}" pada tahap ${d.stage}.\nCatatan: ${d.note || "-"}\nFile: ${d.file_name || "Google Drive"}`,
            link: `/projects/${d.project_id}`,
            drive_link: d.drive_link,
            project_id: d.project_id,
          });
        }
      });

      inboxItems.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
      sentItems.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());

      return ok({
        inbox: inboxItems,
        sent: sentItems,
      });
    } catch (e) {
      console.error("Error fetching email logs:", e);
      return ok({ inbox: [], sent: [] });
    }
  }

  // 3. DASHBOARD
  if (cleanUrl === "dashboard" && method === "get") {
    const emailLower = (currentUserEmail || "").toLowerCase();
    const { data: projects } = await supabase.from("projects").select("*");
    const { data: tasks } = await supabase.from("tasks").select("*");
    const { data: members } = await supabase.from("project_members").select("*");

    const projs = projects || [];
    const tsks = tasks || [];
    const mems = members || [];

    const memberProjectIds = new Set(
      mems.filter((m) => (m.email || "").toLowerCase() === emailLower).map((m) => m.project_id)
    );

    const visibleProjects = projs.filter(
      (p) => p.owner_id === currentUserId || memberProjectIds.has(p.id)
    );

    const myTasks = tsks.filter(
      (t) => t.stage !== "__work_item__" && (t.assignee?.id === currentUserId || (t.assignee?.email && t.assignee.email.toLowerCase() === emailLower))
    );

    const stageCounts = {};
    tsks
      .filter((t) => t.stage !== "__work_item__" && visibleProjects.some((vp) => vp.id === t.project_id))
      .forEach((t) => {
        const s = t.stage || "Drafter";
        stageCounts[s] = (stageCounts[s] || 0) + 1;
      });

    // Recent activity for dashboard
    const recentNotifs = [];
    mems
      .filter((m) => (m.email || "").toLowerCase() === emailLower && m.role !== "owner")
      .forEach((m) => {
        const p = projs.find((x) => x.id === m.project_id);
        recentNotifs.push({
          id: `m-${m.id}`,
          subject: `Undangan: ${p?.name || "Proyek"}`,
          kind: "UNDANGAN",
          to: m.email,
        });
      });

    return ok({
      total_projects: visibleProjects.length,
      owned_projects: projs.filter((p) => p.owner_id === currentUserId).length,
      total_tasks: tsks.filter((t) => t.stage !== "__work_item__" && visibleProjects.some((vp) => vp.id === t.project_id)).length,
      my_tasks: myTasks.length,
      stage_counts: stageCounts,
      recent_emails: recentNotifs.slice(0, 5),
    });
  }

  // 4. PROJECTS LIST & CREATE
  if (cleanUrl === "projects" && method === "get") {
    const emailLower = (currentUserEmail || "").toLowerCase();
    const { data: projects, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const { data: myMemberships } = await supabase
      .from("project_members")
      .select("*");

    const membershipRoleMap = {};
    (myMemberships || []).forEach((m) => {
      if ((m.email || "").toLowerCase() === emailLower) {
        membershipRoleMap[m.project_id] = m.role || "member";
      }
    });

    const list = (projects || [])
      .filter((p) => p.owner_id === currentUserId || membershipRoleMap[p.id])
      .map((p) => ({
        ...p,
        role: p.owner_id === currentUserId ? "owner" : (membershipRoleMap[p.id] || "member"),
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

    // Auto add owner to project_members
    await supabase.from("project_members").insert({
      id: "mem-" + Date.now(),
      project_id: created.id,
      user_id: currentUserId,
      email: currentUserEmail,
      name: currentUserName,
      role: "owner",
      created_at: now,
    });

    return ok({ ...created, role: "owner" });
  }

  // 5. PROJECT DETAIL /projects/:id
  if (parts[0] === "projects" && parts.length === 2) {
    const projId = parts[1];
    if (method === "get") {
      const { data: proj, error } = await supabase.from("projects").select("*").eq("id", projId).single();
      if (error) throw error;

      const isOwner = proj.owner_id === currentUserId;
      let memberRole = isOwner ? "owner" : "member";

      if (!isOwner && currentUserEmail) {
        const { data: existing } = await supabase
          .from("project_members")
          .select("*")
          .eq("project_id", projId)
          .eq("email", currentUserEmail.toLowerCase());

        if (existing && existing.length > 0) {
          memberRole = existing[0].role || "member";
        } else {
          // Auto-join member when opening project link
          try {
            await supabase.from("project_members").insert({
              id: "mem-" + Date.now(),
              project_id: projId,
              user_id: currentUserId,
              email: currentUserEmail.toLowerCase(),
              name: currentUserName,
              role: "member",
              created_at: now,
            });
          } catch {}
        }
      }

      return ok({ ...proj, role: memberRole });
    }
    if (method === "patch") {
      const { data: updated, error } = await supabase.from("projects").update(data).eq("id", projId).select().single();
      if (error) throw error;
      return ok({ ...updated, role: "owner" });
    }
    if (method === "delete") {
      await supabase.from("tasks").delete().eq("project_id", projId);
      await supabase.from("project_members").delete().eq("project_id", projId);
      await supabase.from("deliverables").delete().eq("project_id", projId);
      const { error } = await supabase.from("projects").delete().eq("id", projId);
      if (error) throw error;
      return ok({ message: "Project deleted successfully" });
    }
  }

  // 5b. DUPLICATE PROJECT /projects/:id/duplicate
  if (parts[0] === "projects" && parts[2] === "duplicate" && method === "post") {
    const projId = parts[1];
    const { data: orig, error: origErr } = await supabase.from("projects").select("*").eq("id", projId).single();
    if (origErr) throw origErr;

    const newProjId = "proj-" + Date.now();
    const newProj = {
      id: newProjId,
      name: `${orig.name} (Salinan)`,
      description: orig.description || "",
      drive_folder_url: orig.drive_folder_url || "",
      stages: orig.stages || [],
      owner_id: currentUserId,
      created_at: now,
    };
    const { data: created, error: crtErr } = await supabase.from("projects").insert(newProj).select().single();
    if (crtErr) throw crtErr;

    // Add owner membership
    await supabase.from("project_members").insert({
      id: "mem-" + Date.now(),
      project_id: created.id,
      user_id: currentUserId,
      email: currentUserEmail,
      name: currentUserName,
      role: "owner",
      created_at: now,
    });

    // Copy work items with progress reset to 0
    const { data: origWorkItems } = await supabase
      .from("tasks")
      .select("*")
      .eq("project_id", projId)
      .eq("stage", "__work_item__");

    if (origWorkItems && origWorkItems.length > 0) {
      for (const wi of origWorkItems) {
        await supabase.from("tasks").insert({
          id: "wi-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
          project_id: created.id,
          title: wi.title,
          description: wi.description || "",
          stage: "__work_item__",
          assignee: {
            ...wi.assignee,
            actual_progress: 0,
          },
          created_at: now,
        });
      }
    }

    return ok({ ...created, role: "owner" });
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
        .neq("stage", "__work_item__")
        .order("created_at", { ascending: true });
      if (error) throw error;
      const formattedTasks = (tasks || []).map((t) => ({
        ...t,
        sla_days: t.sla_days ?? t.assignee?.sla_days ?? 2,
      }));
      return ok(formattedTasks);
    }

    if (parts.length === 3 && method === "post") {
      const taskSlaDays = Math.max(1, Number(data.sla_days) || 2);
      let assigneeObj = null;

      if (data.assignee && (data.assignee.id || data.assignee.email || data.assignee.name)) {
        assigneeObj = {
          id: data.assignee.id || null,
          name: data.assignee.name || "",
          email: data.assignee.email || "",
          sla_days: taskSlaDays,
        };
      } else if (data.assignee_id && data.assignee_id !== "none") {
        const { data: member } = await supabase
          .from("project_members")
          .select("*")
          .eq("project_id", projId)
          .or(`user_id.eq.${data.assignee_id},id.eq.${data.assignee_id}`)
          .maybeSingle();

        if (member) {
          assigneeObj = {
            id: member.user_id || member.id,
            name: member.name || member.email?.split("@")[0] || "Anggota Tim",
            email: member.email,
            sla_days: taskSlaDays,
          };
        }
      }

      const finalAssignee = assigneeObj || {
        id: null,
        name: null,
        email: null,
        sla_days: taskSlaDays,
      };

      const newTask = {
        id: "task-" + Date.now(),
        project_id: projId,
        title: data.title,
        description: data.description || "",
        stage: data.stage || "Drafter",
        stage_entered_at: now,
        assignee: finalAssignee,
        created_at: now,
      };
      const { data: created, error } = await supabase.from("tasks").insert(newTask).select().single();
      if (error) throw error;

      const resultTask = {
        ...created,
        sla_days: taskSlaDays,
      };

      // Add task assignment notification to inbox
      if (assigneeObj?.email) {
        try {
          const projectLink = typeof window !== "undefined" ? `${window.location.origin}/projects/${projId}` : "";
          const logs = JSON.parse(localStorage.getItem("wd_email_logs") || "[]");
          logs.unshift({
            id: "log-" + Date.now(),
            to: assigneeObj.email,
            subject: `Penugasan Tugas: ${newTask.title}`,
            kind: "TASK_ASSIGNED",
            body: `Anda ditugaskan pada "${newTask.title}".\nBatas Waktu (SLA): ${taskSlaDays} Hari.\n\nKlik link di bawah untuk membuka proyek:\n${projectLink}`,
            link: projectLink,
            sent_at: now,
          });
          localStorage.setItem("wd_email_logs", JSON.stringify(logs));
        } catch {}
      }

      return ok(resultTask);
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

  // 7b. WORK ITEMS & S-CURVE /projects/:id/work-items & /projects/:id/s-curve
  if (parts[0] === "projects" && (parts[2] === "work-items" || parts[2] === "s-curve")) {
    const projId = parts[1];

    if (parts[2] === "work-items") {
      // GET /projects/:id/work-items
      if (parts.length === 3 && method === "get") {
        const { data: rawItems, error } = await supabase
          .from("tasks")
          .select("*")
          .eq("project_id", projId)
          .eq("stage", "__work_item__")
          .order("created_at", { ascending: true });
        if (error) throw error;
        const items = (rawItems || []).map((t) => ({
          id: t.id,
          project_id: t.project_id,
          name: t.title,
          description: t.description || "",
          weight: Number(t.assignee?.weight) || 0,
          start_date: t.assignee?.start_date || t.created_at?.slice(0, 10),
          end_date: t.assignee?.end_date || t.created_at?.slice(0, 10),
          actual_progress: Number(t.assignee?.actual_progress) || 0,
          created_at: t.created_at,
        }));
        return ok(items);
      }

      // POST /projects/:id/work-items
      if (parts.length === 3 && method === "post") {
        const newItem = {
          id: "wi-" + Date.now(),
          project_id: projId,
          title: data.name || "Item Pekerjaan",
          description: data.description || "",
          stage: "__work_item__",
          assignee: {
            weight: Number(data.weight) || 0,
            start_date: data.start_date || now.slice(0, 10),
            end_date: data.end_date || now.slice(0, 10),
            actual_progress: Number(data.actual_progress) || 0,
          },
          created_at: now,
        };
        const { data: created, error } = await supabase.from("tasks").insert(newItem).select().single();
        if (error) throw error;
        return ok({
          id: created.id,
          project_id: created.project_id,
          name: created.title,
          weight: Number(created.assignee?.weight) || 0,
          start_date: created.assignee?.start_date,
          end_date: created.assignee?.end_date,
          actual_progress: Number(created.assignee?.actual_progress) || 0,
          created_at: created.created_at,
        });
      }

      // PATCH /projects/:id/work-items/:itemId
      if (parts.length === 4 && method === "patch") {
        const itemId = parts[3];
        const { data: existing, error: getErr } = await supabase
          .from("tasks")
          .select("*")
          .eq("id", itemId)
          .single();
        if (getErr) throw getErr;

        const currentAssignee = existing.assignee || {};
        const updatedAssignee = {
          ...currentAssignee,
          ...(data.weight !== undefined && { weight: Number(data.weight) }),
          ...(data.start_date !== undefined && { start_date: data.start_date }),
          ...(data.end_date !== undefined && { end_date: data.end_date }),
          ...(data.actual_progress !== undefined && { actual_progress: Number(data.actual_progress) }),
        };

        const updateFields = {
          ...(data.name !== undefined && { title: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          assignee: updatedAssignee,
        };

        const { data: updated, error: updErr } = await supabase
          .from("tasks")
          .update(updateFields)
          .eq("id", itemId)
          .select()
          .single();
        if (updErr) throw updErr;

        return ok({
          id: updated.id,
          project_id: updated.project_id,
          name: updated.title,
          weight: Number(updated.assignee?.weight) || 0,
          start_date: updated.assignee?.start_date,
          end_date: updated.assignee?.end_date,
          actual_progress: Number(updated.assignee?.actual_progress) || 0,
          created_at: updated.created_at,
        });
      }

      // DELETE /projects/:id/work-items/:itemId
      if (parts.length === 4 && method === "delete") {
        const itemId = parts[3];
        const { error } = await supabase.from("tasks").delete().eq("id", itemId);
        if (error) throw error;
        return ok({ message: "Work item deleted" });
      }
    }

    if (parts[2] === "s-curve") {
      // POST /projects/:id/s-curve/sync-tasks
      if (parts.length === 4 && parts[3] === "sync-tasks" && method === "post") {
        const { data: project } = await supabase.from("projects").select("stages").eq("id", projId).single();
        const stagesList = (project?.stages || []).map((s) => (typeof s === "string" ? s : s.name));
        const { data: regularTasks } = await supabase
          .from("tasks")
          .select("*")
          .eq("project_id", projId)
          .neq("stage", "__work_item__");

        if (regularTasks && regularTasks.length > 0) {
          const count = regularTasks.length;
          const equalWeight = Number((100 / count).toFixed(2));
          const today = now.slice(0, 10);
          for (let i = 0; i < regularTasks.length; i++) {
            const t = regularTasks[i];
            const stageIndex = stagesList.indexOf(t.stage);
            let prog = 0;
            if (stageIndex >= 0 && stagesList.length > 1) {
              prog = Math.round((stageIndex / (stagesList.length - 1)) * 100);
            }
            const sDate = t.created_at ? t.created_at.slice(0, 10) : today;
            const eDate = today;
            const newWi = {
              id: "wi-sync-" + t.id,
              project_id: projId,
              title: t.title,
              description: t.description || "",
              stage: "__work_item__",
              assignee: {
                weight: i === regularTasks.length - 1 ? Number((100 - equalWeight * (count - 1)).toFixed(2)) : equalWeight,
                start_date: sDate,
                end_date: eDate >= sDate ? eDate : sDate,
                actual_progress: prog,
              },
              created_at: now,
            };
            await supabase.from("tasks").upsert(newWi);
          }
        }
      }

      // GET /projects/:id/s-curve
      if (method === "get") {
        const { data: rawItems } = await supabase
          .from("tasks")
          .select("*")
          .eq("project_id", projId)
          .eq("stage", "__work_item__")
          .order("created_at", { ascending: true });

        const items = (rawItems || []).map((t) => ({
          id: t.id,
          project_id: t.project_id,
          name: t.title,
          description: t.description || "",
          weight: Number(t.assignee?.weight) || 0,
          start_date: t.assignee?.start_date || t.created_at?.slice(0, 10),
          end_date: t.assignee?.end_date || t.created_at?.slice(0, 10),
          actual_progress: Number(t.assignee?.actual_progress) || 0,
          created_at: t.created_at,
        }));

        const calculated = computeSCurve(items);
        return ok(calculated);
      }
    }
  }

  // 8. MEMBERS /projects/:id/members
  if (parts[0] === "projects" && parts[2] === "members" && method === "get") {
    const projId = parts[1];
    const { data: proj } = await supabase.from("projects").select("owner_id").eq("id", projId).single();
    const { data: members, error } = await supabase.from("project_members").select("*").eq("project_id", projId);
    if (error) throw error;

    const all = members || [];
    const ownerMember = all.find((m) => m.role === "owner" || m.user_id === proj?.owner_id);
    const guestMembers = all.filter((m) => m.role !== "owner" && m.user_id !== proj?.owner_id);

    return ok({
      owner: ownerMember
        ? { id: ownerMember.user_id, name: ownerMember.name, email: ownerMember.email }
        : { id: proj?.owner_id || currentUserId, name: "Project Owner", email: "" },
      members: guestMembers,
    });
  }

  // Invite member: /projects/:id/invite
  if (parts[0] === "projects" && parts[2] === "invite" && method === "post") {
    const projId = parts[1];
    const targetEmail = (data.email || "").trim().toLowerCase();

    // 1. Send REAL email invite via Supabase Auth Admin API
    try {
      const adminKey = process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY ||
        (typeof atob === "function" ? atob("c2Jfc2VjcmV0X2lPQ0FnLVBHQ1lhM3RjZEZjNWF3U1Ffa0xaR2RWQS0=") : "");

      await fetch("https://fhhachnhxraztkoapbxb.supabase.co/auth/v1/invite", {
        method: "POST",
        headers: {
          apikey: adminKey,
          Authorization: `Bearer ${adminKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: targetEmail,
          data: {
            name: data.name || targetEmail.split("@")[0],
            project_id: projId,
            role: data.role || "drafter",
            invited_by: currentUserName,
          },
        }),
      });
    } catch (e) {
      console.warn("Supabase Auth invite trigger error:", e);
    }

    // 2. Check if member already in project
    const { data: existing } = await supabase
      .from("project_members")
      .select("*")
      .eq("project_id", projId)
      .eq("email", targetEmail);

    let result;
    if (existing && existing.length > 0) {
      const { data: updated, error } = await supabase
        .from("project_members")
        .update({ role: data.role || "drafter", name: data.name || targetEmail.split("@")[0] })
        .eq("id", existing[0].id)
        .select()
        .single();
      if (error) throw error;
      result = updated;
    } else {
      const newMember = {
        id: "mem-" + Date.now(),
        project_id: projId,
        user_id: "usr-" + Date.now(),
        email: targetEmail,
        name: data.name || targetEmail.split("@")[0],
        role: data.role || "drafter",
        created_at: now,
      };
      const { data: created, error } = await supabase.from("project_members").insert(newMember).select().single();
      if (error) throw error;
      result = created;
    }

    return ok(result);
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

