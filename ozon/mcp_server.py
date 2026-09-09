"""MCP-сервер: даёт Claude инструменты для работы с кабинетом Ozon.

Запускается на вашей машине, ключи читает из окружения и наружу их не отдаёт —
в диалог попадают только ответы Ozon. Подключение (Claude Code):

    claude mcp add ozon -- python -m ozon.mcp_server

Нужен пакет mcp: pip install -r requirements-ozon.txt

Инструменты только на чтение доступны всегда. Инструменты, которые меняют
ставки и поставки, требуют apply=true и переменной OZON_ALLOW_WRITES=1 —
без неё Claude увидит отказ и объяснение, а не изменение в кабинете.
"""
from __future__ import annotations

import os
import sys
from typing import Any, Dict, List, Optional

# В mcp 2.x класс переименовали из FastMCP в MCPServer, декораторы и запуск
# остались прежними. Поддерживаем обе версии, чтобы сервер не зависел от того,
# какая из них встала при установке.
try:
    from mcp.server.mcpserver import MCPServer as _Server  # mcp 2.x
except ImportError:  # pragma: no cover - зависит от версии пакета
    try:
        from mcp.server.fastmcp import FastMCP as _Server  # mcp 1.x
    except ImportError as exc:
        raise SystemExit(
            "Не установлен пакет mcp. Поставьте его: pip install -r requirements-ozon.txt"
        ) from exc

from .config import load_credentials
from .errors import OzonApiError, OzonWriteBlocked
from .performance import PerformanceApi
from .safety import WriteGuard
from .seller import SellerApi
from .workflows import SupplyPlan, create_supply, plan_supply

server = _Server("ozon")


def _safe(call) -> Any:
    """Ошибку Ozon возвращаем текстом: Claude должен её прочитать, а не упасть."""
    try:
        return call()
    except (OzonApiError, OzonWriteBlocked) as exc:
        return {"error": str(exc)}


@server.tool()
def ozon_check() -> Dict[str, Any]:
    """Проверить, какие ключи Ozon доступны и разрешена ли запись."""
    creds = load_credentials()
    guard = WriteGuard.from_env()
    return {
        "seller_api": creds.has_seller,
        "performance_api": creds.has_performance,
        "writes_allowed": guard.writes_allowed,
        "max_bid": guard.max_bid,
        "max_bid_change_pct": guard.max_change_pct,
    }


# --------------------------------------------------------------- Seller API


@server.tool()
def ozon_supply_orders(limit: int = 50, states: Optional[List[str]] = None) -> Any:
    """Список заявок на поставку FBO с их статусами."""
    return _safe(lambda: SellerApi().supply_orders(limit=limit, states=states))


@server.tool()
def ozon_supply_order(supply_order_id: int) -> Any:
    """Подробности одной заявки на поставку: склад, таймслот, состав."""
    return _safe(lambda: SellerApi().supply_order([supply_order_id]))


@server.tool()
def ozon_supply_timeslots(supply_order_id: int, days: int = 14) -> Any:
    """Свободные интервалы приёмки для заявки на поставку."""
    return _safe(lambda: SellerApi().timeslots(supply_order_id, days=days))


@server.tool()
def ozon_stocks(on_warehouses: bool = False, limit: int = 100) -> Any:
    """Остатки товаров: по кабинету или в разрезе складов FBO."""
    api = SellerApi()
    return _safe(lambda: api.stocks_on_warehouses(limit=limit) if on_warehouses else api.stocks(limit=limit))


@server.tool()
def ozon_analytics(date_from: str = "", date_to: str = "", metrics: Optional[List[str]] = None) -> Any:
    """Аналитика продаж за период: заказы, выручка, просмотры, конверсия."""
    return _safe(
        lambda: SellerApi().analytics(
            date_from=date_from or None, date_to=date_to or None, metrics=metrics
        )
    )


@server.tool()
def ozon_supply_timeslot_update(
    supply_order_id: int,
    timeslot_from: str,
    timeslot_to: str,
    apply: bool = False,
    confirm: bool = False,
) -> Any:
    """Перенести поставку на другой интервал. Требует confirm=true."""
    return _safe(
        lambda: SellerApi().timeslot_update(
            supply_order_id=supply_order_id,
            timeslot_from=timeslot_from,
            timeslot_to=timeslot_to,
            apply=apply,
            confirm=confirm,
        )
    )


@server.tool()
def ozon_plan_supply(
    items: List[Dict[str, Any]],
    cluster_ids: Optional[List[int]] = None,
    days: int = 14,
) -> Any:
    """Подготовить поставку FBO: черновик, доступные склады и интервалы приёмки.

    items — [{"sku": 123456789, "quantity": 10}, ...]. Черновик ничего не
    отгружает и денег не стоит: это расчёт, который можно показать человеку
    и бросить. Заявку создаёт только ozon_create_supply.
    """

    def run() -> Any:
        plan = plan_supply(SellerApi(), items=items, cluster_ids=cluster_ids, days=days)
        return {
            "draft_id": plan.draft_id,
            "units": plan.units,
            "warehouses": plan.warehouses[:20],
            "timeslots": plan.timeslots[:20],
            "summary": plan.summary(),
        }

    return _safe(run)


@server.tool()
def ozon_create_supply(
    draft_id: int,
    warehouse_id: int,
    timeslot_from: str,
    timeslot_to: str,
    confirm: bool = False,
) -> Any:
    """Создать заявку на поставку из черновика ozon_plan_supply.

    Единственный шаг цепочки, который создаёт обязательство перед Ozon.
    Требует confirm=true — не ставьте его, пока человек не подтвердил
    склад, интервал и состав поставки.
    """
    plan = SupplyPlan(draft_id=draft_id, operation_id="", items=[])
    return _safe(
        lambda: create_supply(
            SellerApi(),
            plan,
            warehouse_id=warehouse_id,
            timeslot_from=timeslot_from,
            timeslot_to=timeslot_to,
            confirm=confirm,
        )
    )


