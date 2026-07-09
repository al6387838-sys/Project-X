import time
from datetime import datetime
from security_center import (
    SecurityCenter, ZeroTrustEngine, TrustLevel, 
    PasskeyManager, DeviceTrustManager, ThreatMonitor,
    SessionManager, AuditManager, EncryptionManager
)

def run_demo():
    print("\n" + "█"*60)
    print("  PROJECT-X | PHASE 3 | SPRINT 024")
    print("  ZERO TRUST SECURITY — LIVE DEMO")
    print("█"*60)

    sc = SecurityCenter()
    zta = ZeroTrustEngine()
    pm = PasskeyManager()
    dtm = DeviceTrustManager()
    monitor = ThreatMonitor()
    sm = SessionManager()
    audit = AuditManager()
    em = EncryptionManager()

    USER_ID = "alex_lifeos"
    DEVICE_ID = "IPHONE_ALEX_01"

    print("\n[STEP 1] User Authentication with Passkey")
    cred = pm.register_passkey(USER_ID, "Alex's iPhone 15")
    print(f"  > Passkey registered for device: {cred['device_name']}")
    
    success = pm.authenticate(USER_ID, cred['credential_id'])
    if success:
        token = sm.create_session(USER_ID, DEVICE_ID)
        print(f"  > Authentication successful. Session token generated.")
        # Pre-register device and passkey in SecurityCenter to boost score
        sc.passkeys.register_passkey(USER_ID, "Alex's iPhone 15")
        sc.devices.register_device(USER_ID, DEVICE_ID, {"name": "Alex's iPhone 15"})
        print(f"  > Initial Security Score: {sc.calculate_security_score(USER_ID):.1f}/100")

    print("\n[STEP 2] Zero Trust Evaluation (Normal Access)")
    context_normal = {"is_trusted_device": True}
    trust_level = zta.evaluate_request(USER_ID, DEVICE_ID, "Sao Paulo, BR", context_normal)
    print(f"  > Access Request from Sao Paulo (Trusted Device)")
    print(f"  > Trust Level: {trust_level.name}")
    audit.log_access(USER_ID, "life_graph_root", "READ", "SUCCESS", {"device_id": DEVICE_ID, "location": "Sao Paulo"})
    print(f"  > Access to Life Graph AUDITED.")

    print("\n[STEP 3] Threat Detection: Suspicious Login from New Location")
    # First set a location
    monitor.analyze_event("login", USER_ID, {"location": "Sao Paulo", "device_id": DEVICE_ID})
    # Then change it
    metadata_suspicious = {"location": "Moscow, RU", "device_id": "UNKNOWN_DEVICE_99"}
    alert = monitor.analyze_event("login", USER_ID, metadata_suspicious)
    
    if alert:
        print(f"  > ALERT DETECTED: {alert['type']} ({alert['severity']})")
        print(f"  > Message: {alert['message']}")
        
        print("\n[STEP 4] Automatic Zero Trust Response")
        print("  > High risk detected. REVOKING ALL ACTIVE SESSIONS.")
        sm.revoke_all_user_sessions(USER_ID)
        is_valid = sm.validate_session(token)
        print(f"  > Previous session token valid? {is_valid}")
        
        print("\n  > RECOVERY INITIATED: User must re-authenticate with Passkey.")
        recovery_success = pm.authenticate(USER_ID, cred['credential_id'])
        if recovery_success:
            new_token = sm.create_session(USER_ID, DEVICE_ID)
            print(f"  > Recovery successful with Passkey. New secure session created.")
            
    print("\n[STEP 5] Security Audit Timeline")
    timeline = audit.get_user_security_timeline(USER_ID)
    for entry in timeline:
        print(f"  [{entry['timestamp']}] {entry['action']} on {entry['resource_id']} - {entry['status']}")

    print("\n" + "█"*60)
    print("  SPRINT 024 — ZERO TRUST SECURITY COMPLETED ✓")
    print("█"*60 + "\n")

if __name__ == "__main__":
    run_demo()
