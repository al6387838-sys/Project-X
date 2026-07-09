"""
Zero Trust Security Center — Automated Tests
============================================
PROJECT-X | Phase 3 | Sprint 024
"""

import pytest
from security_center import (
    SecurityCenter, ZeroTrustEngine, TrustLevel, 
    PasskeyManager, DeviceTrustManager, ThreatMonitor,
    SessionManager, AuditManager, EncryptionManager
)

def test_passkey_lifecycle():
    pm = PasskeyManager()
    user_id = "user_123"
    
    # Register
    cred = pm.register_passkey(user_id, "iPhone 15")
    assert cred["device_name"] == "iPhone 15"
    assert len(pm.get_user_passkeys(user_id)) == 1
    
    # Authenticate
    success = pm.authenticate(user_id, cred["credential_id"])
    assert success is True
    assert pm.get_user_passkeys(user_id)[0]["sign_count"] == 1

def test_zero_trust_evaluation():
    zta = ZeroTrustEngine()
    
    # Verified request
    level = zta.evaluate_request("u1", "d1", "Home", {"is_trusted_device": True})
    assert level == TrustLevel.VERIFIED
    
    # Risky request
    level = zta.evaluate_request("u1", "d1", "Mars", {
        "is_unusual_location": True,
        "is_anomalous_behavior": True
    })
    assert level == TrustLevel.NONE

def test_threat_detection():
    monitor = ThreatMonitor()
    user_id = "user_777"
    
    # Normal login
    monitor.analyze_event("login", user_id, {"location": "Sao Paulo"})
    assert len(monitor.get_active_alerts(user_id)) == 0
    
    # Suspicious login (New location)
    alert = monitor.analyze_event("login", user_id, {"location": "Moscow"})
    assert alert["type"] == "SUSPICIOUS_LOCATION"
    assert len(monitor.get_active_alerts(user_id)) == 1

def test_encryption_at_rest():
    em = EncryptionManager()
    data = {"secret": "life_graph_node_data"}
    
    encrypted = em.encrypt_at_rest(data)
    assert encrypted.startswith("ENC:")
    
    decrypted = em.decrypt_at_rest(encrypted)
    assert decrypted == data
    
    # Test rotation
    old_key_id = encrypted.split(":")[1]
    em.rotate_key()
    
    # Can still decrypt with old key (if keys are preserved)
    decrypted_after_rotation = em.decrypt_at_rest(encrypted)
    assert decrypted_after_rotation == data

def test_audit_logging():
    am = AuditManager()
    am.log_access("u1", "graph_node_001", "READ", "SUCCESS", {"device_id": "d1"})
    
    trail = am.get_resource_audit_trail("graph_node_001")
    assert len(trail) == 1
    assert trail[0]["action"] == "READ"

def test_security_score():
    sc = SecurityCenter()
    user_id = "u1"
    
    # Base score
    score_base = sc.calculate_security_score(user_id)
    
    # Add Passkey
    sc.passkeys.register_passkey(user_id, "MacBook")
    score_with_passkey = sc.calculate_security_score(user_id)
    
    assert score_with_passkey > score_base
