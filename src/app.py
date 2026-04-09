"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

import os
import uuid
from pathlib import Path
from typing import Dict, List

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(
    title="Mergington High School API",
    description="API for viewing and signing up for extracurricular activities",
)

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount(
    "/static",
    StaticFiles(directory=os.path.join(Path(__file__).parent, "static")),
    name="static",
)

# In-memory activity database
activities: Dict[str, Dict] = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"],
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"],
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"],
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"],
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"],
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"],
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"],
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"],
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"],
    },
}

users = {
    "student@mergington.edu": {"password": "studentpass", "role": "student"},
    "provider@mergington.edu": {"password": "providerpass", "role": "provider"},
    "admin@mergington.edu": {"password": "adminpass", "role": "admin"},
}

active_tokens: Dict[str, str] = {}


class LoginRequest(BaseModel):
    email: str
    password: str


def get_token_from_header(authorization: str | None = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authentication token")
    return authorization.split(" ", 1)[1]


def get_current_user(token: str = Depends(get_token_from_header)) -> Dict[str, str]:
    if token not in active_tokens:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    email = active_tokens[token]
    user = users.get(email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid user")
    return {"email": email, "role": user["role"]}


def require_role(allowed_roles: List[str]):
    def role_dependency(current_user: Dict[str, str] = Depends(get_current_user)) -> Dict[str, str]:
        if current_user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return current_user

    return role_dependency


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.post("/auth/login")
def login(request: LoginRequest):
    email = request.email.lower()
    user = users.get(email)
    if not user or user["password"] != request.password:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = str(uuid.uuid4())
    active_tokens[token] = email
    return {"token": token, "role": user["role"], "email": email}


@app.post("/auth/logout")
def logout(token: str = Depends(get_token_from_header)):
    if token in active_tokens:
        del active_tokens[token]
    return {"message": "Logged out successfully"}


@app.get("/users/me")
def get_me(current_user: Dict[str, str] = Depends(get_current_user)):
    return current_user


@app.get("/dashboard")
def get_dashboard(current_user: Dict[str, str] = Depends(get_current_user)):
    role = current_user["role"]

    if role == "student":
        student_activities = [
            {"name": name, **details}
            for name, details in activities.items()
            if current_user["email"] in details["participants"]
        ]
        return {
            "role": role,
            "email": current_user["email"],
            "my_activities": student_activities,
            "message": "View your current signups and choose more activities.",
        }

    if role == "provider":
        provider_summary = [
            {
                "name": name,
                "participants": len(details["participants"]),
                "spots_left": details["max_participants"] - len(details["participants"]),
            }
            for name, details in activities.items()
        ]
        return {
            "role": role,
            "email": current_user["email"],
            "activity_summary": provider_summary,
            "message": "Review activity enrollment and prepare materials.",
        }

    return {
        "role": role,
        "email": current_user["email"],
        "activities": [
            {"name": name, **details, "spots_left": details["max_participants"] - len(details["participants"])}
            for name, details in activities.items()
        ],
        "message": "Admin dashboard with full activity visibility.",
    }


@app.get("/activities")
def get_activities():
    return activities


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(
    activity_name: str,
    email: str,
    current_user: Dict[str, str] = Depends(require_role(["student", "admin"])),
):
    """Sign up a student for an activity"""
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    activity = activities[activity_name]
    if email in activity["participants"]:
        raise HTTPException(status_code=400, detail="Student is already signed up")

    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(
    activity_name: str,
    email: str,
    current_user: Dict[str, str] = Depends(require_role(["student", "admin"])),
):
    """Unregister a student from an activity"""
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    activity = activities[activity_name]
    if email not in activity["participants"]:
        raise HTTPException(status_code=400, detail="Student is not signed up for this activity")

    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}
