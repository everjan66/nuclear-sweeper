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


async def sweeper_check(page):
    result = await page.evaluate("""() => {
      S.boss=NSR.Boss.create(S.sector,'sweeper');S.bossDead=0;S.clr=0;genMap(S.sector);
      const world=bossWorld();NSR.Boss.seedDust(world);syncBossWorld(world);
      shopOpen=false;setOpen=false;devOpen=false;resumePending=false;paused=false;
      document.querySelector('#shop').style.display='none';
      const devPanel=document.querySelector('#dev-panel');if(devPanel)devPanel.style.display='none';
      Object.assign(p,{x:60,z:70,h:0,yaw:-Math.PI/4,pit:.08});camCalc();draw();
      const visual=W3.userData.boss,model=visual.sweeper,details=model.userData.sweeperVisuals;
      if(!model.visible||!details.nozzle.visible||!document.querySelector('#boss-hud strong').textContent.includes('MELTDOWN'))throw Error('Sweeper model/HUD missing');
      tickBoss(0);draw();
      if(S.boss.spawnWarning?.units.length!==3||visual.spawnMarkers.filter(marker=>marker.visible).length!==3||!document.querySelector('#boss-status').textContent.includes('MAGENTA BEACONS'))throw Error('Sweeper reinforcement warning/beacons missing');
      save();const reinforcementWarning=load();
      if(reinforcementWarning?.boss.spawnWarning?.units.length!==3||reinforcementWarning.boss.summonedPhase!==1)throw Error('Reinforcement warning save round trip failed');
      tickBoss(1.5);draw();
      if(E.length!==3||E.some(enemy=>!enemy.bossMinion)||!E.some(enemy=>ET[enemy.t].fly)||visual.spawnMarkers.some(marker=>marker.visible)||!document.querySelector('#boss-status').textContent.includes('3 ENEMIES'))throw Error('Sweeper guards, flyer, enemy HUD count or beacon expiry failed');
      save();const reinforcementSave=load();
      if(reinforcementSave?.bossEnemies?.length!==3||reinforcementSave.bossEnemies.some(enemy=>!enemy.bossMinion))throw Error('Live reinforcement save round trip failed');
      world.D.fill(0);world.rem=0;NSR.Boss.step(world,[],0);
      if(S.boss.state!=='shielded')throw Error('Cleanup bypassed the dodge gate');
      const target={id:'solo',pose:{x:56,z:58,h:0}};S.boss.attack=0;
      NSR.Boss.step(world,[target],0);syncBossWorld(world);draw();
      if(!visual.lane.visible)throw Error('Nozzle lane warning missing');
      NSR.Boss.step(world,[target],S.boss.warning.left+.2);draw();
      const position=details.nozzle.getWorldPosition(new THREE.Vector3());
      if(details.hoseRig.visible||Math.abs(position.x-S.boss.nozzle.x)>.01||Math.abs(position.z-S.boss.nozzle.z)>.01)throw Error('Detached nozzle diverged from simulation');
      target.pose.z=63;NSR.Boss.step(world,[target],1);syncBossWorld(world);draw();
      if(S.boss.state!=='exposed'||!document.querySelector('#boss-status').textContent.includes('CORE EXPOSED'))throw Error('Dodge did not expose the core');
      if(Math.abs(details.shutters[0].mesh.position.x)<.9)throw Error('Core shutters did not open');
      NSR.Boss.damage(world,1e9);syncBossWorld(world);save();const loaded=load();
      if(loaded.boss.kind!=='sweeper'||loaded.boss.phase!==2)throw Error('Sweeper save round trip failed');
      const originalCrouch=CFG.KB.crouch;
      try{CFG.KB.crouch='KeyV';if(!bossBriefing().includes('run to build momentum, then press V'))throw Error('Sweep briefing ignores rebound crouch key');}
      finally{CFG.KB.crouch=originalCrouch;}
      S.boss.attack=0;S.boss.wave=5;NSR.Boss.step(world,[target],0);syncBossWorld(world);draw();
      const sweep=details.sweep,curtain=sweep.children[0],cue=()=>document.querySelector('#boss-status').textContent.includes('SLIDE UNDER THE CYAN SWEEP');
      if(S.boss.warning?.kind!=='sweep'||Math.abs(S.boss.warning.left-1.4)>.001||!cue()||!sweep.visible||visual.warning.visible)throw Error('Cyan sweep warning/model/HUD missing or orange blast still visible');
      if(details.sweepMaterial.color.getHex()!==0x38edff||Math.abs(sweep.scale.x-3)>.001)throw Error('Sweep warning is not cyan and boss-centered');
      const center=sweep.getWorldPosition(new THREE.Vector3()),bounds=new THREE.Box3().setFromObject(curtain);
      if(Math.abs(center.x-S.boss.x)>.001||Math.abs(center.z-S.boss.z)>.001||Math.abs(bounds.min.y-1.3)>.001||Math.abs(bounds.max.y-6)>.001)throw Error('Sweep curtain center or slide clearance incorrect');
      NSR.SweeperVisuals.draw(model,S.boss,0);const dim=details.sweepMaterial.opacity;
      NSR.SweeperVisuals.draw(model,S.boss,Math.PI/30);
      if(Math.abs(details.sweepMaterial.opacity-dim)<.1)throw Error('Sweep anticipation does not pulse');
      save();const warningSave=load();
      if(warningSave?.boss.warning?.kind!=='sweep'||Math.abs(warningSave.boss.warning.left-1.4)>.001)throw Error('Sweep warning save round trip failed');
      S.boss=warningSave.boss;world.boss=S.boss;
      NSR.Boss.step(world,[target],S.boss.warning.left);NSR.Boss.step(world,[target],.35);syncBossWorld(world);draw();
      if(!S.boss.sweep||!sweep.visible||!cue()||Math.abs(S.boss.sweep.radius-4.9)>.001||Math.abs(sweep.scale.x-S.boss.sweep.radius)>.001||sweep.scale.y!==1||Math.abs(sweep.scale.z-S.boss.sweep.radius)>.001)throw Error('Live sweep rendering diverged from simulation');
      NSR.Boss.step(world,[target],.8);syncBossWorld(world);draw();
      if(S.boss.warning?.kind!=='nozzle'||!visual.lane.visible||!sweep.visible||!cue())throw Error('Concurrent nozzle warning hid the sweep or overrode its HUD cue');
      save();const sweepSave=load();
      if(!sweepSave?.boss.sweep||Math.abs(sweepSave.boss.sweep.radius-S.boss.sweep.radius)>.001||JSON.stringify(sweepSave.boss.sweep.hit)!==JSON.stringify(S.boss.sweep.hit))throw Error('Active sweep save round trip failed');
      S.boss=sweepSave.boss;world.boss=S.boss;draw();
      if(!sweep.visible||Math.abs(sweep.scale.x-S.boss.sweep.radius)>.001||!cue())throw Error('Restored sweep did not render');
      for(const state of ['exposed','dead']){S.boss.state=state;draw();if(sweep.visible)throw Error('Sweep visible during '+state);}
      S.boss.state='shielded';draw();
      const result={kind:S.boss.kind,phase:S.boss.phase,remaining:world.rem,sweepRadius:S.boss.sweep.radius};
      Object.assign(S.boss,{phase:3,hp:1,state:'exposed',timer:3,summonedPhase:3,spawnWarning:null});S.bossDead=0;S.hp=1;
      D.fill(0);S.rem=0;Object.assign(p,{x:60,z:58,h:0,vx:0,vz:0,vh:0,yaw:-Math.PI/2,pit:0,rp:0,g:1,sl:0,st:0});camCalc();
      E=[{...E[0],t:0,x:p.x-1.2,z:p.z,h:0,hp:30,mh:30,cd:0,al:1,bossMinion:true}];
      EP=[{x:p.x,y:1,z:p.z,vx:0,vy:0,vz:0,l:1,dm:999}];
      const credits=S.cred,parts=S.parts;ml=true;hf=0;rel=0;wcd=0;ammo[wi]=mag();
      upd(MOVE.tick);ml=false;
      if(S.bossDead!==1||S.boss.state!=='dead'||S.hp<=0||E.some(enemy=>enemy.bossMinion)||EP.length||S.parts!==parts+3||S.cred!==credits+1000+S.sector*250)throw Error('Final shot lost to same-frame guard/projectile damage or victory rewards missing');
      S.cred=credits;save();
      return result;
    }""")
    assert result["kind"] == "sweeper" and result["phase"] == 2 and result["remaining"] > 0, result
    assert result["sweepRadius"] > 4.9, result


