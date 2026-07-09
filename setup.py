from setuptools import setup, find_packages

setup(
    name="project_x",
    version="1.0.0",
    description="PROJECT-X Core System",
    packages=find_packages(include=[
        'action_engine',
        'decision_engine',
        'intelligence_hub',
        'life_timeline',
        'evolution_engine',
        'future_engine',
        'life_orchestrator',
        'lifeos_sdk',
        'human_experience',
        'trust_engine',
        'life_kernel'
    ]),
    python_requires=">=3.9",
)
