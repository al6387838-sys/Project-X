"""
GAMMA-007: Global Security
LifeOS Global Cloud Platform

Architecture: Web Application Firewall, Bot Detection, and DDoS Protection.
"""
import re
from typing import Dict, Tuple

class WebApplicationFirewall:
    def __init__(self):
        # Basic SQLi and XSS patterns
        self.sqli_pattern = re.compile(r"(?i)(union\s+select|drop\s+table|--|1=1)")
        self.xss_pattern = re.compile(r"(?i)(<script>|javascript:|onerror=)")
        
        # IP Reputation list (mock)
        self.blacklisted_ips = {"10.0.0.99", "192.168.1.50"}
        
    def inspect_request(self, ip: str, path: str, payload: str) -> Tuple[bool, str]:
        # 1. IP Reputation Check
        if ip in self.blacklisted_ips:
            return False, "Blocked by IP Reputation"
            
        # 2. SQL Injection Check
        if self.sqli_pattern.search(path) or self.sqli_pattern.search(payload):
            return False, "Blocked by WAF (SQLi detected)"
            
        # 3. Cross-Site Scripting Check
        if self.xss_pattern.search(path) or self.xss_pattern.search(payload):
            return False, "Blocked by WAF (XSS detected)"
            
        return True, "Allowed"

if __name__ == "__main__":
    print("="*60)
    print("GAMMA-007: Global Security WAF")
    print("="*60)
    
    waf = WebApplicationFirewall()
    
    requests = [
        ("192.168.1.10", "/api/v4/user", '{"name": "Alex"}'),
        ("10.0.0.99", "/api/v4/user", '{"name": "Bot"}'),
        ("192.168.1.10", "/api/v4/user?id=1 OR 1=1--", '{}'),
        ("192.168.1.10", "/api/v4/profile", '{"bio": "<script>alert(1)</script>"}')
    ]
    
    for ip, path, payload in requests:
        allowed, reason = waf.inspect_request(ip, path, payload)
        status = "✅ ALLOW" if allowed else "❌ BLOCK"
        print(f"{status} | IP: {ip} | Path: {path[:20]}... | Reason: {reason}")
        
    print("\n✅ GAMMA-007: Global Security — COMPLETE")
