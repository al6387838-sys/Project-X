"""
GAMMA-002: Multi-Region Cloud
LifeOS Global Cloud Platform

Architecture: Geo-routing, multi-zone failover, and global health checks.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional
import time
import random

class Region(Enum):
    US_EAST = "us-east-1"
    US_WEST = "us-west-2"
    EU_WEST = "eu-west-1"
    SA_EAST = "sa-east-1"
    AP_NORTHEAST = "ap-northeast-1"

@dataclass
class DataCenter:
    region: Region
    zone: str
    is_primary: bool
    health_score: float = 100.0
    latency_map: Dict[str, float] = None # Map of client region -> latency in ms

class GeoRouter:
    """Routes requests to the optimal region based on latency and health."""
    def __init__(self):
        self.datacenters = [
            DataCenter(Region.US_EAST, "us-east-1a", True, 100.0, {"NA": 15.0, "SA": 120.0, "EU": 85.0, "AS": 210.0}),
            DataCenter(Region.US_EAST, "us-east-1b", False, 100.0, {"NA": 16.0, "SA": 121.0, "EU": 86.0, "AS": 211.0}),
            DataCenter(Region.EU_WEST, "eu-west-1a", True, 100.0, {"NA": 85.0, "SA": 200.0, "EU": 12.0, "AS": 150.0}),
            DataCenter(Region.SA_EAST, "sa-east-1a", True, 100.0, {"NA": 120.0, "SA": 18.0, "EU": 200.0, "AS": 320.0}),
            DataCenter(Region.AP_NORTHEAST, "ap-northeast-1a", True, 100.0, {"NA": 210.0, "SA": 320.0, "EU": 150.0, "AS": 22.0}),
        ]

    def resolve_client_geo(self, ip_address: str) -> str:
        """Mock GeoIP resolution."""
        # Simple mock based on IP prefix
        if ip_address.startswith("18."): return "NA"
        if ip_address.startswith("82."): return "EU"
        if ip_address.startswith("177."): return "SA"
        if ip_address.startswith("103."): return "AS"
        return "NA" # Default

    def route_request(self, client_ip: str) -> Optional[DataCenter]:
        geo_zone = self.resolve_client_geo(client_ip)
        
        # Filter healthy DCs
        healthy_dcs = [dc for dc in self.datacenters if dc.health_score > 80.0]
        if not healthy_dcs:
            return None
            
        # Find DC with lowest latency for this geo
        best_dc = min(healthy_dcs, key=lambda dc: dc.latency_map.get(geo_zone, 999.0))
        return best_dc

    def simulate_region_failure(self, region: Region):
        """Simulate a complete region outage."""
        for dc in self.datacenters:
            if dc.region == region:
                dc.health_score = 0.0
                print(f"[ALERT] Region {region.value} marked as DOWN")

# Demo
if __name__ == "__main__":
    router = GeoRouter()
    print("="*60)
    print("GAMMA-002: Multi-Region Geo Routing")
    print("="*60)
    
    clients = [
        ("18.22.33.44", "New York (NA)"),
        ("82.11.22.33", "London (EU)"),
        ("177.10.20.30", "São Paulo (SA)"),
        ("103.44.55.66", "Tokyo (AS)")
    ]
    
    print("--- Normal Operation ---")
    for ip, loc in clients:
        dc = router.route_request(ip)
        print(f"Client {loc} -> Routed to {dc.region.value} (Zone: {dc.zone})")
        
    print("\n--- Simulating SA-EAST-1 Outage ---")
    router.simulate_region_failure(Region.SA_EAST)
    
    print("\n--- Failover Routing ---")
    for ip, loc in clients:
        dc = router.route_request(ip)
        print(f"Client {loc} -> Routed to {dc.region.value} (Zone: {dc.zone})")
        
    print("\n✅ GAMMA-002: Multi-Region Cloud — COMPLETE")
