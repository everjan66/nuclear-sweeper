# Plan: gelegentlicher Browser-Koop

Stand: 17. Oktober 2026. Status: lokale Implementierung vorhanden; externe Abnahme offen.

Aktueller Stand, Einrichtung und offene K1/K6-Arbeiten: [MULTIPLAYER.md](MULTIPLAYER.md).

Ziel sind private Online-Runden mit zwei bis vier Personen. Ein Browser übernimmt
die Spielsimulation, die anderen verbinden sich per WebRTC mit diesem Host.
Einladungslink öffnen, beitreten, gemeinsam spielen. Der Host kann die Koop-Welt
lokal speichern und bei der nächsten Runde wieder öffnen.

## 1. Umfang und vorgeschlagene Spielregeln

Diese Regeln dienen als konkrete Grundlage für die erste Version und können vor
dem jeweiligen Arbeitspaket angepasst werden:

- Höchstens vier Spieler einschließlich Host; ausschließlich private Koop-Räume.
- Eine gemeinsame Karte mit gemeinsamem Reinigungsfortschritt, Tresor und Loot.
- Gemeinsame Credits, Schrott, seltene Teile und Raffinerie. Raffinerie-Upgrades
  gelten für die Gruppe; Waffen, Ausrüstung, Tank, Munition und Leben sind persönlich.
  Persönliche Käufe werden aus der Teamkasse bezahlt und vom Host einzeln geprüft.
- Staub wird nur einmal aus der Welt entfernt und füllt den Tank des sammelnden
  Spielers. Gleichzeitiges Saugen teilt die tatsächlich verfügbare Menge auf.
  Abgabe füllt die gemeinsame Raffinerie; ein Lootfund erhöht die Teamkasse einmal.
- Waffenlizenzen, Meisterschaft und Kampfscore bleiben persönlich. Der bestätigte
  tödliche Treffer zählt für den Schützen, gesammelter Staub für den Sammler.
- Kein Friendly Fire und keine Kollision zwischen Spielern in der ersten Version.
- Tod rettet nur die betroffene Person zum Shelter, mit der bisherigen Halbierung
  des Tankinhalts. Andere Spieler, Gegner und deren Geschosse spielen weiter.
- Der Host startet den nächsten Standort, sobald das Reinigungsziel erreicht ist
  und alle verbundenen Spieler im Shelter bereit sind.
- Ein später Beitritt ist möglich; die neue Person erscheint im Shelter.
- Koop beginnt mit einer eigenen Welt und eigenen Charakteren. Deren Ausrüstung
  bleibt für spätere Runden in dieser Welt erhalten. Solo-Spielstände werden
  weder importiert noch durch Koop-Fortschritt verändert.
- Hostwechsel, öffentliche Spielersuche, Accounts, Voicechat, PvP und ein
  dauerhaft laufender Server gehören nicht zur ersten Version.

## 2. Befunde im vorhandenen Code

Fast das gesamte Spiel liegt in `nuclear-sweeper-reactor.html`. Es gibt derzeit
keinen Netzwerkdienst, Paketmanager oder automatisierten Testlauf im Repository.

- `S` enthält Weltfortschritt, Wirtschaft und persönliche Werte zusammen;
  `p`, Waffenstatus, Cooldowns und Eingaben existieren jeweils nur einmal.
- `upd(dt)` verarbeitet Bewegung, Kampf, Reinigung, KI, Loot, Tod und Story in
  einem Durchlauf. `loop()` koppelt die Simulation an `requestAnimationFrame()`
  und das gemeinsame `paused`-Flag. Bewegung läuft bereits mit `MOVE.tick = 1/64`.
- `genMap()` erzeugt eine grundsätzlich reproduzierbare Karte, startet aber auch
  zufällige Gegner, Loot und den 3D-Aufbau. Ein gemeinsamer Seed allein genügt
  deshalb nicht, um identische Spielzustände herzustellen.
- `bfs()`, `eAI()`, `hurt()` und Gegnergeschosse beziehen sich direkt auf `p`.
  Mehrere unabhängige Ziele sind noch nicht vorgesehen.
- `shoot()` verbindet Trefferauswertung, Munition, Score, Kamera, Ton und Effekte.
  `openVault()`, `pickup()`, `buy()` und `deploy()` verändern globale Werte direkt.
- `save()` schreibt `S` und das Staubraster `D`, jedoch keinen vollständigen
  laufenden Zustand aller Gegner, Geschosse und Spieler.
