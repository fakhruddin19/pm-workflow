import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import Layout from "../components/Layout";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import {
  Plus,
  ChevronRight,
  Mail,
  HardDrive,
  Users,
  Settings,
  CloudUpload,
  Trash2,
  X,
  Clock,
  CheckCircle2,
  UserMinus,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatDuration, durationLevel, getSlaInfo, initials, normalizeStages, stageNames } from "../lib/utils";
import WorkflowDiagram from "../components/WorkflowDiagram";

function Timer({ fromISO, slaDays }) {
  const [, setT] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setT((x) => x + 1), 60_000);
    return () => clearInterval(i);
  }, []);
  const info = getSlaInfo(fromISO, slaDays);
  if (!slaDays) return null;
  return (
    <span
      className={cn(
        "timer-pill text-[10px]",
        info.level === "warn" && "timer-pill-warn",
        info.level === "danger" && "timer-pill-danger"
      )}
      title={`Batas SLA: ${slaDays} Hari`}
      data-testid="stage-duration-timer"
    >
      <Clock className="inline h-2.5 w-2.5 mr-1 -mt-0.5" />
      SLA {slaDays} Hari ({info.label})
    </span>
  );
}

function TaskCard({ task, stageNameList, isOwner, onMove, onSubmit, onDelete }) {
  const nextStageIndex = stageNameList.indexOf(task.stage) + 1;
  const nextStage = nextStageIndex < stageNameList.length ? stageNameList[nextStageIndex] : null;
  const taskSlaDays = task.sla_days || 2;
  return (
    <div
      className="p-3 rounded-lg bg-card border border-border hover:border-indigo-500/40 transition-all space-y-2"
      data-testid={`task-card-${task.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-sm leading-snug">{task.title}</div>
        {isOwner && (
          <button
            onClick={() => onDelete(task.id)}
            className="text-muted-foreground hover:text-rose-400 shrink-0"
            data-testid={`delete-task-${task.id}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {task.description && (
        <div className="text-xs text-muted-foreground line-clamp-2">{task.description}</div>
      )}
      <div className="flex items-center justify-between pt-1">
        {task.assignee ? (
          <div className="flex items-center gap-1.5">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="bg-indigo-500/20 text-indigo-200 text-[9px]">
                {initials(task.assignee.name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-[11px] text-muted-foreground truncate max-w-[100px]">
              {task.assignee.name}
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground">Belum assign</span>
        )}
        <Timer fromISO={task.stage_entered_at} slaDays={taskSlaDays} />
      </div>
      <div className="flex gap-1 pt-1">
        {nextStage && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px] flex-1 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
            onClick={() => onMove(task.id, nextStage)}
            data-testid={`advance-stage-btn-${task.id}`}
          >
            <ChevronRight className="h-3 w-3 mr-1" /> {nextStage}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px] flex-1 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10"
          onClick={() => onSubmit(task)}
          data-testid={`submit-work-btn-${task.id}`}
        >
          <CloudUpload className="h-3 w-3 mr-1" /> Submit
        </Button>
      </div>
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [membersData, setMembersData] = useState({ owner: null, members: [] });
  const [deliverables, setDeliverables] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dialogs state
  const [taskOpen, setTaskOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [submittingTask, setSubmittingTask] = useState(null);

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get(`/projects/${id}`),
      api.get(`/projects/${id}/tasks`),
      api.get(`/projects/${id}/members`),
      api.get(`/projects/${id}/deliverables`),
    ])
      .then(([p, t, m, d]) => {
        setProject(p.data);
        setTasks(t.data);
        setMembersData(m.data);
        setDeliverables(d.data);
      })
      .catch((e) => toast.error(e?.response?.data?.detail || "Gagal memuat project"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const isOwner = project?.role === "owner";
  const stages = project?.stages || [];
  const names = stageNames(stages);

  const moveTask = async (taskId, newStage) => {
    try {
      await api.post(`/projects/${id}/tasks/${taskId}/move`, { stage: newStage });
      toast.success(`Pindah ke ${newStage}. Timer direset.`);
      loadAll();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal pindah stage");
    }
  };

  const deleteTask = async (taskId) => {
    try {
      await api.delete(`/projects/${id}/tasks/${taskId}`);
      toast.success("Tugas dihapus");
      loadAll();
    } catch (e) {
      toast.error("Gagal menghapus tugas");
    }
  };

  if (loading || !project) {
    return (
      <Layout>
        <div className="text-muted-foreground">Memuat project...</div>
      </Layout>
    );
  }

  return (
    <Layout
      title={project.name}
      subtitle={project.description || "Tidak ada deskripsi"}
      actions={
        <div className="flex items-center gap-2">
          {project.drive_folder_url && (
            <a
              href={project.drive_folder_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-emerald-300 hover:text-emerald-200 px-3 py-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/5"
              data-testid="project-drive-link"
            >
              <HardDrive className="h-3.5 w-3.5" /> Google Drive
            </a>
          )}
          <Badge variant="outline" className="border-indigo-500/30 text-indigo-200" data-testid="role-badge">
            {project.role}
          </Badge>
        </div>
      }
    >
      <Tabs defaultValue="kanban" className="space-y-6">
        <TabsList className="bg-card border border-border p-1">
          <TabsTrigger value="kanban" data-testid="tab-kanban">
            Workflow Kanban
          </TabsTrigger>
          <TabsTrigger value="deliverables" data-testid="tab-deliverables">
            Deliverables
          </TabsTrigger>
          {isOwner && (
            <TabsTrigger value="members" data-testid="tab-members">
              Personel
            </TabsTrigger>
          )}
          {isOwner && (
            <TabsTrigger value="settings" data-testid="tab-settings">
              Workflow
            </TabsTrigger>
          )}
        </TabsList>

        {/* Kanban Tab */}
        <TabsContent value="kanban" className="space-y-6">
          <WorkflowDiagram
            stages={stages}
            tasks={tasks}
            onTaskClick={(task) => {
              setSubmittingTask(task);
              setSubmitOpen(true);
            }}
          />
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {tasks.length} tugas · {stages.length} stage
            </div>
            {isOwner && (
              <Button
                onClick={() => setTaskOpen(true)}
                className="bg-indigo-500 hover:bg-indigo-600"
                data-testid="create-task-btn"
              >
                <Plus className="h-4 w-4 mr-2" /> Tugas Baru
              </Button>
            )}
          </div>

          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${names.length}, minmax(260px, 1fr))`, overflowX: "auto" }} data-testid="kanban-board-container">
            {names.map((stage) => {
              const stageTasks = tasks.filter((t) => t.stage === stage);
              return (
                <div
                  key={stage}
                  className="stage-column rounded-xl border border-border p-3 space-y-3 min-h-[200px]"
                  data-testid={`stage-column-${stage}`}
                >
                  <div className="flex items-center justify-between px-1">
                    <div className="font-semibold text-sm" data-testid="stage-column-header">
                      {stage}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {stageTasks.length} tugas
                    </span>
                  </div>
                  <div className="space-y-2">
                    {stageTasks.length === 0 ? (
                      <div className="text-xs text-muted-foreground py-6 text-center border border-dashed border-border/40 rounded-md">
                        Belum ada tugas
                      </div>
                    ) : (
                      stageTasks.map((t) => (
                        <TaskCard
                          key={t.id}
                          task={t}
                          stageNameList={names}
                          isOwner={isOwner}
                          onMove={moveTask}
                          onDelete={deleteTask}
                          onSubmit={(task) => {
                            setSubmittingTask(task);
                            setSubmitOpen(true);
                          }}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* Deliverables Tab */}
        <TabsContent value="deliverables">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Riwayat Deliverable</CardTitle>
            </CardHeader>
            <CardContent>
              {deliverables.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-10">
                  <CloudUpload className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Belum ada deliverable yang disubmit.
                </div>
              ) : (
                <div className="divide-y divide-border" data-testid="deliverables-list">
                  {deliverables.map((d) => {
                    const task = tasks.find((t) => t.id === d.task_id);
                    return (
                      <div key={d.id} className="py-3 flex items-start justify-between gap-4" data-testid={`deliverable-${d.id}`}>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm">{task?.title || "Task"}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {d.submitter?.name || "—"} · Stage: {d.stage_at_submit} ·{" "}
                            {new Date(d.created_at).toLocaleString()}
                          </div>
                          {d.note && <div className="text-xs text-foreground/70 mt-1">{d.note}</div>}
                        </div>
                        <a
                          href={d.drive_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-1 shrink-0"
                        >
                          <HardDrive className="h-3 w-3" /> Buka
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Members Tab */}
        {isOwner && (
          <TabsContent value="members">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground">
                1 pemilik · {membersData.members.length} personel
              </div>
              <Button
                onClick={() => setInviteOpen(true)}
                className="bg-indigo-500 hover:bg-indigo-600"
                data-testid="invite-personnel-btn"
              >
                <Mail className="h-4 w-4 mr-2" /> Undang Personel
              </Button>
            </div>
            <Card className="bg-card border-border">
              <CardContent className="p-0">
                <div className="divide-y divide-border" data-testid="project-members-list">
                  {membersData.owner && (
                    <div className="p-4 flex items-center justify-between" data-testid="member-owner">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-emerald-500/20 text-emerald-200">
                            {initials(membersData.owner.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm">{membersData.owner.name}</div>
                          <div className="text-xs text-muted-foreground">{membersData.owner.email}</div>
                        </div>
                      </div>
                      <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-500/30">
                        Owner
                      </Badge>
                    </div>
                  )}
                  {membersData.members.map((m) => (
                    <div key={m.id} className="p-4 flex items-center justify-between" data-testid={`member-${m.id}`}>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-indigo-500/20 text-indigo-200">
                            {initials(m.user?.name || m.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm">{m.user?.name || m.email}</div>
                          <div className="text-xs text-muted-foreground">{m.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "border-border",
                            m.status === "accepted"
                              ? "text-emerald-300 border-emerald-500/30"
                              : "text-amber-300 border-amber-500/30"
                          )}
                        >
                          {m.status === "accepted" ? (
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                          ) : (
                            <Clock className="h-3 w-3 mr-1" />
                          )}
                          {m.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground mr-1">{m.role}</span>
                        {isOwner && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              const confirmRemove = window.confirm(
                                `Apakah Anda yakin ingin menghapus ${m.user?.name || m.name || m.email} dari tim proyek ini?`
                              );
                              if (!confirmRemove) return;
                              try {
                                await api.delete(`/projects/${id}/members/${m.id}`);
                                toast.success("Personel berhasil dihapus dari proyek");
                                loadAll();
                              } catch (err) {
                                toast.error("Gagal menghapus personel: " + (err.response?.data?.detail || err.message));
                              }
                            }}
                            className="h-7 px-2.5 text-xs text-rose-300 border-rose-500/30 hover:bg-rose-950/40 hover:text-rose-200 hover:border-rose-500/50"
                            data-testid={`remove-member-${m.id}`}
                          >
                            <UserMinus className="h-3.5 w-3.5 mr-1 text-rose-400" />
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Workflow Config Tab */}
        {isOwner && (
          <TabsContent value="settings">
            <WorkflowSettings projectId={id} initialStages={stages} onSaved={loadAll} />
          </TabsContent>
        )}
      </Tabs>

      {/* Task Create Dialog */}
      {isOwner && (
        <TaskCreateDialog
          open={taskOpen}
          onOpenChange={setTaskOpen}
          projectId={id}
          stages={stages}
          members={membersData}
          onCreated={loadAll}
        />
      )}

      {/* Invite Dialog */}
      {isOwner && (
        <InviteDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          projectId={id}
          onInvited={loadAll}
        />
      )}

      {/* Submit Deliverable Dialog */}
      <SubmitDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        projectId={id}
        project={project}
        task={submittingTask}
        onSubmitted={loadAll}
      />
    </Layout>
  );
}

function TaskCreateDialog({ open, onOpenChange, projectId, stages, members, onCreated }) {
  const names = stageNames(stages);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("none");
  const [stage, setStage] = useState(names[0] || "");
  const [slaDays, setSlaDays] = useState("2");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (names[0]) setStage(names[0]);
  }, [stages, names]);

  const availableAssignees = [
    ...(members.owner ? [{ id: members.owner.id, name: members.owner.name, email: members.owner.email }] : []),
    ...members.members
      .filter((m) => m.status === "accepted" && m.user)
      .map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email })),
  ];

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/projects/${projectId}/tasks`, {
        title,
        description,
        assignee_id: assigneeId === "none" ? null : assigneeId,
        stage,
        sla_days: Math.max(1, Number(slaDays) || 1),
      });
      toast.success("Tugas dibuat & SLA ditetapkan " + (slaDays || 2) + " hari");
      setTitle("");
      setDescription("");
      setAssigneeId("none");
      setSlaDays("2");
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal membuat tugas");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md" data-testid="create-task-dialog">
        <DialogHeader>
          <DialogTitle>Tugas Baru & Pembagian Kerja</DialogTitle>
          <DialogDescription>Bagi tugas ke personel dan tentukan batas waktu SLA pengerjaan.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Judul Tugas</Label>
            <Input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Digitasi Batas Wilayah Zona 1"
              data-testid="task-title-input"
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label>Deskripsi / Instruksi Kerja</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan detail instruksi pekerjaan untuk drafter/personel..."
              className="bg-background"
              data-testid="task-description-input"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Tahap Awal</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger className="bg-background" data-testid="task-stage-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {names.map((s) => (
                    <SelectItem key={s} value={s} data-testid={`stage-option-${s}`}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Penerima Tugas</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger className="bg-background" data-testid="task-assignee-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="none">— Belum ditentukan —</SelectItem>
                  {availableAssignees.map((a) => (
                    <SelectItem key={a.id} value={a.id} data-testid={`assignee-option-${a.id}`}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>SLA (Hari)</Label>
              <Input
                type="number"
                min="1"
                max="60"
                required
                value={slaDays}
                onChange={(e) => setSlaDays(e.target.value)}
                placeholder="2"
                className="bg-background"
                title="Batas waktu pengerjaan tugas dalam hitungan hari"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={saving}
              className="bg-indigo-500 hover:bg-indigo-600 w-full"
              data-testid="assign-task-submit-btn"
            >
              {saving ? "Menyimpan..." : "Tugaskan Personel"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InviteDialog({ open, onOpenChange, projectId, onInvited }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [saving, setSaving] = useState(false);
  const [invitedSuccess, setInvitedSuccess] = useState(null);

  const projectLink = typeof window !== "undefined" ? `${window.location.origin}/projects/${projectId}` : "";
  const directInviteLink = (targetEmail) => targetEmail ? `${projectLink}?invite=${encodeURIComponent(targetEmail)}` : projectLink;

  const copyLink = (targetEmail = email) => {
    const link = directInviteLink(targetEmail);
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(link);
      toast.success("Link proyek berhasil disalin! Anda bisa langsung kirim ke WhatsApp/email rekan tim.");
    }
  };

  const shareWhatsApp = (r = role, targetEmail = email) => {
    const link = directInviteLink(targetEmail);
    const text = encodeURIComponent(
      `Halo! Anda diundang bergabung ke proyek di WorkflowDrive sebagai ${r}.\n\nBuka link proyek untuk mulai berkolaborasi:\n${link}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  const openGmail = (targetEmail, targetRole) => {
    const link = directInviteLink(targetEmail);
    const subject = encodeURIComponent("Undangan Bergabung ke Proyek WorkflowDrive");
    const body = encodeURIComponent(
      `Halo!\n\nSaya mengundang Anda untuk bergabung ke proyek di WorkflowDrive sebagai ${targetRole}.\n\nSilakan klik tautan di bawah ini untuk membuka proyek dan melihat tugas Anda:\n${link}\n\nTerima kasih!`
    );
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(targetEmail)}&su=${subject}&body=${body}`,
      "_blank"
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/projects/${projectId}/invite`, { email, role, project_link: projectLink });
      toast.success(`Undangan untuk ${email} berhasil diproses!`);
      setInvitedSuccess({ email, role });
      onInvited();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal mengundang");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setInvitedSuccess(null);
    setEmail("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border sm:max-w-md" data-testid="invite-dialog">
        <DialogHeader>
          <DialogTitle>Undang Rekan Tim ke Proyek</DialogTitle>
          <DialogDescription>
            Kirim undangan resmi atau bagikan link proyek langsung via Gmail & WhatsApp.
          </DialogDescription>
        </DialogHeader>

        {invitedSuccess ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
              <div className="h-10 w-10 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg">
                ✓
              </div>
              <div className="font-semibold text-base text-foreground">Undangan Berhasil Diproses!</div>
              <p className="text-xs text-muted-foreground">
                Email undangan otomatis telah dikirim ke <span className="font-medium text-foreground">{invitedSuccess.email}</span> sebagai <span className="font-medium text-indigo-300 capitalize">{invitedSuccess.role}</span>.
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">Opsi Pengiriman Cepat (Direkomendasikan):</div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  onClick={() => openGmail(invitedSuccess.email, invitedSuccess.role)}
                  className="bg-rose-600 hover:bg-rose-500 text-white text-xs h-9"
                >
                  ✉️ Buka Gmail (1-Klik)
                </Button>
                <Button
                  type="button"
                  onClick={() => shareWhatsApp(invitedSuccess.role)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-9"
                >
                  💬 Kirim WhatsApp
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={copyLink}
                className="w-full text-xs h-8 border-border"
              >
                📋 Salin Link Proyek
              </Button>
            </div>

            <div className="p-3 rounded-lg bg-muted/40 border border-border text-[11px] text-muted-foreground leading-relaxed">
              💡 <strong>Tips untuk Rekan:</strong> Minta rekan Anda memeriksa folder <em>Inbox</em> atau <em>Spam / Promosi</em> di email mereka, atau kirimkan via Gmail/WhatsApp di atas agar langsung masuk ke HP rekan Anda.
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setInvitedSuccess(null)}
                className="flex-1 text-xs"
              >
                + Undang Rekan Lain
              </Button>
              <Button
                type="button"
                onClick={handleClose}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
              >
                Selesai
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30 space-y-2">
              <div className="text-xs font-semibold text-indigo-300 flex items-center justify-between">
                <span>Link Langsung Proyek:</span>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={copyLink}
                    className="h-6 text-[11px] border-indigo-500/40 text-indigo-200 hover:bg-indigo-500/20"
                  >
                    Salin 📋
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => shareWhatsApp()}
                    className="h-6 text-[11px] border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20"
                  >
                    WhatsApp 💬
                  </Button>
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground truncate font-mono select-all">
                {projectLink}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Rekan tim Anda cukup membuka link ini di HP/laptop untuk langsung melihat proyek.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Email Personel</Label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="drafter@email.com"
                  data-testid="personnel-email-input"
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>Peran / Posisi</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="bg-background" data-testid="personnel-role-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="drafter">Drafter (Digitasi & Peta)</SelectItem>
                    <SelectItem value="koordinator">Koordinator (Validasi & QC)</SelectItem>
                    <SelectItem value="member">Anggota Tim Umum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-indigo-500 hover:bg-indigo-600 w-full"
                  data-testid="send-invite-btn"
                >
                  {saving ? "Mengirim Undangan..." : "Kirim Undangan Proyek"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SubmitDialog({ open, onOpenChange, projectId, project, task, onSubmitted }) {
  const [fileName, setFileName] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const ownerDriveUrl = project?.drive_folder_url || "";

  useEffect(() => {
    if (open) {
      setDriveLink(ownerDriveUrl);
    } else {
      setFileName("");
      setDriveLink("");
      setNote("");
    }
  }, [open, ownerDriveUrl]);

  const openOwnerDrive = () => {
    if (ownerDriveUrl) {
      window.open(ownerDriveUrl, "_blank", "noopener,noreferrer");
      toast.info("Membuka folder Google Drive proyek...");
    } else {
      toast.error("Owner belum menyetel link Google Drive untuk proyek ini");
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!task) return;
    setSaving(true);
    try {
      if (ownerDriveUrl) {
        window.open(ownerDriveUrl, "_blank", "noopener,noreferrer");
      }
      await api.post(`/projects/${projectId}/tasks/${task.id}/submit`, {
        file_name: fileName || "output_tugas.zip",
        drive_link: driveLink || ownerDriveUrl,
        note,
      });
      toast.success("Deliverable berhasil disimpan!");
      onOpenChange(false);
      onSubmitted();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal submit");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-lg" data-testid="submit-dialog">
        <DialogHeader>
          <DialogTitle>Submit Tugas & Deliverable</DialogTitle>
          <DialogDescription>
            Kirimkan hasil pekerjaan Anda langsung ke folder Google Drive proyek.
            {task && <span className="block mt-1 font-medium text-indigo-300">Tugas: {task.title}</span>}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {ownerDriveUrl ? (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <HardDrive className="h-4 w-4" /> Folder Google Drive Proyek
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={openOwnerDrive}
                  className="h-7 text-xs border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/20"
                >
                  Buka Folder Drive ↗
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Folder Google Drive ini telah disiapkan oleh Project Owner. Unggah file hasil kerja Anda (.shp, .dwg, .zip) ke folder tersebut.
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
              ⚠️ Owner belum memasukkan link Google Drive untuk proyek ini.
            </div>
          )}

          <div className="space-y-2">
            <Label>Nama File / Identitas Pekerjaan</Label>
            <Input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="hasil-kontur-zona7.dwg / peta_shp.zip"
              data-testid="file-upload-input"
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label>Google Drive Link</Label>
            <Input
              value={driveLink}
              onChange={(e) => setDriveLink(e.target.value)}
              placeholder="https://drive.google.com/..."
              data-testid="gdrive-file-link-input"
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label>Catatan untuk Koordinator / Owner</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: Sudah selesai digitasi 14 kecamatan, siap divalidasi ke tahap selanjutnya."
              className="bg-background"
              data-testid="deliverable-note-input"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            {ownerDriveUrl && (
              <Button
                type="button"
                variant="outline"
                onClick={openOwnerDrive}
                className="w-full sm:w-auto border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
              >
                Buka Drive ↗
              </Button>
            )}
            <Button
              type="submit"
              disabled={saving}
              className="bg-indigo-500 hover:bg-indigo-600 flex-1"
              data-testid="confirm-submit-deliverable-btn"
            >
              {saving ? "Menyimpan..." : ownerDriveUrl ? "Buka Drive & Kirim Tugas" : "Kirim Deliverable"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WorkflowSettings({ projectId, initialStages, onSaved }) {
  const [stages, setStages] = useState(normalizeStages(initialStages));
  const [newStage, setNewStage] = useState("");
  const [newSla, setNewSla] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => setStages(normalizeStages(initialStages)), [initialStages]);

  const add = () => {
    const name = newStage.trim();
    if (!name) return;
    const sla = newSla.trim() ? Number(newSla) : null;
    setStages((prev) => [...prev, { name, sla_hours: Number.isFinite(sla) && sla > 0 ? sla : null }]);
    setNewStage("");
    setNewSla("");
  };
  const remove = (i) => setStages((prev) => prev.filter((_, idx) => idx !== i));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= stages.length) return;
    const next = [...stages];
    [next[i], next[j]] = [next[j], next[i]];
    setStages(next);
  };
  const updateSla = (i, val) => {
    const sla = val.trim() ? Number(val) : null;
    setStages((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, sla_hours: Number.isFinite(sla) && sla > 0 ? sla : null } : s))
    );
  };
  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/projects/${projectId}/workflow`, { stages });
      toast.success("Workflow + SLA diperbarui");
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card className="bg-card border-border" data-testid="workflow-settings-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="h-4 w-4" /> Konfigurasi Workflow & SLA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Atur urutan stage dan SLA (batas waktu dalam jam). Bagan workflow akan menyorot otomatis tugas yang
          melewati SLA. Kosongkan SLA untuk menonaktifkan batas waktu pada stage tersebut.
        </p>
        <div className="space-y-2">
          {stages.map((s, i) => (
            <div
              key={`${s.name}-${i}`}
              className="flex items-center gap-2 p-2 border border-border rounded-md bg-background"
              data-testid={`workflow-row-${i}`}
            >
              <span className="font-mono text-xs text-muted-foreground w-6">{i + 1}.</span>
              <span className="flex-1 font-medium text-sm">{s.name}</span>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={s.sla_hours ?? ""}
                  onChange={(e) => updateSla(i, e.target.value)}
                  placeholder="SLA"
                  className="h-8 w-20 bg-card text-xs"
                  data-testid={`workflow-sla-input-${i}`}
                />
                <span className="text-[10px] text-muted-foreground">jam</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} data-testid={`stage-order-up-btn-${i}`}>
                ↑
              </Button>
              <Button size="sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === stages.length - 1} data-testid={`stage-order-down-btn-${i}`}>
                ↓
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(i)} className="text-rose-300" data-testid={`workflow-remove-${i}`}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Stage Baru</Label>
            <Input
              value={newStage}
              onChange={(e) => setNewStage(e.target.value)}
              placeholder="Mis. Review QC"
              data-testid="workflow-new-stage-input"
              className="bg-background mt-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
            />
          </div>
          <div className="w-24">
            <Label className="text-xs text-muted-foreground">SLA (jam)</Label>
            <Input
              type="number"
              min="0"
              step="0.5"
              value={newSla}
              onChange={(e) => setNewSla(e.target.value)}
              placeholder="24"
              data-testid="workflow-new-sla-input"
              className="bg-background mt-1"
            />
          </div>
          <Button variant="outline" onClick={add} data-testid="workflow-add-stage-btn">
            Tambah
          </Button>
        </div>
        <Button onClick={save} disabled={saving} className="bg-indigo-500 hover:bg-indigo-600" data-testid="save-workflow-config-btn">
          {saving ? "Menyimpan..." : "Simpan Workflow"}
        </Button>
      </CardContent>
    </Card>
  );
}
