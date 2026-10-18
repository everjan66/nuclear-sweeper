"""Optional release smoke: pip install playwright; python scripts/browser-smoke.py --help."""
import argparse
import asyncio
import json
import os
from pathlib import Path
import shutil
from playwright.async_api import async_playwright


class ManagedServer:
    """Own only the child process created by this runner, including restart."""
    def __init__(self, node):
        self.node = node
        self.process = None
        self.port = 0

    async def start(self):
        env = {**os.environ, "PORT": str(self.port), "BIND": "127.0.0.1", "ELECTRON_RUN_AS_NODE": "1"}
        # Avoid inheriting deployment secrets or ICE settings into a local test.
        for key in ["ALLOWED_ORIGIN", "TURN_SECRET", "TURN_URLS", "STUN_URL"]:
            env.pop(key, None)
        self.process = await asyncio.create_subprocess_exec(
            self.node, "services/signaling/server.cjs", cwd=Path(__file__).resolve().parent.parent,
            env=env, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            **({"creationflags": 0x08000000} if os.name == "nt" else {}))
        ready = await asyncio.wait_for(self.process.stdout.readline(), timeout=15)
        if not ready.startswith(b"Nuclear Sweeper: http://127.0.0.1:"):
            raise RuntimeError("Local signaling server failed to start: " + ready.decode(errors="replace"))
        url = ready.decode().strip().split(" ")[-1]
        self.port = int(url.rsplit(":", 1)[1])
        return url

    async def stop(self):
        if self.process and self.process.returncode is None:
            self.process.terminate()
            try:
                await asyncio.wait_for(self.process.wait(), timeout=5)
            except TimeoutError:
                self.process.kill()
                await self.process.wait()

    async def restart(self):
        await self.stop()
        return await self.start()