- `syncPause()` pausiert beim Öffnen von Menüs das Spiel. `refine()` läuft separat
  weiter und berechnet beim Laden auch Offline-Fortschritt.
- `nuclear-sweeper-dev.js` greift auf dieselben globalen Variablen zu. Beide
  Einstiegspunkte und die Trennung von normalen und Entwickler-Spielständen
  müssen bei der Auslagerung erhalten bleiben.

Der Hauptaufwand ist die Trennung dieser Zuständigkeiten. Die WebRTC-Verbindung
ist nur eines der Arbeitspakete.

## 3. Architektur

### Verbindungen und Infrastruktur

Jeder Gast hat genau eine WebRTC-Verbindung zum Host. Gäste verbinden sich nicht
untereinander. Der Host verteilt bestätigte Zustände an alle Gäste und behandelt
auch die eigenen Aktionen über dieselben Spielregeln.

Zusätzlich werden drei kleine Infrastrukturbausteine benötigt:

1. Statisches HTTPS-Hosting für HTML und JavaScript.
2. Ein Signaling-Dienst über HTTPS/WSS für Räume, Einladungen und den Austausch
   der WebRTC-Verbindungsdaten. Dort läuft keine Spielsimulation.
3. STUN und ein TURN-Fallback für Netzwerke, die keine direkte Verbindung zulassen.
   Bei TURN wird der Spielverkehr weitergeleitet; dafür können Datenkosten entstehen.

Den Signaling-Dienst als kleinen separat betreibbaren Dienst planen; eine konkrete
Hosting- und TURN-Lösung wird beim Verbindungsprototyp ausgewählt. Sie muss eigene
WebRTC-Datenkanäle, kurzlebige TURN-Zugangsdaten und die nötigen Verbindungen erlauben.
Ein eigener ständig eingeschalteter Laptop ist dafür nicht nötig.

Raumzugang erfolgt über eine zufällige Einladung. Räume laufen nach Ende der
Sitzung ab. Teilnehmerlimit, Nachrichtenlimits und Protokollversion werden beim
Beitritt geprüft. Permanente TURN-Zugangsdaten gehören nicht in die Spieldateien.
Ein Ausfall des Signaling-Dienstes soll bestehende Peer-Verbindungen nicht beenden;
neue Beitritte oder erneute Verbindungsversuche können dann vorübergehend scheitern.

### Zustände und Verantwortlichkeit

- `WorldState`: Standort, Karten- und Staubraster, Türen, Gegner, Geschosse,
  Loot, Reinigungsziel, Teamkasse, Raffinerie und gemeinsame Stations-Upgrades.
- `PlayerState`: stabile Spieler-ID, Bewegung samt Parkour-Zuständen und Timern,
  Leben, Tank, Waffen, Munition, Nachladen, Ausrüstung, Statistiken und Bereitschaft.
- `SessionState`: Host/Gast, Raum, aktive Verbindungen, Sitzungs- und Weltversion,
  Bestätigungen, Wiederverbindung und globale Unterbrechung.
- `LocalViewState`: Kamera, Mausfang, Menüs, Einstellungen, Audio, Partikel und
  vorhergesagte Darstellung der eigenen Bewegung.

Nur der Host entscheidet über Weltänderungen, Treffer, Schaden, Käufe und
Belohnungen. Gäste schicken Eingaben und Aktionswünsche. Der Host prüft Position,
Reichweite, Munition, Feuerrate, Preise und Besitz aus seinem eigenen Zustand.
Clientseitig gemeldete Treffer oder Kontostände werden nicht übernommen.

Der Einzelspieler nutzt denselben Simulationskern mit einem lokalen Spieler.
Darstellung und Eingabe erhalten klar definierte Schnittstellen; kein temporäres
Umschalten globaler Variablen, um einen zweiten Spieler zu simulieren.

### Synchronisation und Steuerungsgefühl

- Den vorhandenen festen Takt von 64 Simulationsschritten pro Sekunde beibehalten.
  Simulation, Renderfrequenz und Netzwerksendefrequenz voneinander trennen.
- Als Ausgangspunkt Eingaben in Paketen mit etwa 32 Hz und vollständige dynamische
  Zustandsbilder mit etwa 20 Hz senden. Nach Messungen anpassen.
- Eigene Bewegung sofort vorhersagen. Der Host bestätigt Eingabesequenzen; der
  Gast korrigiert auf den bestätigten Stand und spielt noch offene Eingaben erneut ab.
  Dazu gehören auch Slide, Vault, Wallrun, Grapple, Dash und Zipline-Zustände.
