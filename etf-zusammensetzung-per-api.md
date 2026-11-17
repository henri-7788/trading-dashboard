# ETF-Zusammensetzung per API abrufen

Es gibt drei Wege, je nachdem ob es kostenlos sein soll und ob du US-ETFs oder europäische UCITS-ETFs brauchst.

## 1. Direkt beim Emittenten (kostenlos, am vollständigsten)

Die großen Anbieter stellen die kompletten Bestände täglich als CSV oder Excel bereit. Das sind keine offiziellen APIs, man kann die Dateien aber per Skript abrufen.

Bei iShares gibt es pro Fonds eine Datei. Sie beginnt mit dem Stichtag ("Fund Holdings as of") und der Anzahl ausgegebener Anteile. Danach folgen die Spalten Ticker, Name, Sektor, Assetklasse, Marktwert und Gewichtung (%). Die URL folgt einem festen Muster, zum Beispiel:

```
https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf/1467271812596.ajax?fileType=csv&fileName=IVV_holdings&dataType=fund
```

Für europäische ETFs funktioniert das auf ishares.com/de genauso. Auch Xtrackers, Amundi, Vanguard und SPDR bieten solche Dateien an, jeder Anbieter in einem eigenen Format.

```python
import pandas as pd, requests, io

url = "https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf/1467271812596.ajax?fileType=csv&fileName=IVV_holdings&dataType=fund"
txt = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}).text
df = pd.read_csv(io.StringIO(txt), skiprows=9)  # die ersten Zeilen sind Metadaten
print(df[["Ticker", "Name", "Weight (%)"]].head())
```

**Nachteil:** Jeder Anbieter hat ein anderes Format, und die URLs können sich ohne Ankündigung ändern.

## 2. Kommerzielle Finanzdaten-APIs (einheitliches JSON, ein Key für alle ETFs)

- **Financial Modeling Prep (FMP):** Liefert alle Aktien, die ein ETF hält, inklusive Stückzahl und Gewichtung (z. B. SPY, VOO).
- **Alpha Vantage:** Die Funktion `ETF_PROFILE` gibt Profildaten und Bestände zurück, sofern sie für den Fonds unterstützt werden. Es gibt einen Gratis-Tier, und das ist ein guter Einstieg.
- **Eulerpool:** Der Endpoint `/v1/etf/{ticker}/holdings` löst auch ISINs auf, europäische Fonds sind also abgedeckt. Laut Anbieter gibt es einen kostenlosen Key mit 100.000 Requests pro Monat.
- **Intrinio, Finnworlds, EODHD:** Weitere Anbieter, eher für den professionellen oder kostenpflichtigen Einsatz.

**Vor der Entscheidung prüfen:**

- Sind die Bestände für deine ETFs vollständig? Manche Anbieter liefern nur die Top 10–25.
- Wie aktuell ist der Stichtag?
- Erlaubt die Lizenz deine Nutzung?

## 3. Offizielle Meldedaten (nur US-ETFs)

US-Fonds melden ihre vollständigen Positionen an die SEC (Formular N-PORT, abrufbar über EDGAR). Die Daten sind kostenlos und verlässlich. Sie werden aber nur quartalsweise und mit etwa 60 Tagen Verzögerung veröffentlicht. Für Analysen sind sie gut geeignet, für tagesaktuelle Gewichte nicht.

## Empfehlung

- **Wenige bestimmte ETFs:** Lade die Emittenten-CSVs direkt; das ist kostenlos und tagesaktuell.
- **Viele ETFs verschiedener Anbieter:** Nimm eine API wie Alpha Vantage oder FMP. Dann musst du die unterschiedlichen Formate nicht selbst parsen.

## Quellen

- [FMP – ETF Holder API](https://site.financialmodelingprep.com/developer/docs/etf-holders-api)
- [Eulerpool – ETF Holdings API](https://eulerpool.com/blog/etf-holdings-api)
- [QVeris – Free ETF Holdings API Guide](https://qveris.ai/guides/free-etf-holdings-api/)
- [iShares – Beispiel-CSV der Bestände](https://www.ishares.com/us/products/297905/ishares-future-ai-tech-etf/latest-holdings.csv)
- [indexkit – iShares-CSV-Endpunkte](https://docs.rs/crate/indexkit/1.0.1/source/src/sponsor.rs)
