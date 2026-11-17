# TradingView Charting Libraries – korrigierter Vergleich

## Grundlage und Leseschlüssel

Diese Fassung überträgt die sichtbaren Werte und Häkchen/Kreuze aus dem vom Nutzer bereitgestellten Screenshot der TradingView-Vergleichstabelle. Sie ersetzt die zuvor teilweise unzutreffenden Funktionszuordnungen.

Spaltenreihenfolge: Lightweight Charts™, Advanced Charts (im Screenshot „Fortschrittliche Charts“), Trading Platform (im Screenshot „Trading-Plattform“).

- ✓: In der abgebildeten Vergleichstabelle als vorhanden markiert.
- ✗: In der abgebildeten Vergleichstabelle als nicht vorhanden markiert. Das ist keine Aussage darüber, ob eine Funktion durch Eigenentwicklung ergänzt werden kann.
- *: Sternchen aus dem Screenshot. Die zugehörigen Fußnotentexte sind nicht sichtbar; ihre Bedeutung wird daher nicht ergänzt oder vermutet.

Quelle: vom Nutzer bereitgestellter Screenshot der Seite https://de.tradingview.com/free-charting-libraries/. Ein Versions- oder Gültigkeitsdatum ist darin nicht sichtbar.

## Wichtigste Korrekturen gegenüber der ersten Datei

- Advanced Charts ist für Renko, Line-Break, Kagi, Point-and-Figure und Volumenkerzen mit ✗ markiert; nur die Trading Platform hat dort ✓.
- Lightweight Charts ist bei Step-Line, HLC-Bereich und High-Low mit ✗ markiert.
- Cursor-, Symbol-/Intervall- und Zeitsynchronisation sind nur bei der Trading Platform mit ✓ markiert.
- Mehrere Watchlisten und die aufgeführten Nachrichtenfunktionen sind nur bei der Trading Platform mit ✓ markiert. Aus der Zeile „Mehrere Listen“ folgt nicht automatisch eine Aussage über jede denkbare Watchlist-Funktion.
- Hohlkerzen, Symbolvergleich und Overlays mit mehreren Preisserien sind bei allen drei Bibliotheken mit ✓ markiert.

## Vollständige Übertragung der sichtbaren Vergleichszeilen

### Lizenz und Kosten

| Merkmal | Lightweight Charts™ | Advanced Charts | Trading Platform |
|---|---|---|---|
| Lizenz | Apache 2.0 | Proprietär | Proprietär |
| Open Source | ✓ | ✗ | ✗ |
| Kostenlos | ✓ | ✓* | ✗* |

### Geräte und Interaktivität

| Merkmal | Lightweight Charts™ | Advanced Charts | Trading Platform |
|---|---|---|---|
| Verfügbar auf verschiedenen Geräten | ✓* | ✓ | ✓* |
| Zoomfunktion entlang der Skalen | ✓ | ✓ | ✓ |
| Mausrad-Zoom | ✓ | ✓ | ✓ |
| Scrollfunktion für Charts | ✓ | ✓ | ✓ |

### Charttypen

| Merkmal | Lightweight Charts™ | Advanced Charts | Trading Platform |
|---|---|---|---|
| Kerzen und Balken | ✓ | ✓ | ✓ |
| Bereich und Linie | ✓ | ✓ | ✓ |
| Grundlinie | ✓ | ✓ | ✓ |
| Säulen | ✓ | ✓ | ✓ |
| Hohlkerzen | ✓ | ✓ | ✓ |
| Linie mit Markierungen | ✗ | ✓ | ✓ |
| Step-Line | ✗ | ✓ | ✓ |
| HLC-Bereich | ✗ | ✓ | ✓ |
| High-Low | ✗ | ✓ | ✓ |
| HeikinAshi | ✗ | ✓ | ✓ |
| Volumenkerzen | ✗ | ✗ | ✓ |
| HLC-Balken | ✗ | ✓ | ✓ |
| Renko | ✗ | ✗ | ✓ |
| Line-Break | ✗ | ✗ | ✓ |
| Kagi | ✗ | ✗ | ✓ |
| Point-and-Figure | ✗ | ✗ | ✓ |

### Technische Analyse

| Merkmal | Lightweight Charts™ | Advanced Charts | Trading Platform |
|---|---|---|---|
| Symbolvergleich | ✓ | ✓ | ✓ |
| Ein Overlay mit multiplen Preisserien | ✓ | ✓ | ✓ |
| 110+ Zeichnungen | ✗ | ✓ | ✓ |
| 100+ technische Indikatoren | ✗ | ✓ | ✓ |
| Indikator-Vorlagen | ✗ | ✓ | ✓ |

### Fortschrittliche Preis-Skalierung