- Andere Spieler und Gegner zwischen empfangenen Zuständen weich darstellen.
  Dafür anfangs ungefähr 100 ms Puffer verwenden und anhand von Jitter abstimmen.
- Zwei Datenkanäle vorsehen: zuverlässig/geordnet für Beitritt, Aktionen und
  dauerhafte Weltänderungen; ungeordnet ohne Wiederholung für ersetzbare
  Bewegungs- und Zustandsdaten.
- Gehaltene Tasten regelmäßig übertragen und bei ausbleibenden Eingaben nach
  kurzer Frist, zunächst 250 ms, neutralisieren. Einzelaktionen erhalten IDs,
  damit Übertragung und Wiederholung keine doppelten Käufe oder Schüsse erzeugen.
- Nachrichten enthalten Protokollversion, Sitzung, Weltgeneration, Sequenz bzw.
  Tick. Verspätete Nachrichten aus dem vorigen Standort werden verworfen.
- Karten- und Staubzustand beim Beitritt vollständig übertragen; danach geänderte
  Staubzellen gebündelt als absolute Werte zuverlässig senden. Verschmutzung darf
  durch Paketverlust nicht dauerhaft unterschiedlich aussehen.
- Gegner, Spieler, Loot und relevante Geschosse erhalten stabile IDs. Entfernen,
  Tod und Belohnung müssen auch bei wiederholten Nachrichten genau einmal gelten.
- Schussanimation und Mündungsfeuer lokal sofort zeigen; Treffer und Belohnungen
  bestätigt der Host. Eine historische Rückrechnung von Treffern ist zunächst
  nicht vorgesehen; deren Bedarf wird im Latenztest geprüft.
- Begrenzte Sendewarteschlangen, kleine Snapshot-Blöcke und Backpressure vorsehen.
  Veraltete Bewegungsbilder dürfen wichtige Ereignisse nicht dauerhaft verzögern.

## 4. Umsetzung in abhängigen Arbeitspaketen

### K1 — Simulationskern und Zustand aufteilen

Abhängigkeit: keine. Entspricht den Grundlagen M1-2, M1-3 und M2-1 der Roadmap.

- Bewegung/Kollision, Weltaufbau, Kampf, KI, Wirtschaft und Speicherung zunächst
  schrittweise aus dem HTML auslagern; Darstellung, Audio und DOM-Zugriffe abtrennen.
- Aus dem einzelnen Spieler eine Sammlung `players` machen. Funktionen bekommen
  Welt, Spieler und Eingaben explizit übergeben. Timer und Waffenstatus zuordnen.
- Reine Kartenerzeugung, initiale Gegnererzeugung und `build3D()` trennen.
  Spielrelevante Zufallsentscheidungen treffen später ausschließlich die Host-Logik;
  kosmetische Zufallswerte bleiben lokal.
- Simulationsereignisse für Ton, Trefferanzeige und Partikel ausgeben. Erneutes
  Abspielen vorhergesagter Eingaben darf keine Effekte oder Belohnungen verdoppeln.
- Solo-Laden/-Speichern durch einen Adapter erhalten. Entwicklerwerkzeuge auf
  explizite Befehle umstellen und ihre getrennten Speicherbereiche bewahren.
- Kleine Testbasis für den Simulationskern und wiederholbare manuelle Baselines
  einführen. Kein neues UI-Framework nötig; Laden einfacher Skriptdateien reicht.

Abnahme: Die normale und die Entwickler-Version bestehen die bisherigen
Bewegungs-, Kampf-, Upgrade-, Speicher- und Standortwechsel-Szenarien. Bestehende
Solo-Spielstände und der bisherige lokale Einstieg funktionieren weiterhin.

### K2 — Früher Verbindungsprototyp und Lobby

Abhängigkeit: Verbindungstest eigenständig möglich; Spielintegration nach K1.

- Startauswahl „Solo“, „Koop hosten“ und „Koop beitreten“ vor dem Laden eines
  Spielstands einbauen. Beim Moduswechsel darf kein falscher Speicherbereich schreiben.
- Raum erstellen, Einladungslink, Teilnehmerliste, Bereitschaft und Verlassen
  implementieren. Hosting- und TURN-Konfiguration für den Prototyp festlegen.
- WebRTC mit Signaling, STUN, TURN und klaren Zuständen für Verbindung,
  Synchronisation, Abbruch und erneuten Versuch aufbauen.