@server.tool()
def ozon_cancel_supply(supply_order_id: int, confirm: bool = False) -> Any:
    """Отменить заявку на поставку. Требует confirm=true — действие необратимо."""
    return _safe(lambda: SellerApi().cancel_supply(supply_order_id, apply=True, confirm=confirm))


# ---------------------------------------------------------- Performance API


@server.tool()
def ozon_campaigns(state: str = "") -> Any:
    """Рекламные кампании кабинета и их состояние."""
    return _safe(lambda: PerformanceApi().campaigns(state=state))


@server.tool()
def ozon_campaign_bids(campaign_id: int) -> Any:
    """Товары кампании с текущими ставками."""
    return _safe(lambda: PerformanceApi().products(campaign_id))


@server.tool()
def ozon_ad_statistics(campaign_ids: List[int], date_from: str = "", date_to: str = "") -> Any:
    """Отчёт по кампаниям за период: показы, клики, расход, заказы."""

    def run() -> Any:
        api = PerformanceApi()
        task = api.statistics(campaign_ids, date_from=date_from or None, date_to=date_to or None)
        uuid = (task or {}).get("UUID") or (task or {}).get("uuid")
        return api.statistics_wait(str(uuid)) if uuid else task

    return _safe(run)


@server.tool()
def ozon_search_phrases(date_from: str = "", date_to: str = "") -> Any:
    """Показы и расход по поисковым фразам — что реально приводит трафик."""
    return _safe(lambda: PerformanceApi().phrases(date_from=date_from or None, date_to=date_to or None))


@server.tool()
def ozon_set_bid(campaign_id: int, sku: List[int], bid: float, apply: bool = False) -> Any:
    """Поставить ставку по товарам кампании. Без apply=true — сухой прогон."""
    return _safe(lambda: PerformanceApi().set_bids(campaign_id, {s: bid for s in sku}, apply=apply))


@server.tool()
def ozon_campaign_switch(campaign_id: int, turn_on: bool, apply: bool = False) -> Any:
    """Включить или выключить кампанию. Без apply=true — сухой прогон."""

    def run() -> Any:
        api = PerformanceApi()
        return api.activate(campaign_id, apply=apply) if turn_on else api.deactivate(campaign_id, apply=apply)

    return _safe(run)


@server.tool()
def ozon_raw_call(api: str, method: str, path: str, body: Optional[Dict[str, Any]] = None) -> Any:
    """Вызвать любой метод API по документации: api = "seller" или "performance"."""
    client: Any = SellerApi() if api == "seller" else PerformanceApi()
    return _safe(lambda: client.call(method, path, body))


def remote_server() -> Any:
    """Тот же сервер, но доступный по сети и только по вашему ключу.

    Нужен, когда спрашивать хочется с телефона: облачный Claude до домашнего
    компьютера не дотянется, а до адреса в интернете — да. Без ключа сервер
    не поднимается: открытый доступ к чужому кабинету недопустим.
    """
    import secrets as _secrets

    from mcp.server.auth.provider import AccessToken
    from mcp.server.auth.settings import AuthSettings

    token = (os.environ.get("OZON_MCP_TOKEN") or "").strip()
    if len(token) < 24:
        raise SystemExit(
            "Не задан OZON_MCP_TOKEN длиной хотя бы 24 символа.\n"
            "Это пароль к вашему кабинету — нужен длинный и случайный.\n"
            "Сгенерировать: python -m ozon.mcp_server --new-token"
        )

    url = (os.environ.get("OZON_MCP_URL") or "https://ozon.local").rstrip("/")

    class OwnerToken:
        """Пускает только по одному ключу — тому, что задан в окружении."""

        async def verify_token(self, offered: str) -> Optional[AccessToken]:
            if _secrets.compare_digest(offered, token):
                return AccessToken(
                    token=offered, client_id="owner", scopes=["ozon"], expires_at=None
                )
            return None

    remote = _Server(
        "ozon",
        token_verifier=OwnerToken(),
        auth=AuthSettings(
            issuer_url=url,
            resource_server_url=url,
            required_scopes=["ozon"],
            # Принадлежность токена проверяет наш собственный сверщик.
            validate_token_resource=False,
        ),
    )
    # Инструменты объявлены на локальном сервере — переносим их на сетевой,
    # чтобы список не пришлось описывать дважды.
    for tool in server._tool_manager.list_tools():
        remote._tool_manager._tools[tool.name] = tool
    return remote


def main(argv: Optional[List[str]] = None) -> None:
    args = list(argv if argv is not None else sys.argv[1:])
    if "--new-token" in args:
        import secrets as _secrets

        print(_secrets.token_urlsafe(32))
        return
    if "--ensure-token" in args:
        # Ключ доступа хранится там же, где ключи Ozon, и создаётся один раз.
        import secrets as _secrets

        from .config import save_env, value

        token = value("OZON_MCP_TOKEN")
        if not token or len(token) < 24:
            token = _secrets.token_urlsafe(32)
            save_env({"OZON_MCP_TOKEN": token})
        os.environ["OZON_MCP_TOKEN"] = token
        print(token)
        return
    if "--http" in args:
        # Адрес и порт задаются при запуске: в конструктор их класть нельзя.
        remote_server().run(
            transport="streamable-http",
            host=os.environ.get("OZON_MCP_HOST", "127.0.0.1"),
            port=int(os.environ.get("OZON_MCP_PORT", "8765")),
        )
        return
    server.run()


if __name__ == "__main__":
    main()