| Merkmal | Lightweight Charts™ | Advanced Charts | Trading Platform |
|---|---|---|---|
| Preis-Skala | 2 | Bis zu 8 | Bis zu 8 |
| Logarithmische Skala | ✓ | ✓ | ✓ |
| Prozent-Skala | ✓ | ✓ | ✓ |
| Invertierte Skala | ✓ | ✓ | ✓ |
| Automatische Skalierung | ✓ | ✓ | ✓ |
| Manuelle Skalierung | ✓ | ✓ | ✓ |
| Indiziert für 100 Skalen | ✓ | ✓ | ✓ |
| Fixe Skala | ✗ | ✓ | ✓ |

### Zeitintervalle und Datumsbereiche

| Merkmal | Lightweight Charts™ | Advanced Charts | Trading Platform |
|---|---|---|---|
| Benutzerdefinierte Intervalle S/M/H/D/W/Mo/Y | ✓ | ✓ | ✓ |
| Sekundenbasierte Intervalle | ✓ | ✓ | ✓ |
| Datumsbereich | ✗ | ✓ | ✓ |

### Events auf dem Chart

| Merkmal | Lightweight Charts™ | Advanced Charts | Trading Platform |
|---|---|---|---|
| Ideen auf Preisbalken | ✗ | ✓ | ✓ |

### Flexible Gestaltung

| Merkmal | Lightweight Charts™ | Advanced Charts | Trading Platform |
|---|---|---|---|
| Farb-Designs | ✓ | ✓ | ✓ |
| Benutzerdefinierte Chartfarben | ✓ | ✓ | ✓ |
| Individuelle Schriftfamilien | ✓ | ✓ | ✓ |
| Benutzerdefinierte Farben für Zeichnungen und Indikatoren | ✗ | ✓ | ✓ |

### Synchronisiertes Layout für mehrere Charts

| Merkmal | Lightweight Charts™ | Advanced Charts | Trading Platform |
|---|---|---|---|
| Cursor-Synchronisierung | ✗ | ✗ | ✓ |
| Symbol- und Intervallsynchronisation | ✗ | ✗ | ✓ |
| Zeitsynchronisation | ✗ | ✗ | ✓ |

### Trading

| Merkmal | Lightweight Charts™ | Advanced Charts | Trading Platform |
|---|---|---|---|
| Chart-Trading (Order und Positionen auf dem Chart) | ✗ | ✗ | ✓ |
| Handelsverlauf auf dem Chart | ✗ | ✗ | ✓ |
| Benutzerdefinierte Order-Dialogfenster | ✗ | ✗ | ✓ |
| Fortschrittliches Order-Ticket | ✗ | ✗ | ✓ |
| Schwebendes Widget für Kaufen/Verkaufen | ✗ | ✗ | ✓ |
| Diverse Ordertypen | ✗ | ✗ | ✓ |
| Account- und Positions-Tracking | ✗ | ✗ | ✓ |
| Depth of Market (DOM) | ✗ | ✗ | ✓ |

### Watchlisten

| Merkmal | Lightweight Charts™ | Advanced Charts | Trading Platform |
|---|---|---|---|
| Mehrere Listen | ✗ | ✗ | ✓ |

### Nachrichten

| Merkmal | Lightweight Charts™ | Advanced Charts | Trading Platform |
|---|---|---|---|
| RSS-Feeds | ✗ | ✗ | ✓ |
| API für eine benutzerdefinierte Anpassung | ✗ | ✗ | ✓ |
| Nachrichten nach Symbol, Börse und Symboltyp | ✗ | ✗ | ✓ |

## Einordnung anhand der Tabelle

- Lightweight Charts: Die Tabelle weist gemeinsame grundlegende Chart-, Interaktions-, Skalierungs- und Gestaltungsfunktionen aus, aber keine integrierten Zeichnungs- oder Indikatorenpakete der aufgeführten Art.
- Advanced Charts: Ergänzt gegenüber Lightweight Charts unter anderem Zeichnungen, technische Indikatoren, Indikator-Vorlagen und zusätzliche Charttypen. Die aufgeführten Synchronisations-, Handels- und Nachrichtenfunktionen sind hier jedoch mit ✗ markiert.
- Trading Platform: Hat in allen sichtbaren Funktionszeilen ein ✓, ausgenommen die Zeilen „Open Source“ und „Kostenlos“. Zu den Unterscheidungsmerkmalen zählen die zusätzlichen Charttypen, Synchronisation, Trading, mehrere Watchlisten und Nachrichtenfunktionen.

## Grenzen dieser Fassung

Nicht im Screenshot enthaltene Angaben – etwa Bundle-Größen, konkrete Vertragsbedingungen, Logo-Vorgaben, Hosting, Datenversorgung oder Backend-Anforderungen – werden hier nicht als verifiziert übernommen. Auch die genaue Bedeutung der Sternchen bleibt offen. Die ursprüngliche Datei sollte für diese Punkte nicht als belastbarer Nachweis verwendet werden.