- Mit einem kleinen Testzustand zuerst die Verbindung über zwei unterschiedliche
  Internetanschlüsse und einen ausdrücklich erzwungenen TURN-Pfad prüfen.
- Ping, Verbindungsart und ausgehende Datenmenge in einer Entwickleranzeige erfassen.

Abnahme: Zwei Browser können über eine Einladung Daten austauschen, einschließlich
TURN-Fallback. Ein voller Raum, eine ungültige Einladung, inkompatible Versionen
und ein ausgefallener Dienst ergeben verständliche Meldungen.

### K3 — Gemeinsame Karte und mehrere bewegliche Spieler

Abhängigkeit: K1 und K2.

- Host-Simulation, Gast-Vorhersage, Eingabebestätigung und Zustandsübertragung
  zunächst für Bewegung und statische Kollision integrieren.
- Ein Beitritt erhält einen konsistenten Snapshot einschließlich Kartenstruktur,
  Staub, Türen, Spielern und benötigten Raum-/Zipline-Daten. Gäste erzeugen dabei
  keine eigenen Gegner oder Lootobjekte.
- Während der Snapshot-Übertragung auftretende Änderungen ab dessen Revision
  puffern und anschließend nachreichen. Erst nach Bestätigung ins Spiel wechseln;
  bei Überlauf einen neuen Snapshot beginnen.
- Aus dem vorhandenen Spielermodell eine Fabrik für mehrere Figuren machen:
  Farbe, Name, Blickrichtung, Waffe, Haltung, Bewegung und Minimap-Markierung.
- Alle vorhandenen Bewegungsarten mit vollständigem Zustand synchronisieren.
  Kamera und Waffenmodell in der Ich-Perspektive bleiben lokal.

Abnahme: Zwei Spieler sehen denselben Standort und einander korrekt, einschließlich
Grapple, Dash und Ziplines. Kollisionen und Bewegung bleiben bei simulierten 150 ms
Roundtrip-Latenz und 2 % Paketverlust spielbar; Abweichungen laufen nicht auf.
Dies ist der erste sichtbare Multiplayer-Meilenstein, noch keine vollständige Runde.

### K4 — Gemeinsamer Kampf, KI, Reinigung und Wirtschaft

Abhängigkeit: K3.

- `shoot()`, `cast()`, `hurt()` und `recordKill()` auf Host-Auswertung mit Spieler-ID
  umstellen. Schüsse aus Spielerpose und Blickrichtung berechnen, nicht aus der
  lokalen Renderkamera. Durchschüsse und Schrot dürfen Ziele weiterhin nur im
  vorgesehenen Umfang treffen.
- KI auf mehrere Ziele erweitern. Zielwahl berücksichtigt Entfernung,
  Erreichbarkeit und Shelter-Schutz; Wechsel mit Hysterese verhindern Flattern.
  Wegfelder für normale und große Gegner je aktivem Spieler zwischenspeichern.
- Spawn-Abstände zu allen Spielern prüfen; Nahkampf und Geschosse gegen alle
  gültigen Ziele auswerten. Tod darf keine globalen Geschosslisten mehr leeren.
- Saugen, Tankabgabe, Raffinerie, Loot, Tresor und Standortziel auf dem Host
  abwickeln. Gleichzeitige Aktionen bearbeiten jeweils den bereits aktualisierten
  Zustand, sodass dieselbe Ressource nicht mehrfach verteilt wird.
- Gemeinsame Stations-Upgrades von persönlichen Ausrüstungs-Upgrades trennen.
  Käufe, Freischaltungen und Belohnungen mit eindeutigen Vorgangs-IDs bestätigen.
- HUD und Shop zeigen Teamkasse, eigenes Inventar, Mitspielerstatus und bestätigte
  Käufe. Gemeinsame Story-Ereignisse erreichen alle; spätere Gäste erhalten den Stand.
- Standortwechsel als gemeinsamen Ladevorgang mit neuer Weltgeneration und
  Bereitschaftsbestätigung durchführen. Nicht reagierende Gäste nach Frist trennen,
  damit sie den Raum nicht dauerhaft blockieren.

Abnahme: Eine komplette Runde ist zu zweit spielbar. Zwei gleichzeitige Sammler,
Käufer oder Schützen erzeugen weder Ressourcen noch Kills doppelt. KI verfolgt
auch Gäste; die Rettung eines Spielers unterbricht die anderen nicht.

### K5 — Speichern, Wiederverbinden und Browser-Unterbrechungen

