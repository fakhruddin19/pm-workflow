from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Union, Dict, Any
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'workflow_drive')
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

JWT_SECRET = os.environ.get('JWT_SECRET', 'dev-secret-change-me-in-production-workflowdrive-2026')
JWT_ALGO = 'HS256'
JWT_EXP_HOURS = 24 * 7  # 7 days

SUPABASE_URL = (os.environ.get('SUPABASE_URL') or '').rstrip('/')
SUPABASE_AUDIENCE = os.environ.get('SUPABASE_JWT_AUDIENCE', 'authenticated')
SUPABASE_ENABLED = bool(SUPABASE_URL)
_jwks_client = None
if SUPABASE_ENABLED:
    try:
        from jwt import PyJWKClient
        _jwks_client = PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")
    except Exception as e:
        logging.warning(f"Failed to initialize Supabase JWKS client: {e}")

# Security
security = HTTPBearer(auto_error=False)

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXP_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGO)

async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token autentikasi tidak ditemukan")
    token = credentials.credentials

    # Supabase verification if enabled
    if SUPABASE_ENABLED and _jwks_client:
        try:
            signing_key = _jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=SUPABASE_AUDIENCE,
            )
            user_id = payload.get("sub")
            email = payload.get("email")
            name = payload.get("user_metadata", {}).get("name", email.split('@')[0] if email else "User")
            user = await db.users.find_one({"id": user_id})
            if not user:
                user = {
                    "id": user_id,
                    "email": email,
                    "name": name,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.users.insert_one(user)
            return user
        except Exception:
            pass

    # Standard JWT verification
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"password_hash": 0, "_id": 0})
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User tidak ditemukan")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesi telah kedaluwarsa")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token tidak valid")

# --- Pydantic Schemas matching OpenAPI ---
class RegisterReq(BaseModel):
    email: EmailStr
    password: str
    name: str

