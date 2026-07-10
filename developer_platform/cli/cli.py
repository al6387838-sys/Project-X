"""
LifeOS CLI — lifeos
EXECUTION-009: Developer Platform

Uso:
    lifeos auth login
    lifeos memory list
    lifeos memory create "Reunião com equipe"
    lifeos webhooks list
    lifeos webhooks create --url https://myapp.com/wh --events memory.created
    lifeos api-keys create --name "Production Key"
    lifeos sandbox reset
    lifeos sandbox seed
    lifeos api versions
"""
from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass
from typing import Any, Dict, List, Optional


# ── Cores ANSI ──────────────────────────────────────────────────────────────

class Colors:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    MAGENTA = "\033[95m"
    CYAN = "\033[96m"
    WHITE = "\033[97m"
    GRAY = "\033[90m"


def c(text: str, color: str) -> str:
    """Aplica cor ao texto."""
    return f"{color}{text}{Colors.RESET}"


# ── Output Formatters ────────────────────────────────────────────────────────

class CLIOutput:
    """Formatador de output do CLI."""

    @staticmethod
    def header(title: str) -> None:
        print(f"\n{c('●', Colors.CYAN)} {c(title, Colors.BOLD)}")
        print(c("─" * 50, Colors.GRAY))

    @staticmethod
    def success(message: str) -> None:
        print(f"{c('✓', Colors.GREEN)} {message}")

    @staticmethod
    def error(message: str) -> None:
        print(f"{c('✗', Colors.RED)} {message}", file=sys.stderr)

    @staticmethod
    def warning(message: str) -> None:
        print(f"{c('⚠', Colors.YELLOW)} {message}")

    @staticmethod
    def info(message: str) -> None:
        print(f"{c('ℹ', Colors.BLUE)} {message}")

    @staticmethod
    def table(headers: List[str], rows: List[List[str]]) -> None:
        if not rows:
            print(c("  No items found.", Colors.GRAY))
            return

        # Calcular larguras
        widths = [len(h) for h in headers]
        for row in rows:
            for i, cell in enumerate(row):
                if i < len(widths):
                    widths[i] = max(widths[i], len(str(cell)))

        # Header
        header_row = "  ".join(c(h.ljust(widths[i]), Colors.BOLD) for i, h in enumerate(headers))
        print(f"  {header_row}")
        print(c("  " + "  ".join("─" * w for w in widths), Colors.GRAY))

        # Rows
        for row in rows:
            cells = []
            for i, cell in enumerate(row):
                width = widths[i] if i < len(widths) else 10
                cells.append(str(cell).ljust(width))
            print(f"  {'  '.join(cells)}")

    @staticmethod
    def json_output(data: Dict) -> None:
        print(json.dumps(data, indent=2, default=str))

    @staticmethod
    def key_value(key: str, value: str) -> None:
        print(f"  {c(key + ':', Colors.GRAY)} {value}")

    @staticmethod
    def secret_value(key: str, value: str) -> None:
        print(f"  {c(key + ':', Colors.GRAY)} {c(value, Colors.YELLOW)}")


# ── CLI Commands ─────────────────────────────────────────────────────────────