Abhängigkeit: K4; Protokollfelder und Speichergrenzen bereits in K1–K3 vorbereiten.

- Versionierten Koop-Speicherbereich einführen, beispielsweise `nsr_coop_v1`,
  und einen separaten Entwicklerbereich. Der Host speichert Welt, Teamkasse und
  die Charaktere aller Teilnehmer zusammen als konsistenten Checkpoint.
- Stabile Spieler-IDs und zufällige Wiederbeitritts-Tokens verwenden. Der Gast
  bewahrt seine Zuordnung lokal auf; der Host prüft sie. Anzeigenamen sind keine
  Identität. Ein Client darf beim Wiederbeitritt keine eigenen Inventarwerte liefern.
- Regelmäßig sowie nach wichtigen Transaktionen speichern. Schreibfehler sichtbar
  melden. Ein Browserabsturz kann Änderungen seit dem letzten Checkpoint verlieren;
  `beforeunload` allein ist keine zuverlässige Speicherstrategie.
- Für spätere Abende den Fortschritt einschließlich verbleibender Gegner und Loot
  erhalten. Beim bewussten Neustart einer gespeicherten Welt starten alle im Shelter,
  gespeicherter Tankinhalt wird genau einmal abgegeben; alte fliegende Geschosse
  werden verworfen. Keine Offline-Raffinerie im Koop-MVP.
- Kurze Gastabbrüche erkennen: Eingaben neutralisieren, Zustand zunächst behalten,
  nach festgelegtem Timeout einmal die normale Rettungsregel anwenden und Figur
  entfernen. Den Platz zunächst 60 Sekunden reservieren; danach freigeben.
  Wiederbeitritt erhält den aktuellen Host-Zustand und kann nie eine zweite Figur
  mit derselben Identität erzeugen.
- Gäste dürfen beim Öffnen von Menüs nur ihre Eingabe stoppen; die Welt läuft
  weiter und ihre Figur bleibt außerhalb des Shelters verwundbar. Das gilt auch
  für Menüs des Hosts, solange sein Tab aktiv bleibt.
- Wenn der Host-Tab verborgen wird, die Welt bewusst gemeinsam unterbrechen und
  speichern; bei Rückkehr nach Bestätigung fortsetzen. Bei ausbleibenden Host-Ticks
  frieren Gäste ihre Vorhersage ein und zeigen „Warte auf Host“. Keinen riesigen
  Rückstand nachsimulieren. Worker oder Timer umgehen Browser-Suspendierung nicht
  zuverlässig und sind keine Voraussetzung für die erste Version.
- Bei geschlossenem Host-Browser endet die Sitzung. Gäste sehen den Grund und
  behalten ihren Solo-Spielstand. Der Host kann die gespeicherte Welt später mit
  einer neuen Einladung öffnen; ein automatischer Hostwechsel ist nicht vorgesehen.
- Während einer Sitzung keinen Save-Import/-Reset ausführen. Koop-Export/-Import
  getrennt vom bestehenden Solo-Format anbieten und Wiederbeitrittsdaten schützen.

Abnahme: Gast-Reload, Netzunterbrechung, Host-Tabwechsel, Host-Ende und spätere
Fortsetzung sind nachvollziehbar. Koop schreibt nie in `nsr1` oder `nsr1_dev`.
Wiederholtes Verbinden dupliziert weder Charaktere noch Belohnungen.

### K6 — Vier Spieler, reale Netze und Freigabe

Abhängigkeit: K5.

- Die vollständige Runde mit vier Browsern prüfen: gemeinsame Reinigung,
  Maximalbewaffnung, viele Gegner, Tresor, Shop, Rettung und Standortwechsel.
- Aktuelle Desktop-Versionen von Chrome/Edge und Firefox prüfen. Weitere Browser
  erst nach einem eigenen Test als unterstützt nennen.
- LAN, verschiedene Internetanschlüsse, erzwungenes TURN, Jitter, Paketverlust,
  Verbindungswechsel und absichtliche Unterbrechungen testen.
- CPU-Zeit der Host-Simulation, Upstream, Sendewarteschlangen und Korrekturen
  messen. Bei Überlast Sendefrequenz/Detailgrad anpassen, nicht unkontrolliert
  immer mehr Zustände puffern. Renderlimits für Gegner, Loot und Effekte prüfen.
- Gegnerzahl und Wirtschaft anhand echter Koop-Runden abstimmen; nicht pauschal
  alles mit der Spielerzahl multiplizieren.