class LoginReq(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    email: str
    name: str
    created_at: str

class AuthResp(BaseModel):
    token: str
    user: UserOut

class StageModel(BaseModel):
    name: str
    sla_hours: Optional[int] = None

class ProjectCreateReq(BaseModel):
    name: str
    description: Optional[str] = None
    drive_folder_url: Optional[str] = None
    stages: List[Union[str, StageModel, Dict[str, Any]]] = Field(default_factory=list)

class ProjectUpdateReq(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    drive_folder_url: Optional[str] = None

class WorkflowStageReq(BaseModel):
    stages: List[Union[str, StageModel, Dict[str, Any]]]

class InviteReq(BaseModel):
    email: str
    role: str = "member"

class TaskCreateReq(BaseModel):
    title: str
    description: Optional[str] = None
    assignee_id: Optional[str] = None
    stage: Optional[str] = None

class TaskMoveReq(BaseModel):
    stage: str

class DeliverableReq(BaseModel):
    note: Optional[str] = None
    drive_link: Optional[str] = None
    file_name: Optional[str] = None

def normalize_stage_list(raw_stages: list) -> list:
    normalized = []
    for s in raw_stages:
        if isinstance(s, str):
            normalized.append({"name": s, "sla_hours": None})
        elif isinstance(s, dict):
            normalized.append({"name": s.get("name"), "sla_hours": s.get("sla_hours")})
        elif hasattr(s, "name"):
            normalized.append({"name": s.name, "sla_hours": getattr(s, "sla_hours", None)})
    return normalized

# App initialization
app = FastAPI(title="WorkflowDrive API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")

# --- AUTH ENDPOINTS ---
@api.post("/auth/register", response_model=AuthResp)
async def register(req: RegisterReq):
    existing = await db.users.find_one({"email": req.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    new_user = {
        "id": user_id,
        "email": req.email.lower(),
        "name": req.name,
        "password_hash": hash_password(req.password),
        "created_at": now
    }
    await db.users.insert_one(new_user)
    
    token = create_access_token({"sub": user_id, "email": req.email.lower()})
    user_out = UserOut(id=user_id, email=req.email.lower(), name=req.name, created_at=now)
    return AuthResp(token=token, user=user_out)

@api.post("/auth/login", response_model=AuthResp)
async def login(req: LoginReq):
    user = await db.users.find_one({"email": req.email.lower()})
    if not user or not verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    
    token = create_access_token({"sub": user["id"], "email": user["email"]})
    user_out = UserOut(id=user["id"], email=user["email"], name=user["name"], created_at=user["created_at"])
    return AuthResp(token=token, user=user_out)

@api.post("/auth/demo", response_model=AuthResp)
async def demo_login():
    demo_email = "demo@workflowdrive.com"
    user = await db.users.find_one({"email": demo_email})
    now = datetime.now(timezone.utc).isoformat()
    
    if not user:
        user_id = "demo-user-id-001"
        user = {
            "id": user_id,
            "email": demo_email,
            "name": "Demo Surveyor",
            "password_hash": hash_password("demo1234"),
            "created_at": now
        }
        await db.users.insert_one(user)
        
        # Seed initial demo spatial mapping project
        proj_id = "demo-project-001"
        stages = [
            {"name": "Drafter", "sla_hours": 24},
            {"name": "Koordinator", "sla_hours": 48},
            {"name": "Submit BIG", "sla_hours": 72}
        ]
        demo_project = {
            "id": proj_id,
            "name": "Peta Tematik RTRW Kab. Bangkalan",
            "description": "Digitasi batas administrasi, kawasan lindung, dan validasi data spasial ke BIG.",
            "drive_folder_url": "https://drive.google.com/drive/folders/sample-spatial-data",
            "stages": stages,
            "owner_id": user_id,
            "created_at": now
        }
        await db.projects.insert_one(demo_project)
        
        # Seed demo tasks
        demo_tasks = [
            {
                "id": str(uuid.uuid4()),
                "project_id": proj_id,
                "title": "Digitasi Layer Kawasan Hutan Lindung",
                "description": "Perbaiki topologi polygon jangan ada overlap.",
                "stage": "Drafter",
                "stage_entered_at": now,
                "assignee": {"id": user_id, "name": "Demo Surveyor", "email": demo_email},
                "created_at": now
            },
            {
                "id": str(uuid.uuid4()),
                "project_id": proj_id,
                "title": "Koreksi Topologi Jaringan Jalan & Sungai",
                "description": "Validasi geometri dengan koordinator sebelum diekspor ke format Geodatabase.",
                "stage": "Koordinator",
                "stage_entered_at": (datetime.now(timezone.utc) - timedelta(hours=30)).isoformat(),
                "assignee": {"id": user_id, "name": "Demo Surveyor", "email": demo_email},
                "created_at": now
            },
            {
                "id": str(uuid.uuid4()),
                "project_id": proj_id,
                "title": "Penyusunan Metadata Katalog BIG",
                "description": "Upload file SHP dan metadata XML ke portal simojang BIG.",
                "stage": "Submit BIG",
                "stage_entered_at": (datetime.now(timezone.utc) - timedelta(hours=10)).isoformat(),
                "assignee": {"id": user_id, "name": "Demo Surveyor", "email": demo_email},
                "created_at": now
            }
        ]
        await db.tasks.insert_many(demo_tasks)
        
        # Seed mock email log
        await db.email_logs.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "to": demo_email,
            "subject": "Selamat Datang di WorkflowDrive",
            "kind": "WELCOME",
            "body": "Akun demo Anda siap digunakan. Silakan kelola alur kerja spasial Anda.",
            "sent_at": now
        })
    else:
        user_id = user["id"]

    token = create_access_token({"sub": user_id, "email": user["email"]})
    user_out = UserOut(id=user_id, email=user["email"], name=user["name"], created_at=user["created_at"])
    return AuthResp(token=token, user=user_out)

@api.get("/auth/me", response_model=UserOut)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserOut(
        id=current_user["id"],
        email=current_user["email"],
        name=current_user["name"],
        created_at=current_user["created_at"]
    )

# --- PROJECTS ENDPOINTS ---
@api.get("/projects")
async def list_projects(current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]
    # Projects where user is owner or in members
    owned_cursor = db.projects.find({"owner_id": uid}, {"_id": 0})
    owned = await owned_cursor.to_list(length=100)
    for p in owned:
        p["role"] = "owner"
        
    memberships = await db.project_members.find({"user_id": uid}, {"_id": 0}).to_list(length=100)
    member_proj_ids = [m["project_id"] for m in memberships]
    
    member_projects = []
    if member_proj_ids:
        member_cursor = db.projects.find({"id": {"$in": member_proj_ids}}, {"_id": 0})
        member_projs = await member_cursor.to_list(length=100)
        for p in member_projs:
            p["role"] = "member"
            member_projects.append(p)
            
    return owned + member_projects

@api.post("/projects")
async def create_project(req: ProjectCreateReq, current_user: dict = Depends(get_current_user)):
    proj_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    stages = normalize_stage_list(req.stages)
    if not stages:
        stages = [
            {"name": "Drafter", "sla_hours": 24},
            {"name": "Koordinator", "sla_hours": 48},
            {"name": "Submit BIG", "sla_hours": 72}
        ]
        
    proj = {
        "id": proj_id,
        "name": req.name,
        "description": req.description or "",
        "drive_folder_url": req.drive_folder_url or "",
        "stages": stages,
        "owner_id": current_user["id"],
        "created_at": now
    }
    await db.projects.insert_one(proj)
    proj_clean = proj.copy()
    proj_clean.pop("_id", None)
    proj_clean["role"] = "owner"
    return proj_clean

@api.get("/projects/{project_id}")
async def get_project(project_id: str, current_user: dict = Depends(get_current_user)):
    proj = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not proj:
        raise HTTPException(status_code=404, detail="Proyek tidak ditemukan")
    
    uid = current_user["id"]
    if proj["owner_id"] == uid:
        role = "owner"
    else:
        mem = await db.project_members.find_one({"project_id": project_id, "user_id": uid})
        if not mem:
            raise HTTPException(status_code=403, detail="Anda tidak memiliki akses ke proyek ini")
        role = "member"
        
    proj["role"] = role
    return proj

@api.patch("/projects/{project_id}")
async def update_project(project_id: str, req: ProjectUpdateReq, current_user: dict = Depends(get_current_user)):
    proj = await db.projects.find_one({"id": project_id})
    if not proj:
        raise HTTPException(status_code=404, detail="Proyek tidak ditemukan")
    if proj["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Hanya owner yang dapat mengubah proyek")
    
    updates = {}
    if req.name is not None:
        updates["name"] = req.name
    if req.description is not None:
        updates["description"] = req.description
    if req.drive_folder_url is not None:
        updates["drive_folder_url"] = req.drive_folder_url
        
    if updates:
        await db.projects.update_one({"id": project_id}, {"$set": updates})
        
    updated = await db.projects.find_one({"id": project_id}, {"_id": 0})
    updated["role"] = "owner"
    return updated

@api.put("/projects/{project_id}/workflow")
async def update_workflow(project_id: str, req: WorkflowStageReq, current_user: dict = Depends(get_current_user)):
    proj = await db.projects.find_one({"id": project_id})
    if not proj:
        raise HTTPException(status_code=404, detail="Proyek tidak ditemukan")
    if proj["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Hanya owner yang dapat mengubah workflow")
    
    stages = normalize_stage_list(req.stages)
    await db.projects.update_one({"id": project_id}, {"$set": {"stages": stages}})
    return {"message": "Workflow berhasil diperbarui", "stages": stages}

# --- MEMBERS & INVITES ---
@api.get("/projects/{project_id}/members")
async def get_members(project_id: str, current_user: dict = Depends(get_current_user)):
    proj = await db.projects.find_one({"id": project_id})
    if not proj:
        raise HTTPException(status_code=404, detail="Proyek tidak ditemukan")
    
    owner = await db.users.find_one({"id": proj["owner_id"]}, {"password_hash": 0, "_id": 0})
    members = await db.project_members.find({"project_id": project_id}, {"_id": 0}).to_list(length=100)
    
    return {
        "owner": owner,
        "members": members
    }

@api.post("/projects/{project_id}/invite")
async def invite_member(project_id: str, req: InviteReq, current_user: dict = Depends(get_current_user)):
    proj = await db.projects.find_one({"id": project_id})
    if not proj:
        raise HTTPException(status_code=404, detail="Proyek tidak ditemukan")
    if proj["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Hanya owner yang dapat mengundang anggota")
        
    target_user = await db.users.find_one({"email": req.email.lower()})
    user_id = target_user["id"] if target_user else str(uuid.uuid4())
    user_name = target_user["name"] if target_user else req.email.split('@')[0]
    
    membership_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    membership = {
        "id": membership_id,
        "project_id": project_id,
        "user_id": user_id,
        "email": req.email.lower(),
        "name": user_name,
        "role": req.role,
        "created_at": now
    }
    await db.project_members.insert_one(membership)
    
    # Log mock invitation email
    await db.email_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "to": req.email.lower(),
        "subject": f"Undangan Proyek: {proj['name']}",
        "kind": "INVITE",
        "body": f"Anda diundang oleh {current_user['name']} untuk bergabung ke proyek '{proj['name']}' sebagai {req.role}.",
        "sent_at": now
    })
    
    membership.pop("_id", None)
    return membership