async def smoke(args, server=None):
    errors = []
    async with async_playwright() as playwright:
        browser_type = getattr(playwright, args.browser)
        options = {"headless": True}
        if args.executable:
            options["executable_path"] = args.executable
        if args.browser == "chromium":
            options["args"] = ["--enable-unsafe-swiftshader", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"]
        browser = await browser_type.launch(**options)
        contexts, pages = [], []
        solo_context = await browser.new_context(viewport={"width": 390, "height": 844})
        await solo_context.add_init_script("window.requestAnimationFrame=()=>0;")
        solo = await solo_context.new_page()
        solo.on("pageerror", lambda error: errors.append(str(error)))
        await solo.goto(args.url)
        assert await solo.evaluate("document.querySelector('#coop-menu').scrollWidth<=document.querySelector('#coop-menu').clientWidth")
        await solo.locator("#coop-solo").click()
        await solo.evaluate("S.cred=123;save()")
        await solo.reload()
        await solo.locator("#coop-solo").click()
        assert await solo.evaluate("S.cred") == 123
        await solo.goto(args.url + "/nuclear-sweeper-dev.html")
        dev = solo.frame_locator("iframe")
        await dev.locator("#coop-solo").click()
        await dev.locator('[data-dev="max-all"]').click()
        assert await dev.locator("#dev-panel").evaluate("() => S.L.boots===30&&S.mod.gr===1&&JSON.parse(localStorage.getItem('nsr1')).cred===123")
        await solo_context.close()
        # Drive simulation separately from rendering to keep this network/UI test
        # usable on software WebGL. The real render path is checked explicitly below.
        async def driver(page):
            await page.evaluate("""() => {releaseInput={};releaseTimer=setInterval(()=>{if(coopSession?.view()){coopSession.advance(1/64,{yaw:0,pit:0,menu:true,weapon:coopWeapon,...releaseInput});applyCoopView();}},1000/64);} """)
        for index in range(4):
            context = await browser.new_context(viewport={"width": 1024, "height": 720})
            await context.add_init_script("globalThis.releaseInput={};window.requestAnimationFrame=()=>0;")
            page = await context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            contexts.append(context)
            pages.append(page)
        host = pages[0]
        await host.goto(args.url + "/?dev=1&release-smoke=host")
        await driver(host)
        await host.locator("#coop-host").click()
        await host.wait_for_function("coopSession?.view()?.role==='host'", polling=100)
        await host.wait_for_function("document.querySelector('#coop-share').value.includes('#coop=')", polling=100)
        invite = await host.locator("#coop-share").input_value()
        for page in pages[1:]:
            await page.goto(invite)
            await driver(page)
            await page.locator("#coop-join").click()
            await page.wait_for_function("coopSession?.view()?.role==='guest'&&!coopSession.view().waiting", polling=100)
        await host.wait_for_function("Object.values(coopSession.view().world.players).filter(p=>p.connected).length===4", polling=100)
        await host.evaluate("coopSession.setPaused(false)")
        ids = [await page.evaluate("coopSession.view().localId") for page in pages]
        await host.evaluate("""() => {coopSession.devCommand('max');applyCoopView();const p=coopSession.view().player;p.prog.weapons[3]={kills:60,types:[30,10,0,0]};setW(3);} """)
        await pages[1].wait_for_function("coopSession.view().remote.some(p=>p.wi===3&&p.appearance.tier===1)", polling=100)
        await host.evaluate("""() => {const w=coopSession.view().world;for(const p of Object.values(w.players))p.L.w3=1;}""")
        await pages[1].wait_for_function("S.L.w3===1", polling=100)
        await pages[1].locator('#wb .slot[data-i="3"]').evaluate("el=>el.click()")
        await pages[1].wait_for_function("coopSession.view().player.wi===3", polling=100)
        await pages[1].evaluate("releaseInput={fw:true,menu:false}")
        start_z = await pages[1].evaluate("coopSession.view().player.pose.z")
        await pages[1].wait_for_function("Math.abs(coopSession.view().player.pose.z-" + str(start_z) + ")>.5", polling=100)
        await pages[1].evaluate("releaseInput={}")
        await host.evaluate("""() => {const p=coopSession.view().player;p.pose.gr={x:p.pose.x+3,y:3,z:p.pose.z-3,t:0};coopSession.setPaused(true);} """)
        for page in pages[1:]:
            await page.wait_for_function("coopSession.view().paused", polling=100)
        visual = await pages[1].evaluate("""() => {applyCoopView();draw();const member=coopSession.view().remote.find(p=>p.wi===3&&p.appearance.tier===1),model=sc.getObjectByName('sweeper:'+member.id),weapon=model.getObjectByName('equipped-weapon');return {counts:remotePlayers.stats(),width:weapon.children[0].scale.x,expectedWidth:WP[3].vm[1],suppressor:weapon.children[4].visible,color:weapon.children[0].material.color.getHex(),expectedColor:TIERS[1].col};} """)
        assert visual["counts"] == {"players": 3, "ropes": 1}, visual
        assert visual["width"] == visual["expectedWidth"] and visual["suppressor"], visual
        assert visual["color"] == visual["expectedColor"], visual
        await host.evaluate("""() => {const w=coopSession.view().world;for(const p of Object.values(w.players)){p.pose=NSR.Movement.createPose(w.SH);p.move={};}w.D.fill(0);w.rem=0;w.clr=1;coopSession.setPaused(false);} """)
        for page in pages:
            await page.wait_for_function("!coopSession.view().paused", polling=100)
            answer = await page.evaluate("coopSession.perform('ready',{value:true})")
            assert answer["ok"], answer
        answer = await host.evaluate("coopSession.perform('deploy')")
        assert answer["ok"], answer
        for page in pages[1:]:
            await page.wait_for_function("coopSession.view().world.generation===2", polling=100)
        await pages[1].reload()
        await driver(pages[1])
        await pages[1].locator("#coop-join").click()
        await pages[1].wait_for_function("coopSession?.view()?.role==='guest'&&!coopSession.view().waiting", polling=100)
        assert await pages[1].evaluate("coopSession.view().localId") == ids[1]
        # Fail signaling requests while leaving actual RTC data channels intact.
        # Each long poll must fail before checking continuity, and later succeed
        # before checking recovery; this does not restart the server or TURN.
        signaling_down = True
        failed_polls = [asyncio.Event() for _ in contexts]
        for index, context in enumerate(contexts):
            async def signaling_route(route, request, *, index=index):
                if signaling_down:
                    await route.abort("connectionfailed")
                    if "/api/poll?" in route.request.url:
                        failed_polls[index].set()
                else:
                    await route.continue_()
            await context.route("**/api/**", signaling_route)
        await asyncio.wait_for(asyncio.gather(*(event.wait() for event in failed_polls)), timeout=35)
        outage_tick = await host.evaluate("coopSession.view().world.tick")
        await host.wait_for_function("tick => coopSession.view().world.tick > tick + 128", arg=outage_tick, polling=100)
        for page in pages:
            assert await page.evaluate("!coopSession.view().waiting && coopSession.stats().peers.length===" + ("3" if page == host else "1"))
            answer = await page.evaluate("coopSession.perform('ready',{value:true})")
            assert answer["ok"], answer
        signaling_down = False
        for page in pages:
            await page.wait_for_function("document.querySelector('#coop-status').textContent.includes('Signaling reconnected')", polling=100, timeout=45000)
        await pages[1].reload()
        await driver(pages[1])
        await pages[1].locator("#coop-join").click()
        await pages[1].wait_for_function("coopSession?.view()?.role==='guest'&&!coopSession.view().waiting", polling=100)
        assert await pages[1].evaluate("coopSession.view().localId") == ids[1]
        await host.wait_for_function("Object.values(coopSession.view().world.players).filter(p=>p.connected).length===4", polling=100)
        if server:
            before_restart = await host.evaluate("({worldId:coopSession.exportCheckpoint().worldId,sector:coopSession.view().world.sector,gear:Object.fromEntries(Object.values(coopSession.view().world.players).map(p=>[p.id,p.L]))})")
            assert await server.restart() == args.url
            for page in pages:
                await page.wait_for_function("coopSession.stats().signaling==='expired'", polling=100, timeout=35000)
                assert "HOST / CONTINUE WORLD" in await page.locator("#coop-status").inner_text()
                assert await page.evaluate("!coopSession.view().waiting")
                answer = await page.evaluate("coopSession.perform('ready',{value:true})")
                assert answer["ok"], answer
            async with host.expect_navigation(wait_until="load"):
                await host.locator("#coop-leave").evaluate("el=>el.click()")
            await host.locator("#coop-host").wait_for(state="visible")
            await driver(host)
            await host.locator("#coop-host").click()
            await host.wait_for_function("coopSession?.view()?.role==='host'", polling=100)
            await host.wait_for_function("document.querySelector('#coop-share').value.includes('#coop=')", polling=100)
            invite = await host.locator("#coop-share").input_value()
            for page in pages[1:]:
                await page.goto(invite)
                await page.reload()
                await driver(page)
                await page.locator("#coop-join").click()
                await page.wait_for_function("coopSession?.view()?.role==='guest'&&!coopSession.view().waiting", polling=100)
            await host.wait_for_function("Object.values(coopSession.view().world.players).filter(p=>p.connected).length===4", polling=100)
            after_restart = await host.evaluate("({worldId:coopSession.exportCheckpoint().worldId,sector:coopSession.view().world.sector,gear:Object.fromEntries(Object.values(coopSession.view().world.players).map(p=>[p.id,p.L]))})")
            assert after_restart == before_restart, (before_restart, after_restart)
            assert [await page.evaluate("coopSession.view().localId") for page in pages] == ids
        disposal = await pages[1].evaluate("""() => {remotePlayers.update(coopSession.view().remote);const models=coopSession.view().remote.map(p=>sc.getObjectByName('sweeper:'+p.id));let disposed=0;for(const model of models)model.getObjectByName('equipped-weapon').children[0].geometry.addEventListener('dispose',()=>disposed++);remotePlayers.clear();return {disposed,remaining:remotePlayers.stats().players};} """)
        assert disposal == {"disposed": 3, "remaining": 0}, disposal
        assert not errors, errors
        print(json.dumps({"browser": args.browser, "version": browser.version, "clients": 4, "transport": "real WebRTC / localhost", "checks": ["narrow mode menu", "normal solo save round trip", "developer iframe/max loadout isolation", "join", "host-confirmed hotbar selection", "movement", "equipped weapon, attachments and mastery", "grapple rope", "pause", "deployment", "guest reload/reconnect", "signaling request outage with RTC continuity", "signaling recovery and identity-preserving rejoin", "avatar disposal"] + (["signaling process restart with RTC continuity", "checkpoint rehost preserves world and all four identities"] if server else []), "errors": errors}, indent=2))
        for page in pages:
            await page.evaluate("coopSession?.close()")
        await browser.close()


async def main(args):
    server = ManagedServer(args.node) if args.managed_server else None
    try:
        if server:
            args.url = await server.start()
        await smoke(args, server)
    finally:
        if server:
            await server.stop()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Four independent browser contexts; requires a running npm start service and Python Playwright.")
    parser.add_argument("--url", default="http://127.0.0.1:8787")
    parser.add_argument("--browser", choices=["chromium", "firefox"], default="chromium")
    parser.add_argument("--executable", help="Optional browser executable; otherwise use Playwright's installed browser.")
    parser.add_argument("--managed-server", action="store_true", help="Start an isolated local server and verify process restart plus checkpoint rehost.")
    parser.add_argument("--node", default=shutil.which("node") or "node", help="Node.js executable for --managed-server.")
    asyncio.run(main(parser.parse_args()))
