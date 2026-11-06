# Minutrel V0.1 — Benutzerhandbuch

Englische Videos mit Sprecherstimme, Musik und Untertiteln: [Einführung](https://youtu.be/q6VeUbyOhn8), [erste Schritte](https://youtu.be/u5MItUvsxQc) und [alle 12 Videoanleitungen](../../VIDEOS.en.md).

[Français](../fr/README.md) · [English](../en/README.md) · [Deutsch](README.md)

Dieses Handbuch beschreibt die gelieferten Funktionen der Version 0.1.0. Die Abbildungen zeigen fiktive Daten. Einige Detailaufnahmen stammen aus der französischen Oberfläche; Aufbau und Aktionen sind in allen Sprachen gleich. Projektnamen, Beschreibungen und Notizen bleiben in ihrer ursprünglichen Sprache.

![Deutsche Oberfläche](../../screenshots/12-deutsch.jpg)

## 1. Nutzungsart wählen

| Modus | Konto und Daten | Verbindung |
| --- | --- | --- |
| Eigenständige Desktopanwendung | Ein persönlicher Arbeitsbereich auf diesem Computer, ohne Onlinekonto | Kein Server für Projekte, Zeitmessung, manuelle Einträge, Notizen, manuelle Arbeitsberichte und lokale Exporte nötig |
| Mit einem Team verbundene Desktopanwendung | Ihr Konto auf dem Teamserver, mit persönlicher lokaler Kopie | Einmal online anmelden; danach Zeitmessung und neue Zeiteinträge auch offline erfassen |
| Webbrowser | Ihr Konto und die Daten auf dem Teamserver | Serververbindung erforderlich; der Browser bietet keinen eigenständigen lokalen Arbeitsbereich |

Wählen Sie immer ein **Minutrel-Projekt**, keinen Ordner des Computers. KI ist optional; es wird kein Modell mitgeliefert.

## 2. Ohne Server beginnen

Installieren Sie das Paket für Ihr Betriebssystem. V0.1-Pakete sind nicht signierte Testpakete. Wählen Sie auf der Anmeldeseite **Auf diesem Computer verwenden**. Wenn Sie bereits mit einem Team verbunden sind, öffnen Sie **Einstellungen → Persönlichen Arbeitsbereich öffnen**.

Erstellen Sie unter **Projekte → Neues Projekt** Ihr erstes Projekt. Der persönliche Arbeitsbereich besitzt ein Profil und wird durch Ihr Betriebssystemkonto geschützt. E-Mail-Adresse, Passwort und Onlinedienst sind nicht erforderlich. Name und Zeitzone werden in den Einstellungen geändert; nach dem ersten Zeiteintrag bleibt die Zeitzone unverändert.

![Eigenständiger Arbeitsbereich, französisches Beispiel](../../screenshots/13-espace-local.png)

Die Daten werden im privaten Anwendungsordner gespeichert; der vorherige Stand bleibt als Kopie erhalten. Nutzen Sie regelmäßig **Lokale Kopie exportieren** und sichern Sie den gesamten Konfigurationsordner. Die JSON-Kopie enthält auch private Notizen. Beim Öffnen des persönlichen Arbeitsbereichs werden keine Daten an ein Team gesendet.

## 3. Einem Team beitreten und Rollen verstehen

Der Administrator teilt Ihnen die HTTPS-Adresse des Servers und Ihr Konto mit. Öffnen Sie diese Adresse im Browser. Wählen Sie am Computer **Teamarbeitsbereich öffnen**, tragen Sie dieselbe Adresse ein und melden Sie sich mit demselben Konto an. HTTP ist nur für einen Server auf diesem Computer zulässig.

| Rolle | Rechte in V0.1 |
| --- | --- |
| Mitarbeiter | Eigene Zeiten, Notizen und persönliche Berichte; zugewiesene Projekte |
| Verantwortlicher | Alle Projekte und Teamzeiten, einschließlich begründeter Korrekturen |
| Administrator | Zusätzlich Konten, Integrationen, gemeinsame Monatsexporte und Verwaltungsprotokoll |

Unter **Team → Mitglied hinzufügen** erstellt ein Administrator Konten mit einem Erstpasswort aus mindestens zwölf Zeichen. Übermitteln Sie es privat. Das Mitglied kann es in den Einstellungen ändern. **Bearbeiten** ändert Rolle oder Aktivierung. Eine Deaktivierung widerruft Zugriffe und bewahrt die Historie. Der letzte aktive Administrator kann nicht entfernt werden. Beenden Sie vor der Deaktivierung eine noch aktive Zeitmessung; das Zeitsymbol erlaubt einen protokollierten Administratoreingriff mit Begründung.

![Mitgliederverwaltung, französisches Beispiel](../../screenshots/05-equipe.jpg)

E-Mail-Einladungen, SSO und auf einzelne Projekte begrenzte Verwaltungsrollen gehören noch nicht zu V0.1. Verantwortliche verwalten das gesamte Team.

## 4. Projekte, Aufgaben und Archivierung

Unter **Projekte** können Sie suchen und zwischen aktiven und archivierten Projekten wechseln. Verantwortliche und Administratoren bearbeiten Name, Beschreibung, Farbe und zugewiesene Mitglieder. **Aufgaben** erstellt oder archiviert optionale Aufgaben. Mitarbeiter sehen ihre zugewiesenen Projekte. Im persönlichen Arbeitsbereich verwalten Sie Ihre eigenen Projekte.

![Projekte, französisches Beispiel](../../screenshots/02-projets.jpg)

Vor der Archivierung müssen aktive Zeitmessungen des Projekts beendet werden. Die bisherigen Zeiteinträge bleiben erhalten.

## 5. Zeit erfassen und Mini-Zeitmessung verwenden

Wählen Sie in der **Übersicht** ein Projekt, bei Bedarf eine Aufgabe, beschreiben Sie Ihre Arbeit und klicken Sie auf **Starten**. **Pause** unterbricht die Zählung, **Fortsetzen** führt denselben Eintrag weiter. **Beenden** schließt ihn ab. Pausen werden nicht gezählt.

**Mini-Zeitmessung** öffnet ein verschiebbares Fenster über gewöhnlichen Fenstern. Am Computer gibt es zusätzlich ein Symbol in der Menüleiste/im Infobereich und, soweit verfügbar, `Strg/Cmd + Alt + M`. Das Widget passt seine Höhe an den Inhalt an. **Minutrel** öffnet das Hauptfenster; das Kreuz blendet das Widget aus. Vollbildprogramme und manche Linux-/Wayland-Umgebungen bestimmen die Fensterplatzierung selbst.

![Eigenständiges Widget bei gestopptem Server](../../screenshots/14-widget-autonome.png)

Das Schließen eines Fensters oder Beenden der Anwendung stoppt keine Zeitmessung. Persönliche Zeiten bleiben im lokalen Journal; bereits angenommene Teamzeiten laufen auch auf dem Server weiter. Der Ruhezustand des Computers ist keine automatische Pause. Beenden Sie die Messung ausdrücklich, wenn die Arbeit endet.

Im Browser bleibt beim Navigieren eine kompakte Leiste erreichbar. Ein separates Minifenster benötigt Document Picture-in-Picture; andernfalls verwenden Sie die Leiste.

## 6. Offline arbeiten und synchronisieren

| Anzeige | Bedeutung |
| --- | --- |
| Lokaler Arbeitsbereich | Persönliche Daten werden nur auf diesem Computer gespeichert |
| Arbeitsbereich synchronisiert | Server erreichbar, keine lokalen Änderungen warten auf Annahme |
| Übertragung ausstehend | Zeiteinträge lokal gespeichert, noch nicht vom Server angenommen |
| Offline | Zeitmessung und neue manuelle Einträge bleiben am Computer möglich; Teamverwaltung benötigt den Server |
| Konflikt zu lösen | Server lehnt Version, Zuweisung oder Überschneidung ab; lokale Vorschläge bleiben erhalten |

Die erste Onlineanmeldung bereitet Konto, Projekte und laufende Zeitmessung vor. Die Warteschlange bleibt nach dem Schließen erhalten. Sobald der Server erreichbar ist, werden die Übertragungen fortgesetzt; **Einstellungen → Synchronisieren** versucht es erneut. Eine abgelaufene Sitzung kann eine erneute Anmeldung mit demselben Konto verlangen. Löschen Sie keine Anwendungsdaten, solange Einträge ausstehen. Nach 30 Tagen ohne Kontoprüfung erfordert das Öffnen einer Teamkopie eine Verbindung; der persönliche Arbeitsbereich hat diese Frist nicht.

![Während einer Unterbrechung gespeicherte Teamzeit, französische Oberfläche](../../screenshots/16-equipe-hors-connexion.png)

![Derselbe Eintrag einmalig im Web empfangen, französische Oberfläche](../../screenshots/17-temps-synchronise-web.jpg)

Erfassen Sie dasselbe Zeitintervall möglichst nicht auf mehreren getrennten Geräten. Der Server prüft Berechtigungen, Überschneidungen und die aktive Zeitmessung erneut. Ein anderes Geräteprotokoll wird nicht stillschweigend überschrieben.

Bei einem Konflikt beenden Sie die lokale Zeitmessung, exportieren eine Kopie und vergleichen den Serverstand. **Warteschlange archivieren und Serverstand behalten** bewahrt die Vorschläge in lokalen Archiven und lädt den Serverstand. Tatsächlich fehlende Zeiten können Sie nach Prüfung manuell nachtragen. V0.1 führt abweichende Verläufe nicht automatisch zusammen. Projektverwaltung, Korrekturen von Servereinträgen, gemeinsame Berichte und KI-Konfiguration benötigen eine Verbindung. Eine lokale Vorschau ersetzt keinen vollständigen Teambericht.

## 7. Persönliche Arbeit in ein Team übertragen

Beenden Sie persönliche Zeitmessungen, öffnen Sie Ihr Teamkonto und wählen Sie **Einstellungen → Meine lokale Arbeit übertragen → Meinen lokalen Arbeitsbereich lesen**. Ordnen Sie jedem ausgewählten persönlichen Projekt ein vorhandenes, erlaubtes Teamprojekt zu. Projekte ohne Zuordnung bleiben lokal.

Abgeschlossene Einträge werden in Ihr Teamkonto kopiert; die Originale bleiben auf dem Computer. Aufgaben werden nicht neu erstellt und private Notizen nicht übertragen. Erneute Versuche erkennen bereits empfangene Zeiten. Behalten Sie die Zuordnung nach dem ersten Senden bei; Änderungen werden als Konflikt behandelt. Die Arbeitsbereiche werden nicht automatisch verschmolzen. Es handelt sich auch nicht um die Synchronisierung zweier Teams.

![Zuordnung eines persönlichen Projekts zu einem Teamprojekt, französische Oberfläche](../../screenshots/15-transfert-vers-equipe.png)

## 8. Zeiten manuell erfassen und korrigieren

Unter **Zeiteinträge** wählen Sie den Monat. Verantwortliche und Administratoren können andere Teammitglieder auswählen. Listen sind seitenweise aufgebaut; breite Tabellen lassen sich auf kleinen Bildschirmen seitlich verschieben.

**Zeit hinzufügen → Dauer** akzeptiert beispielsweise `1h30`, `90 min` oder `1,5 h` für heute oder ein vergangenes Datum, bis zu 24 Stunden je Eintrag. **Beginn und Ende** verlangt ein vollständig vergangenes Intervall von höchstens sieben Tagen mit ausdrücklichem UTC-Zeitversatz, etwa `+01:00` oder `+02:00` in Paris je nach Jahreszeit. Bestätigen Sie nur beabsichtigte Überschneidungen; der Server prüft sie beim Synchronisieren erneut.

![Manueller Eintrag, französisches Beispiel](../../screenshots/04-saisie-manuelle.jpg)

Der Stift korrigiert einen abgeschlossenen Eintrag mit Begründung. **Beschreibung** bewahrt ursprüngliche Abschnitte und Sekunden. **Dauer** oder **Beginn und Ende** ersetzt Abschnitte; alter Wert und Grund werden protokolliert. Das Kreuz entfernt einen Eintrag mit Begründung aus Berichten. Bei einer veralteten Version zuerst aktualisieren. Teamkorrekturen benötigen eine Verbindung. Das lokale Korrekturprotokoll bewahrt bis zu 1.000 der letzten Korrekturen.

## 9. Notizen, Arbeitsberichte und KI

Unter **Arbeitsjournal → Notiz hinzufügen** wählen Sie Projekt, Datum und Text. Private Notizen sehen nur Sie und ausdrücklich dazu berechtigte Assistenten. **Prüfen / teilen** steuert die Aufnahme in Teamberichte. Das Löschen einer Notiz ist endgültig und muss in der Anwendung bestätigt werden.

**Verfassen** erstellt einen manuellen Monatsbericht. Unter **Prüfen und freigeben** bearbeiten und bestätigen Sie den Text für Berichte. Entwürfe bleiben privat.

![Arbeitsjournal, französisches Beispiel](../../screenshots/07-notes-comptes-rendus.jpg)

Ein Administrator kann unter **Integrationen** Ollama, vLLM oder Claude konfigurieren. **Mit KI vorbereiten** fragt nach Monat, Anbieter und Ihrer Zustimmung, eigene Beschreibungen und Notizen einschließlich privater Notizen dorthin zu senden. Prüfen Sie den privaten Entwurf vor der Freigabe. KI ändert keine berechneten Zeitsummen. Reale Anbieter müssen auf Ihrer Infrastruktur konfiguriert und geprüft werden; ein Abonnement ist nicht enthalten. Im eigenständigen Modus stehen manuelle Notizen und Arbeitsberichte zur Verfügung; diese KI-Integrationen verwenden den Teamserver.

## 10. Monatsberichte und Exporte

Wählen Sie unter **Berichte** den Monat. Teamadministratoren wählen unter **Gesamtes Team** die Beschäftigten aus, auch deaktivierte Mitglieder für historische Daten, und laden **CSV**, **PDF** oder **ZIP-Archiv** herunter. Andere Rollen sehen ihren persönlichen Bericht. Eigenständige Exporte enthalten Ihre lokale Arbeit.

![Bericht und Exporte, französisches Beispiel](../../screenshots/06-rapports.jpg)

Summen verwenden exakte abgeschlossene Sekunden, ohne Pausen, gelöschte Einträge oder aktive Zeitmessungen. Monatsübergreifende Intervalle werden in der Zeitzone des Arbeitsbereichs aufgeteilt, auch beim Wechsel der Sommerzeit. Private Notizen und nicht freigegebene Arbeitsberichte sind ausgeschlossen.

CSV verwendet UTF-8 und Semikolon. Serverberichte folgen der gewählten Sprache; persönliche CSV-Spalten bleiben für andere Werkzeuge stabil. Das PDF enthält Seitenzahlen. Team-ZIP enthält Zeiten-CSV, Projektsummen, gemeinsamen Bericht und einzelne PDFs. Persönliches ZIP enthält CSV, PDF und Berichts-JSON.

Serverexporte sind private Momentaufnahmen, die dem erstellenden Administrator 24 Stunden zum Herunterladen zur Verfügung stehen. Spätere Korrekturen ändern die Momentaufnahme nicht. Grenzen: 100 Mitglieder und 20.000 Einträge pro Teamexport; die Bildschirmvorschau zeigt 100 Einträge mit vollständigen Summen. Für einen abschließenden Teambericht zunächst ausstehende Zeiten synchronisieren und aktive Messungen beenden.

## 11. Codex, Claude Code, API und Webhook

Unter **Integrationen → Zugriff erstellen** wählen Sie Name, Ablauf und die nötigen Rechte. Kopieren Sie den Schlüssel einmal. **Assistenten einrichten** zeigt Konfigurationen für Codex und Claude Code. Speichern Sie den Token in `MINUTREL_MCP_TOKEN`, außerhalb des Quellcode-Repositorys. **Widerrufen** beendet den Zugriff.

![Integrationen, französisches Beispiel](../../screenshots/08-connexions.jpg)

Die Steuerung der Zeitmessung benötigt ein zusätzliches, standardmäßig nicht aktiviertes Recht. Auch Tokens von Administratoren bleiben persönlich. Assistentennotizen beginnen als private Entwürfe. REST verwendet Anwendungssitzungen; MCP-Tokens öffnen weder die allgemeine REST-API noch Teamexporte.

Automatisierungen können **`POST /hooks/work-notes`** mit `work.draft_own`, einem eindeutigen `Idempotency-Key` sowie `projectId`, `workDate` und `text` aufrufen. Das Ergebnis ist eine private Notiz zur Prüfung, keine Zeit oder automatisch geteilte Notiz. Wiederholungsschlüssel werden 30 Tage aufbewahrt. Der [API-/Webhook-Vertrag](../../API_WEBHOOKS.md) enthält HTTP-Beispiel und Fehlercodes. Ausgehende Webhook-Abonnements sind in V0.1 nicht enthalten.

## 12. Sprachen, Einstellungen und kleine Bildschirme

Wählen Sie **Français / English / Deutsch** bei der Anmeldung oder in der Kopfzeile. Der Sprachwechsel lädt die Oberfläche neu; speichern Sie Formulare vorher. Datumsanzeigen und Beschriftungen wechseln, Benutzereingaben und genaue Dauern bleiben unverändert. Betriebssystemeigene Steuerelemente können der Systemsprache folgen.

Auf kleinen Bildschirmen wird die Navigation zu einer horizontalen Leiste, Tabellen sind seitlich verschiebbar. Sprunglink, beschriftete Schaltflächen und reduzierte Animationen unterstützen die Tastaturnutzung. Responsive-Prüfungen ersetzen keine vollständige Barrierefreiheitsprüfung. [Mobile Aufnahme ansehen](../../screenshots/10-mobile-de.jpg).

Unter **Einstellungen** finden Sie Passwort, Serveradresse und als Administrator Arbeitsbereichskonfiguration, JSON-Export geteilter Arbeit und Verwaltungsprotokoll. Passwortänderungen widerrufen vorherige Zugriffe. Ein JSON-Export ersetzt keine vollständige Serversicherung.

## 13. Sichern und Fehler beheben

Für Server gelten [Sicherung/Wiederherstellung](../../../infra/backup/README.md) und [Selbsthosting](../../AUTOHEBERGEMENT.md). Sichern Sie Datenbank und Schlüssel zusammen. Für den eigenständigen Client beenden Sie die Anwendung und kopieren den gesamten Konfigurationsordner einschließlich `offline-*.json`, `.bak` und `connection.json`. Übliche Pfade: `~/Library/Application Support/app.minutrel.desktop` unter macOS, `%APPDATA%\app.minutrel.desktop` unter Windows und `$XDG_CONFIG_HOME/app.minutrel.desktop` oder `~/.config/app.minutrel.desktop` unter Linux. Eine JSON-Kopie lässt sich zusätzlich in den Einstellungen exportieren; die Wiederherstellung über die Oberfläche ist noch nicht enthalten.

| Problem | Prüfung |
| --- | --- |
| Keine Projekte | Zuweisung erfragen oder persönliches Projekt erstellen |
| Server nicht erreichbar | URL, HTTPS, Zertifikat und Netzwerk prüfen; KI ist für Zeiten nicht nötig |
| Zeit fehlt im Bericht | Zeitmessung beenden; Monat, Zeitzone, Mitglied und Warteschlange prüfen |
| Konflikt oder entzogene Rechte | Lokale Dateien behalten, Kopie exportieren und Administrator kontaktieren |
| Widget fehlt | Hauptfenster, Menüsymbol oder Mini-Zeitmessung verwenden; Vollbild- und Tastenkürzelregeln prüfen |
| KI nicht verfügbar | Anbieter und erlaubte Hosts prüfen; Bericht vorläufig selbst verfassen |

Melden Sie Fehler mit Version, Betriebssystem, lokalem/Teammodus, Schritten und Meldung. Entfernen Sie Passwörter, Tokens, private Notizen und Teamdaten aus Aufnahmen. Schwachstellen über den [Sicherheitskanal](../../../SECURITY.md) melden, ohne Ausnutzungsdetails öffentlich zu posten.

[Gelieferter Umfang](../../ETAT_V0_1.md) · [Dokumentierte Prüfungen](../../VALIDATION_CI.md) · [GitHub-Veröffentlichung](../../GITHUB.md). Weiterführende technische Dokumente werden derzeit auf Französisch gepflegt.