@api.delete("/projects/{project_id}/members/{membership_id}")
async def remove_member(project_id: str, membership_id: str, current_user: dict = Depends(get_current_user)):
    proj = await db.projects.find_one({"id": project_id})
    if not proj or proj["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Tidak memiliki akses untuk menghapus anggota")
        
    res = await db.project_members.delete_one({"id": membership_id, "project_id": project_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Anggota tidak ditemukan")
    return {"message": "Anggota berhasil dihapus"}

# --- TASKS ENDPOINTS ---
@api.get("/projects/{project_id}/tasks")
async def list_tasks(project_id: str, current_user: dict = Depends(get_current_user)):
    tasks = await db.tasks.find({"project_id": project_id}, {"_id": 0}).to_list(length=200)
    return tasks

@api.post("/projects/{project_id}/tasks")
async def create_task(project_id: str, req: TaskCreateReq, current_user: dict = Depends(get_current_user)):
    proj = await db.projects.find_one({"id": project_id})
    if not proj:
        raise HTTPException(status_code=404, detail="Proyek tidak ditemukan")
        
    stages = proj.get("stages", [])
    default_stage = stages[0]["name"] if stages else "Drafter"
    stage = req.stage or default_stage
    
    assignee_data = None
    if req.assignee_id:
        u = await db.users.find_one({"id": req.assignee_id})
        if u:
            assignee_data = {"id": u["id"], "name": u["name"], "email": u["email"]}
            
    task_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    task = {
        "id": task_id,
        "project_id": project_id,
        "title": req.title,
        "description": req.description or "",
        "stage": stage,
        "stage_entered_at": now,
        "assignee": assignee_data,
        "created_at": now
    }
    await db.tasks.insert_one(task)
    
    # Notify assignee if present
    if assignee_data:
        await db.email_logs.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": assignee_data["id"],
            "to": assignee_data["email"],
            "subject": f"Tugas Baru: {req.title}",
            "kind": "TASK_ASSIGNED",
            "body": f"Anda ditugaskan pada '{req.title}' di proyek '{proj['name']}'. Tahap: {stage}.",
            "sent_at": now
        })
        
    task.pop("_id", None)
    return task