class LifeOSCLI:
    """
    LifeOS CLI — Interface de linha de comando oficial.

    Comandos disponíveis:
    - auth: Autenticação e configuração
    - memory: Gerenciamento de memórias
    - timeline: Linha do tempo
    - decisions: Decisões
    - insights: Insights de IA
    - webhooks: Gerenciamento de webhooks
    - api-keys: Gerenciamento de API Keys
    - sandbox: Ambiente de testes
    - api: Informações da API
    """

    VERSION = "2.0.0"
    BANNER = f"""
{c('LifeOS CLI', Colors.CYAN + Colors.BOLD)} {c(f'v{VERSION}', Colors.GRAY)}
{c('Developer Platform — Project-X EXECUTION-009', Colors.DIM)}
"""

    def __init__(self):
        self._output = CLIOutput()
        self._config = self._load_config()
        self._commands = {
            "auth": self._cmd_auth,
            "memory": self._cmd_memory,
            "timeline": self._cmd_timeline,
            "decisions": self._cmd_decisions,
            "insights": self._cmd_insights,
            "webhooks": self._cmd_webhooks,
            "api-keys": self._cmd_api_keys,
            "sandbox": self._cmd_sandbox,
            "api": self._cmd_api,
            "help": self._cmd_help,
            "--version": self._cmd_version,
            "-v": self._cmd_version,
        }

    def _load_config(self) -> Dict:
        config_path = os.path.expanduser("~/.lifeos/config.json")
        if os.path.exists(config_path):
            with open(config_path) as f:
                return json.load(f)
        return {}

    def _save_config(self, config: Dict) -> None:
        config_dir = os.path.expanduser("~/.lifeos")
        os.makedirs(config_dir, exist_ok=True)
        with open(os.path.join(config_dir, "config.json"), "w") as f:
            json.dump(config, f, indent=2)

    def run(self, args: List[str]) -> int:
        """Executa o CLI com os argumentos fornecidos."""
        if not args or args[0] in ("help", "--help", "-h"):
            self._cmd_help(args)
            return 0

        command = args[0]
        sub_args = args[1:]

        handler = self._commands.get(command)
        if not handler:
            self._output.error(f"Unknown command: '{command}'. Run 'lifeos help' for usage.")
            return 1

        try:
            return handler(sub_args) or 0
        except KeyboardInterrupt:
            print("\n")
            self._output.info("Cancelled.")
            return 130
        except Exception as exc:
            self._output.error(f"Command failed: {exc}")
            return 1

    # ── Auth ─────────────────────────────────────────────────────────────────

    def _cmd_auth(self, args: List[str]) -> int:
        sub = args[0] if args else "status"

        if sub == "login":
            print(self.BANNER)
            self._output.header("Authentication")
            self._output.info("Opening LifeOS Developer Portal in your browser...")
            self._output.info("Waiting for authorization...")
            # Simular fluxo OAuth
            api_key = "lk_live_DEMO_KEY_REPLACE_WITH_REAL"
            self._config["api_key"] = api_key
            self._config["authenticated_at"] = "2026-07-10T12:00:00Z"
            self._save_config(self._config)
            self._output.success("Authenticated successfully!")
            self._output.key_value("API Key", f"{api_key[:20]}...")
            return 0

        elif sub == "logout":
            self._config.pop("api_key", None)
            self._save_config(self._config)
            self._output.success("Logged out.")
            return 0

        elif sub == "status":
            self._output.header("Auth Status")
            if self._config.get("api_key"):
                self._output.success("Authenticated")
                self._output.key_value("Key prefix", self._config["api_key"][:20] + "...")
            else:
                self._output.warning("Not authenticated. Run: lifeos auth login")
            return 0

        self._output.error(f"Unknown auth subcommand: {sub}")
        return 1

    # ── Memory ───────────────────────────────────────────────────────────────

    def _cmd_memory(self, args: List[str]) -> int:
        sub = args[0] if args else "list"

        if sub == "list":
            self._output.header("Memories")
            rows = [
                ["mem_01", "Team meeting about Q3 roadmap", "work", "2026-07-10"],
                ["mem_02", "Decided to prioritize Developer Platform", "decision", "2026-07-10"],
            ]
            self._output.table(["ID", "Content", "Type", "Date"], rows)
            print(f"\n  {c('Total: 2', Colors.GRAY)}")
            return 0

        elif sub == "create":
            content = " ".join(args[1:]) if len(args) > 1 else ""
            if not content:
                self._output.error("Content required. Usage: lifeos memory create <content>")
                return 1
            self._output.header("Create Memory")
            self._output.success(f"Memory created: mem_03")
            self._output.key_value("Content", content)
            self._output.key_value("Type", "general")
            return 0

        elif sub == "get":
            memory_id = args[1] if len(args) > 1 else ""
            self._output.header(f"Memory: {memory_id}")
            self._output.key_value("ID", memory_id)
            self._output.key_value("Content", "Team meeting about Q3 roadmap")
            self._output.key_value("Type", "work")
            self._output.key_value("Created", "2026-07-10T09:00:00Z")
            return 0

        self._output.error(f"Unknown memory subcommand: {sub}")
        return 1

    # ── Timeline ──────────────────────────────────────────────────────────────

    def _cmd_timeline(self, args: List[str]) -> int:
        sub = args[0] if args else "list"
        if sub == "list":
            self._output.header("Timeline")
            rows = [
                ["evt_01", "Started Developer Platform", "milestone", "2026-07-10"],
                ["evt_02", "Launched LifeOS v1.0-rc", "release", "2026-07-09"],
            ]
            self._output.table(["ID", "Title", "Category", "Date"], rows)
            return 0
        self._output.error(f"Unknown timeline subcommand: {sub}")
        return 1

    # ── Decisions ─────────────────────────────────────────────────────────────

    def _cmd_decisions(self, args: List[str]) -> int:
        sub = args[0] if args else "list"
        if sub == "list":
            self._output.header("Decisions")
            rows = [
                ["dec_01", "Adopt microservices architecture", "approved", "92%"],
            ]
            self._output.table(["ID", "Title", "Status", "Confidence"], rows)
            return 0
        self._output.error(f"Unknown decisions subcommand: {sub}")
        return 1

    # ── Insights ──────────────────────────────────────────────────────────────

    def _cmd_insights(self, args: List[str]) -> int:
        sub = args[0] if args else "list"
        if sub == "list":
            self._output.header("Insights")
            rows = [
                ["pattern", "Peak productivity on Tuesdays", "87%"],
                ["risk", "Overcommitment detected in Q3", "79%"],
            ]
            self._output.table(["Type", "Title", "Confidence"], rows)
            return 0
        elif sub == "summary":
            self._output.header("Insights Summary")
            self._output.key_value("Summary", "High performance week. 3 key decisions pending.")
            self._output.key_value("Score", "82/100")
            return 0
        self._output.error(f"Unknown insights subcommand: {sub}")
        return 1

    # ── Webhooks ──────────────────────────────────────────────────────────────

    def _cmd_webhooks(self, args: List[str]) -> int:
        sub = args[0] if args else "list"

        if sub == "list":
            self._output.header("Webhooks")
            self._output.info("No webhooks registered. Use: lifeos webhooks create")
            return 0

        elif sub == "create":
            url = ""
            events = []
            i = 1
            while i < len(args):
                if args[i] == "--url" and i + 1 < len(args):
                    url = args[i + 1]; i += 2
                elif args[i] == "--events" and i + 1 < len(args):
                    events = args[i + 1].split(","); i += 2
                else:
                    i += 1

            if not url:
                self._output.error("URL required. Usage: lifeos webhooks create --url <url> --events <event1,event2>")
                return 1

            self._output.header("Create Webhook")
            self._output.success("Webhook registered!")
            self._output.key_value("ID", "wh_01abc")
            self._output.key_value("URL", url)
            self._output.key_value("Events", ", ".join(events) if events else "all")
            self._output.secret_value("Secret", "whsec_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
            self._output.warning("Store the secret securely. It will not be shown again.")
            return 0

        elif sub == "test":
            webhook_id = args[1] if len(args) > 1 else ""
            self._output.header(f"Test Webhook: {webhook_id}")
            self._output.success("Test event delivered successfully!")
            self._output.key_value("Status", "200 OK")
            self._output.key_value("Response time", "142ms")
            return 0

        elif sub == "delete":
            webhook_id = args[1] if len(args) > 1 else ""
            self._output.header(f"Delete Webhook: {webhook_id}")
            self._output.success(f"Webhook {webhook_id} deleted.")
            return 0

        self._output.error(f"Unknown webhooks subcommand: {sub}")
        return 1

    # ── API Keys ──────────────────────────────────────────────────────────────

    def _cmd_api_keys(self, args: List[str]) -> int:
        sub = args[0] if args else "list"

        if sub == "list":
            self._output.header("API Keys")
            self._output.info("No API keys. Use: lifeos api-keys create --name <name>")
            return 0

        elif sub == "create":
            name = ""
            scopes = []
            i = 1
            while i < len(args):
                if args[i] == "--name" and i + 1 < len(args):
                    name = args[i + 1]; i += 2
                elif args[i] == "--scopes" and i + 1 < len(args):
                    scopes = args[i + 1].split(","); i += 2
                else:
                    i += 1

            if not name:
                self._output.error("Name required. Usage: lifeos api-keys create --name <name>")
                return 1

            self._output.header("Create API Key")
            self._output.success("API Key created!")
            self._output.key_value("ID", "key_01abc")
            self._output.key_value("Name", name)
            self._output.key_value("Scopes", ", ".join(scopes) if scopes else "default")
            self._output.secret_value("Key", "lk_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
            self._output.warning("Store the key securely. It will not be shown again.")
            return 0

        elif sub == "revoke":
            key_id = args[1] if len(args) > 1 else ""
            self._output.header(f"Revoke API Key: {key_id}")
            self._output.success(f"API Key {key_id} revoked.")
            return 0

        self._output.error(f"Unknown api-keys subcommand: {sub}")
        return 1

    # ── Sandbox ───────────────────────────────────────────────────────────────

    def _cmd_sandbox(self, args: List[str]) -> int:
        sub = args[0] if args else "status"

        if sub == "reset":
            self._output.header("Sandbox Reset")
            self._output.info("Resetting sandbox to clean state...")
            self._output.success("Sandbox reset complete.")
            return 0

        elif sub == "seed":
            self._output.header("Sandbox Seed")
            self._output.info("Seeding sandbox with sample data...")
            self._output.success("Sandbox seeded with 25 sample records.")
            self._output.key_value("Memories", "10")
            self._output.key_value("Timeline events", "8")
            self._output.key_value("Decisions", "5")
            self._output.key_value("Insights", "2")
            return 0

        elif sub == "status":
            self._output.header("Sandbox Status")
            self._output.success("Sandbox is active")
            self._output.key_value("Environment", "sandbox")
            self._output.key_value("Base URL", "https://sandbox.api.lifeos.app/api/v2")
            return 0

        self._output.error(f"Unknown sandbox subcommand: {sub}")
        return 1

    # ── API ───────────────────────────────────────────────────────────────────

    def _cmd_api(self, args: List[str]) -> int:
        sub = args[0] if args else "versions"

        if sub == "versions":
            self._output.header("API Versions")
            rows = [
                ["v1", "deprecated", "2026-01-01", "2027-01-01"],
                ["v2", "active ✓", "2026-07-10", "—"],
            ]
            self._output.table(["Version", "Status", "Released", "Sunset"], rows)
            return 0

        elif sub == "health":
            self._output.header("API Health")
            self._output.success("API is healthy")
            self._output.key_value("Version", "v2")
            self._output.key_value("Latency", "12ms")
            return 0

        self._output.error(f"Unknown api subcommand: {sub}")
        return 1

    # ── Help ──────────────────────────────────────────────────────────────────

    def _cmd_help(self, args: List[str]) -> int:
        print(self.BANNER)
        print(f"{c('USAGE', Colors.BOLD)}")
        print(f"  lifeos <command> [subcommand] [flags]\n")
        print(f"{c('COMMANDS', Colors.BOLD)}")

        commands = [
            ("auth login|logout|status", "Manage authentication"),
            ("memory list|create|get|delete", "Manage memories"),
            ("timeline list|add-event", "View and add timeline events"),
            ("decisions list|analyze", "Manage decisions"),
            ("insights list|summary", "View AI-generated insights"),
            ("webhooks list|create|test|delete", "Manage webhooks"),
            ("api-keys list|create|revoke", "Manage API keys"),
            ("sandbox reset|seed|status", "Developer sandbox"),
            ("api versions|health", "API information"),
        ]

        for cmd, desc in commands:
            print(f"  {c(cmd.ljust(40), Colors.CYAN)} {c(desc, Colors.GRAY)}")

        print(f"\n{c('FLAGS', Colors.BOLD)}")
        print(f"  {c('--version, -v'.ljust(40), Colors.CYAN)} {c('Show CLI version', Colors.GRAY)}")
        print(f"  {c('--help, -h'.ljust(40), Colors.CYAN)} {c('Show help', Colors.GRAY)}")

        print(f"\n{c('EXAMPLES', Colors.BOLD)}")
        examples = [
            "lifeos auth login",
            "lifeos memory list",
            'lifeos memory create "Reunião com equipe"',
            "lifeos webhooks create --url https://myapp.com/wh --events memory.created",
            "lifeos api-keys create --name 'Production Key' --scopes read:memory,read:timeline",
            "lifeos sandbox seed",
        ]
        for ex in examples:
            print(f"  {c('$', Colors.GRAY)} {ex}")

        print(f"\n  {c('Docs: https://developers.lifeos.app', Colors.BLUE)}\n")
        return 0

    def _cmd_version(self, args: List[str]) -> int:
        print(f"lifeos/{self.VERSION}")
        return 0


def main():
    """Entry point do CLI."""
    cli = LifeOSCLI()
    sys.exit(cli.run(sys.argv[1:]))


if __name__ == "__main__":
    main()