async def smoke(args, server=None):
    errors = []
    async with async_playwright() as playwright:
        browser_type = getattr(playwright, args.browser)
        options = {"headless": not args.headed}
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
        if errors:
            raise RuntimeError("Game startup failed: " + json.dumps(errors))
        await solo.locator("#coop-menu").wait_for(state="visible")
        assert await solo.evaluate("document.querySelector('#coop-menu').scrollWidth<=document.querySelector('#coop-menu').clientWidth")
        await solo.locator("#coop-solo").click()
        await solo.evaluate("S.cred=123;save()")
        await solo.reload()
        await solo.locator("#coop-solo").click()
        assert await solo.evaluate("S.cred") == 123
        resources = await solo.evaluate("""() => {
          let sharedDisposals=0;sph.addEventListener('dispose',()=>sharedDisposals++);ceilM.addEventListener('dispose',()=>sharedDisposals++);
          const samples=[];for(let i=0;i<8;i++){build3D();draw();samples.push(rend.info.memory.geometries);}
          const before=rend.info.memory.geometries,doors=DOORM.length;let disposedDoors=0;for(const door of DOORM)door.geometry.addEventListener('dispose',()=>disposedDoors++);openVault(false);draw();
          const after=rend.info.memory.geometries;build3D();draw();
          return {samples,before,after,doors,disposedDoors,sharedDisposals};
        }""")
        assert max(resources["samples"]) == min(resources["samples"]), resources
        assert resources["disposedDoors"] == resources["doors"] and resources["after"] <= resources["before"], resources
        assert resources["sharedDisposals"] == 0, resources
        await sweeper_check(solo)
        boss_resources = await solo.evaluate("""() => {
          const samples=[];for(let i=0;i<5;i++){build3D();draw();samples.push(rend.info.memory.geometries);}return samples;
        }""")
        assert max(boss_resources) == min(boss_resources), boss_resources
        await solo.goto(args.url + "/nuclear-sweeper-dev.html")
        dev = solo.frame_locator("iframe")
        await dev.locator("#coop-solo").click()
        await dev.locator('[data-dev="max-all"]').click()
        assert await dev.locator("#dev-panel").evaluate("() => S.L.boots===30&&S.mod.gr===1&&JSON.parse(localStorage.getItem('nsr1')).cred===123")
        await sweeper_check(solo.frames[1])
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
        await host.evaluate("""() => {coopSession.devCommand('max');applyCoopView();const p=coopSession.view().player;p.prog.weapons[3]={kills:TIERS[1].k,types:TIERS[1].types.slice()};setW(3);} """)
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
        await host.evaluate("""() => {const w=coopSession.view().world;for(const p of Object.values(w.players)){p.pose=NSR.Movement.createPose(w.SH);p.move={};}w.D.fill(0);const remaining=w.M.findIndex((value,index)=>value===0&&Math.hypot((index%60+.5)*2-w.SH.x,((index/60|0)+.5)*2-w.SH.z)>20);if(remaining<0)throw Error('No remaining cleanup tile');w.D[remaining]=.01;w.rem=.01;w.clr=1;coopSession.setPaused(false);} """)
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
        await pages[1].wait_for_function('coopSession.view().remote.length===3', polling=100)
        disposal = await pages[1].evaluate("""() => {remotePlayers.update(coopSession.view().remote);const models=coopSession.view().remote.map(p=>sc.getObjectByName('sweeper:'+p.id));let disposed=0;for(const model of models)model.getObjectByName('equipped-weapon').children[0].geometry.addEventListener('dispose',()=>disposed++);remotePlayers.clear();return {disposed,remaining:remotePlayers.stats().players};} """)
        assert disposal == {"disposed": 3, "remaining": 0}, disposal
        assert not errors, errors
        print(json.dumps({"browser": args.browser, "version": browser.version, "clients": 4, "transport": "real WebRTC / localhost", "checks": ["narrow mode menu", "normal solo save round trip", "developer iframe/max loadout isolation", "Sweeper model, warning lane and detached nozzle in both entries", "Sweeper dodge exposure, shutters and phase save round trip", "Sweeper cyan slide sweep warning, rendering and save round trip", "Sweeper reinforcement beacons, guards and save round trip", "Sweeper final-shot victory before same-frame lethal guard/projectile damage", "join", "host-confirmed hotbar selection", "movement", "equipped weapon, attachments and mastery", "grapple rope", "pause", "deployment", "guest reload/reconnect", "signaling request outage with RTC continuity", "signaling recovery and identity-preserving rejoin", "avatar disposal"] + (["signaling process restart with RTC continuity", "checkpoint rehost preserves world and all four identities"] if server else []), "errors": errors}, indent=2))
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
    parser.add_argument("--headed", action="store_true", help="Use a visible browser; Linux CI supplies a virtual display with Xvfb.")
    parser.add_argument("--managed-server", action="store_true", help="Start an isolated local server and verify process restart plus checkpoint rehost.")
    parser.add_argument("--node", default=shutil.which("node") or "node", help="Node.js executable for --managed-server.")
    asyncio.run(main(parser.parse_args()))