@api.post("/projects/{project_id}/tasks/{task_id}/move")
async def move_task(project_id: str, task_id: str, req: Optional[TaskMoveReq] = None, current_user: dict = Depends(get_current_user)):
    task = await db.tasks.find_one({"id": task_id, "project_id": project_id})
    if not task:
        raise HTTPException(status_code=404, detail="Tugas tidak ditemukan")
        
    new_stage = req.stage if req else task["stage"]
    now = datetime.now(timezone.utc).isoformat()
    
    # Resets stage timer on every stage advance
    await db.tasks.update_one(
        {"id": task_id},
        {"$set": {"stage": new_stage, "stage_entered_at": now}}
    )
    
    updated = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return updated

@api.delete("/projects/{project_id}/tasks/{task_id}")
async def delete_task(project_id: str, task_id: str, current_user: dict = Depends(get_current_user)):
    proj = await db.projects.find_one({"id": project_id})
    if not proj or proj["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Hanya owner yang dapat menghapus tugas")
        
    await db.tasks.delete_one({"id": task_id, "project_id": project_id})
    return {"message": "Tugas berhasil dihapus"}

# --- DELIVERABLES ENDPOINTS ---
@api.post("/projects/{project_id}/tasks/{task_id}/submit")
async def submit_deliverable(project_id: str, task_id: str, req: DeliverableReq, current_user: dict = Depends(get_current_user)):
    task = await db.tasks.find_one({"id": task_id, "project_id": project_id})
    if not task:
        raise HTTPException(status_code=404, detail="Tugas tidak ditemukan")
        
    deliv_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    deliverable = {
        "id": deliv_id,
        "project_id": project_id,
        "task_id": task_id,
        "task_title": task["title"],
        "stage": task["stage"],
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "note": req.note or "",
        "drive_link": req.drive_link or "",
        "file_name": req.file_name or "",
        "created_at": now
    }
    await db.deliverables.insert_one(deliverable)
    deliverable.pop("_id", None)
    return deliverable