- HTTPS-Bereitstellung, Signaling-Konfiguration, kurzlebige TURN-Zugangsdaten und
  Betriebsanleitung dokumentieren. Solo benötigt weiterhin keinen Signaling- oder
  Spielserver; die bestehende Three.js-CDN-Abhängigkeit bleibt davon unberührt.

Abnahme: Eine mindestens 30-minütige Runde mit vier Spielern einschließlich
Standortwechsel und Gast-Reconnect funktioniert ohne dauerhafte Zustandsabweichung,
unbegrenzte Warteschlangen oder Speichervermischung. Latenz- und Bandbreitenwerte
werden gemessen dokumentiert, bevor Leistungsversprechen gemacht werden.

## 5. Geplante Codebereiche und Verifikation

Die genaue Dateiaufteilung wird in K1 festgelegt. Als Zielstruktur dienen:

- `js/core/`: Zustandsmodelle, feste Simulation, Bewegung und Kollision.
- `js/game/`: Karte, Kampf, KI, Reinigung, Wirtschaft und Progression.
- `js/net/`: Protokoll, Signaling-Client, WebRTC, Snapshots und Sitzungsablauf.
- `js/ui/`: Modusauswahl, Lobby, Verbindungsstatus und Anzeige der Mitspieler.
- `js/storage/`: Solo-Adapter, Koop-Checkpoints und Formatvalidierung.
- `services/signaling/`: kleiner separat bereitstellbarer Raum-/Signaling-Dienst.
- `tests/`: gezielte Simulationstests und Tests gegen fehlerhafte Übertragung.

Das Haupt-HTML bleibt Einstieg und Darstellungshülle. Die Auslagerung soll den
bisherigen lokalen Solo-Start bewahren; der Online-Modus wird über HTTPS angeboten.
`nuclear-sweeper-dev.html` bleibt Einstieg in dieselbe Spielbasis. Entwickler-Koop
erlaubt nur passend gekennzeichnete Teilnehmer und hostseitige Testbefehle.

Automatisierte Tests konzentrieren sich auf die tatsächlichen Risiken:

- Bewegungswiederholung nach Host-Korrektur einschließlich Parkour und Cooldowns.
- Zwei Spieler saugen dieselbe fast leere Zelle: Gesamtmenge bleibt erhalten.
- Zwei Spieler nehmen denselben Fund oder kaufen mit dem letzten Guthaben:
  genau eine zulässige Transaktion, keine negativen Kontostände.
- Gleichzeitige tödliche Treffer, Durchschüsse und Schrot: korrekte einzelne
  Kill-Zuordnung und einmalige Belohnungen.
- Doppelte, verspätete und verlorene Nachrichten; Lücken während Snapshot-Aufbau
  und Standortwechsel; abgelaufene Eingaben und zu große Nachrichten.
- Speicher-Rundlauf, inkompatible Versionen und strikte Trennung Solo/Koop/Dev.
- Wiederbeitritt desselben Spielers, veraltete Tokens, volle Räume und einmalige
  Rettung bei Verbindungsabbruch.

Manuelle Browserprüfungen ergänzen diese Tests für Mausfang, Menüs, Lesbarkeit,
Bewegungsgefühl und reale STUN-/TURN-Verbindungen.

## 6. Reihenfolge und Aufwand

K1 bildet die Grundlage; der kleine Verbindungstest aus K2 kann schon während
dieser Arbeit erfolgen. Danach folgen K3, K4, K5 und K6. Die vorhandene Roadmap
verlangt vor Implementierungsbeginn ein Issue mit Umfang und Abnahmekriterien;
die sechs Arbeitspakete sind dafür die Vorlage. Dieser Plan selbst startet noch
keine Umsetzung und veröffentlicht keine Dienste.

Erster sinnvoller Demonstrationsstand: zwei Spieler bewegen sich nach Einladung
auf derselben Karte. Erste vollständige Spielversion: zusätzlich gemeinsamer
Kampf, Reinigung, Wirtschaft, Speichern und geregelte Verbindungsabbrüche.

Die größten Unsicherheiten sind die Auslagerung der globalen Zustände und die
Bewegungskorrektur bei den vielen Parkour-Funktionen. Für eine verlässliche
Vier-Spieler-Version ist der Aufwand eher in mehreren Entwicklungswochen als
in einem kurzen Netzwerk-Patch zu sehen. Nach K1 und dem Verbindungsprototyp
lässt sich der verbleibende Aufwand wesentlich genauer schätzen.
