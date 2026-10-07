import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { api } from "../lib/api";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Plus, FolderKanban, HardDrive, X, Timer } from "lucide-react";
import { toast } from "sonner";

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [driveFolderUrl, setDriveFolderUrl] = useState("");
  const [stages, setStages] = useState([
    { name: "Drafter", sla_hours: 24 },
    { name: "Koordinator", sla_hours: 48 },
    { name: "Submit BIG", sla_hours: 72 },
  ]);
  const [newStage, setNewStage] = useState("");
  const [newSla, setNewSla] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/projects").then((r) => setProjects(r.data));
  useEffect(() => {
    load();
  }, []);

  const addStage = () => {
    const s = newStage.trim();
    if (!s) return;
    const sla = newSla.trim() ? Number(newSla) : null;
    setStages((prev) => [...prev, { name: s, sla_hours: Number.isFinite(sla) && sla > 0 ? sla : null }]);
    setNewStage("");
    setNewSla("");
  };

  const removeStage = (i) => setStages((prev) => prev.filter((_, idx) => idx !== i));

  const create = async (e) => {
    e.preventDefault();
    if (stages.length === 0) {
      toast.error("Minimal 1 stage workflow");
      return;
    }
    setSaving(true);
    try {
      await api.post("/projects", {
        name,
        description,
        drive_folder_url: driveFolderUrl,
        stages,
      });
      toast.success("Project berhasil dibuat");
      setOpen(false);
      setName("");
      setDescription("");
      setDriveFolderUrl("");
      setStages([
        { name: "Drafter", sla_hours: 24 },
        { name: "Koordinator", sla_hours: 48 },
        { name: "Submit BIG", sla_hours: 72 },
      ]);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal membuat project");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout
      title="Daftar Project"
      subtitle="Semua project yang Anda miliki atau kerjakan"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-500 hover:bg-indigo-600" data-testid="create-project-btn">
              <Plus className="h-4 w-4 mr-2" /> Project Baru
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-lg" data-testid="create-project-dialog">
            <DialogHeader>
              <DialogTitle>Buat Project Baru</DialogTitle>
              <DialogDescription>
                Setiap project terhubung ke folder Google Drive dan memiliki workflow stages sendiri.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={create} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Project</Label>
                <Input
                  id="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Peta Topografi Zona 7"
                  data-testid="project-name-input"
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Deskripsi</Label>
                <Textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tujuan dan ruang lingkup project"
                  data-testid="project-description-input"
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="drive">Google Drive Folder URL</Label>
                <Input
                  id="drive"
                  value={driveFolderUrl}
                  onChange={(e) => setDriveFolderUrl(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  data-testid="gdrive-folder-url-input"
                  className="bg-background"
                />
                <p className="text-[11px] text-muted-foreground">
                  (Mocked) Link ini akan tampil di halaman project. Integrasi upload real menyusul.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Workflow Stages + SLA (jam)</Label>
                <div className="flex flex-col gap-2 min-h-[2rem]">
                  {stages.map((s, i) => (
                    <div
                      key={`${s.name}-${i}`}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-sm"
                      data-testid={`workflow-stage-chip-${i}`}
                    >
                      <span className="text-indigo-200 flex-1">
                        {i + 1}. {s.name}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-indigo-300 font-mono">
                        <Timer className="h-3 w-3" />
                        {s.sla_hours ? `${s.sla_hours}j` : "—"}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeStage(i)}
                        className="text-indigo-300/60 hover:text-rose-400"
                        data-testid={`remove-stage-${i}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newStage}
                    onChange={(e) => setNewStage(e.target.value)}
                    placeholder="Nama stage"
                    data-testid="new-stage-input"
                    className="bg-background flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addStage();
                      }
                    }}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={newSla}
                    onChange={(e) => setNewSla(e.target.value)}
                    placeholder="SLA jam"
                    data-testid="new-stage-sla-input"
                    className="bg-background w-28"
                  />
                  <Button type="button" variant="outline" onClick={addStage} data-testid="add-workflow-stage-btn">
                    Tambah
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-indigo-500 hover:bg-indigo-600 w-full"
                  data-testid="save-project-btn"
                >
                  {saving ? "Menyimpan..." : "Buat Project"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      {projects.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-xl" data-testid="empty-projects">
          <FolderKanban className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <div className="font-semibold mb-1">Belum ada project</div>
          <div className="text-sm text-muted-foreground mb-4">Mulai dengan membuat project pertama Anda.</div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="projects-grid">
          {projects.map((p) => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="group p-5 rounded-xl border border-border bg-card hover:border-indigo-500/40 transition-all"
              data-testid={`project-card-${p.id}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="font-bold text-base" style={{ fontFamily: "Plus Jakarta Sans" }}>
                  {p.name}
                </div>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-border text-muted-foreground">
                  {p.role}
                </span>
              </div>
              <div className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                {p.description || "Tidak ada deskripsi"}
              </div>
              <div className="flex flex-wrap gap-1 mt-3">
                {(p.stages || []).map((s, idx) => {
                  const nm = typeof s === "string" ? s : s.name;
                  const sla = typeof s === "string" ? null : s.sla_hours;
                  return (
                    <span key={`${nm}-${idx}`} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      {nm}
                      {sla ? ` · ${sla}j` : ""}
                    </span>
                  );
                })}
              </div>
              {p.drive_folder_url && (
                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-300">
                  <HardDrive className="h-3 w-3" /> Terhubung Drive
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}