@api.get("/projects/{project_id}/deliverables")
async def list_deliverables(project_id: str, current_user: dict = Depends(get_current_user)):
    delivs = await db.deliverables.find({"project_id": project_id}, {"_id": 0}).sort("created_at", -1).to_list(length=100)
    return delivs

# --- DASHBOARD & NOTIFICATIONS ---
@api.get("/dashboard")
async def get_dashboard(current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]
    owned_projs = await db.projects.find({"owner_id": uid}).to_list(length=100)
    owned_ids = [p["id"] for p in owned_projs]
    
    mems = await db.project_members.find({"user_id": uid}).to_list(length=100)
    member_ids = [m["project_id"] for m in mems]
    all_proj_ids = list(set(owned_ids + member_ids))
    
    all_tasks = await db.tasks.find({"project_id": {"$in": all_proj_ids}}).to_list(length=500)
    my_tasks = [t for t in all_tasks if t.get("assignee", {}).get("id") == uid]
    
    stage_counts = {}
    for t in all_tasks:
        stg = t.get("stage", "Unknown")
        stage_counts[stg] = stage_counts.get(stg, 0) + 1
        
    emails = await db.email_logs.find({"user_id": uid}, {"_id": 0}).sort("sent_at", -1).to_list(length=10)
    
    return {
        "total_projects": len(all_proj_ids),
        "owned_projects": len(owned_ids),
        "total_tasks": len(all_tasks),
        "my_tasks": len(my_tasks),
        "stage_counts": stage_counts,
        "recent_emails": emails
    }

@api.get("/email-logs")
async def get_email_logs(current_user: dict = Depends(get_current_user)):
    logs = await db.email_logs.find({"user_id": current_user["id"]}, {"_id": 0}).sort("sent_at", -1).to_list(length=50)
    return logs

@api.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}

app.include_router(api)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
