import hashlib
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Initialize the backend server
app = FastAPI(title="AegisHer AI API")

# Allow the frontend browser/app to talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for hackathon demo
alerts_log = []

# Define what data the mobile client will send when an alert happens
class IncidentAlert(BaseModel):
    threat_type: str        # e.g., "Scream / Safe-Word Detected" or "Fall / Physical Grab"
    threat_score: float     # e.g., 0.92
    latitude: float         # GPS Latitude
    longitude: float        # GPS Longitude
    details: str            # Extra notes

@app.get("/")
def root():
    return {"message": "AegisHer AI Backend is Active"}

# Endpoint to trigger an emergency dispatch
@app.post("/api/trigger-alert")
def trigger_alert(alert: IncidentAlert):
    timestamp = datetime.now().isoformat()
    
    # Create a tamper-proof cryptographic hash simulating the cloud evidence vault
    evidence_payload = f"{timestamp}-{alert.threat_type}-{alert.latitude}-{alert.longitude}"
    immutable_hash = hashlib.sha256(evidence_payload.encode()).hexdigest()
    
    alert_record = {
        "id": len(alerts_log) + 1,
        "timestamp": timestamp,
        "threat_type": alert.threat_type,
        "threat_score": alert.threat_score,
        "latitude": alert.latitude,
        "longitude": alert.longitude,
        "vault_hash": immutable_hash,
        "status": "DISPATCHED"
    }
    
    # Save the record
    alerts_log.append(alert_record)
    
    print(f"\n[EMERGENCY TRIGGERED] Type: {alert.threat_type} | Score: {alert.threat_score}")
    print(f"Vault Evidence Hash: {immutable_hash}\n")
    
    return {
        "status": "SUCCESS",
        "message": "Emergency dispatch executed.",
        "incident": alert_record
    }

# Endpoint for the Guardian Dashboard to fetch recent alerts
@app.get("/api/get-alerts")
def get_alerts():
    return {"alerts": alerts_log}