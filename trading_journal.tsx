import React, { useState, useEffect } from 'react';
import { Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react';

export default function TradingJournal() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [compactView, setCompactView] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/trades')
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      const data = await res.json()
      setTrades(data)
      setLoading(false)
    })()
  }, [])

  const addTrade = () => {
    const newTrade = {
      id: Date.now(),
      datum: new Date().toISOString().split('T')[0],
      side: 'long',
      coin: '',
      entryPrice: 0,
      stopLoss: 0,
      takeProfit: 0,
      setup: '',
      kommentar: '',
      position: 0,
      partialExits: [],
      addOns: [],
      exitPrice: null,
      exitDate: null,
      status: 'open'
    }
    setTrades([...trades, newTrade]);
    fetch('/api/trades', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newTrade) })
  };

  const deleteTrade = (id) => {
    setTrades(trades.filter(t => t.id !== id));
    fetch(`/api/trades?id=${id}`, { method: 'DELETE' })
  };

  const updateTrade = (id, field, value) => {
    const updated = trades.map(t => t.id === id ? { ...t, [field]: value } : t)
    setTrades(updated)
    const trade = updated.find(t => t.id === id)
    fetch('/api/trades', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(trade) })
  };

  const addPartialExit = (tradeId) => {
    const updated = trades.map(t => {
      if (t.id === tradeId) {
        return {
          ...t,
          partialExits: [...t.partialExits, {
            id: Date.now(),
            percentage: 0,
            price: 0,
            date: new Date().toISOString().split('T')[0]
          }]
        };
      }
      return t;
    })
    setTrades(updated)
    const trade = updated.find(t => t.id === tradeId)
    fetch('/api/trades', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(trade) })
  };

  const updatePartialExit = (tradeId, exitId, field, value) => {
    const updated = trades.map(t => {
      if (t.id === tradeId) {
        return {
          ...t,
          partialExits: t.partialExits.map(e => 
            e.id === exitId ? { ...e, [field]: value } : e
          )
        };
      }
      return t;
    })
    setTrades(updated)
    const trade = updated.find(t => t.id === tradeId)
    fetch('/api/trades', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(trade) })
  };

  const deletePartialExit = (tradeId, exitId) => {
    const updated = trades.map(t => {
      if (t.id === tradeId) {
        return {
          ...t,
          partialExits: t.partialExits.filter(e => e.id !== exitId)
        };
      }
      return t;
    })
    setTrades(updated)
    const trade = updated.find(t => t.id === tradeId)
    fetch('/api/trades', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(trade) })
  };

  const calculatePNL = (trade) => {
    if (!trade.entryPrice || !trade.position) return 0;

    let totalPNL = 0;
    let remainingPosition = 100; // in percentage

    // Calculate PNL from partial exits
    trade.partialExits.forEach(exit => {
      if (exit.price && exit.percentage) {
        const positionSize = (trade.position * exit.percentage / 100);
        const pnl = (exit.price - trade.entryPrice) / trade.entryPrice * positionSize;
        totalPNL += pnl;
        remainingPosition -= exit.percentage;
      }
    });

    // Calculate PNL from final exit
    if (trade.exitPrice && trade.status === 'closed') {
      const positionSize = (trade.position * remainingPosition / 100);
      const pnl = (trade.exitPrice - trade.entryPrice) / trade.entryPrice * positionSize;
      totalPNL += pnl;
    }

    return totalPNL;
  };

  const calculateDuration = (trade) => {
    if (!trade.exitDate || trade.status === 'open') return '-';
  const start = new Date(trade.datum).getTime();
  const end = new Date(trade.exitDate).getTime();
  const days = Math.floor((end - start) / (1000 * 60 * 60 * 24));
    return `${days}d`;
  };

  const getRRR = (trade) => {
    if (!trade.entryPrice || !trade.stopLoss || !trade.takeProfit) return '-';
    const risk = Math.abs(trade.entryPrice - trade.stopLoss);
    const reward = Math.abs(trade.takeProfit - trade.entryPrice);
    return (reward / risk).toFixed(2);
  };

  const totalPNL = trades.reduce((sum, trade) => sum + calculatePNL(trade), 0);
  if (loading) return <div className="p-6 text-white">Lade Trades…</div>
  const openTrades = trades.filter(t => t.status === 'open').length;
  const closedTrades = trades.filter(t => t.status === 'closed').length;
  const winningTrades = trades.filter(t => t.status === 'closed' && calculatePNL(t) > 0).length;
  const winRate = closedTrades > 0 ? ((winningTrades / closedTrades) * 100).toFixed(1) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Trading Journal</h1>
          <p className="text-slate-400">Verwalte deine Trades mit Teilprofiten</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4">
            <div className="text-slate-400 text-sm mb-1">Gesamt PNL</div>
            <div className={`text-2xl font-bold ${totalPNL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${totalPNL.toFixed(2)}
            </div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4">
            <div className="text-slate-400 text-sm mb-1">Offene Trades</div>
            <div className="text-2xl font-bold text-blue-400">{openTrades}</div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4">
            <div className="text-slate-400 text-sm mb-1">Geschlossene Trades</div>
            <div className="text-2xl font-bold text-slate-300">{closedTrades}</div>
          </div>
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4">
            <div className="text-slate-400 text-sm mb-1">Win Rate</div>
            <div className="text-2xl font-bold text-purple-400">{winRate}%</div>
          </div>
        </div>

        {/* Add Trade Button */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex gap-2">
            <button
              onClick={addTrade}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus size={18} />
              Neuer Trade
            </button>
            <button
              onClick={() => setCompactView(!compactView)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              {compactView ? 'Kartenansicht' : 'Kompakte Ansicht'}
            </button>
          </div>
          <div className="text-slate-400">Trades: {trades.length}</div>
        </div>

        {/* Trades */}
        {!compactView && (
          <div className="space-y-6">
            {trades.map((trade) => {
            const pnl = calculatePNL(trade);
            const duration = calculateDuration(trade);
            const rrr = getRRR(trade);

            return (
              <div key={trade.id} className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    {/* simplified: same icon/color for all trades; side indicates long/short */}
                    {trade.side === 'short' ? (
                      <TrendingDown size={24} />
                    ) : (
                      <TrendingUp size={24} />
                    )}
                    <div>
                      <h3 className="text-xl font-semibold text-white">
                        {trade.coin || 'Neuer Trade'}
                      </h3>
                      <span className={`text-sm px-2 py-1 rounded bg-slate-700 text-slate-300`}>
                        {trade.status === 'open' ? 'Offen' : 'Geschlossen'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteTrade(trade.id)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>

                {/* Main Trade Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
                  <div>
                    <label className="text-slate-400 text-sm block mb-1">Datum</label>
                    <input
                      type="date"
                      value={trade.datum}
                      onChange={(e) => updateTrade(trade.id, 'datum', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-sm block mb-1">Coin</label>
                    <input
                      type="text"
                      value={trade.coin}
                      onChange={(e) => updateTrade(trade.id, 'coin', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white focus:border-blue-500 focus:outline-none"
                      placeholder="BTC/USDT"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-sm block mb-1">Side</label>
                    <select
                      value={trade.side || 'long'}
                      onChange={(e) => updateTrade(trade.id, 'side', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white focus:border-blue-500 focus:outline-none"
                    >
                      <option value="long">Long</option>
                      <option value="short">Short</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 text-sm block mb-1">Entry Price</label>
                    <input
                      type="number"
                      value={trade.entryPrice || ''}
                      onChange={(e) => updateTrade(trade.id, 'entryPrice', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white focus:border-blue-500 focus:outline-none"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-sm block mb-1">Stop Loss</label>
                    <input
                      type="number"
                      value={trade.stopLoss || ''}
                      onChange={(e) => updateTrade(trade.id, 'stopLoss', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white focus:border-blue-500 focus:outline-none"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-sm block mb-1">Take Profit</label>
                    <input
                      type="number"
                      value={trade.takeProfit || ''}
                      onChange={(e) => updateTrade(trade.id, 'takeProfit', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white focus:border-blue-500 focus:outline-none"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-sm block mb-1">Position ($)</label>
                    <input
                      type="number"
                      value={trade.position || ''}
                      onChange={(e) => updateTrade(trade.id, 'position', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white focus:border-blue-500 focus:outline-none"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Partial Exits */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-slate-300 font-medium">Teilprofite</label>
                    <button
                      onClick={() => addPartialExit(trade.id)}
                      className="text-sm px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                    >
                      + Teilprofit
                    </button>
                  </div>
                  {trade.partialExits.length > 0 && (
                    <div className="space-y-2">
                      {trade.partialExits.map((exit) => (
                        <div key={exit.id} className="flex gap-2 items-center bg-slate-900/50 p-3 rounded">
                          <input
                            type="date"
                            value={exit.date}
                            onChange={(e) => updatePartialExit(trade.id, exit.id, 'date', e.target.value)}
                            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:border-blue-500 focus:outline-none"
                          />
                          <input
                            type="number"
                            value={exit.percentage || ''}
                            onChange={(e) => updatePartialExit(trade.id, exit.id, 'percentage', parseFloat(e.target.value))}
                            className="w-24 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:border-blue-500 focus:outline-none"
                            placeholder="% Exit"
                          />
                          <input
                            type="number"
                            value={exit.price || ''}
                            onChange={(e) => updatePartialExit(trade.id, exit.id, 'price', parseFloat(e.target.value))}
                            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:border-blue-500 focus:outline-none"
                            placeholder="Exit Price"
                          />
                          <button
                            onClick={() => deletePartialExit(trade.id, exit.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Nachkäufe (addOns) */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-slate-300 font-medium">Nachkäufe</label>
                    <button
                      onClick={() => {
                        const updated = trades.map(t => t.id === trade.id ? { ...t, addOns: [...(t.addOns||[]), { id: Date.now(), date: new Date().toISOString().split('T')[0], amount: 0 }] } : t)
                        setTrades(updated)
                        const updatedTrade = updated.find(t => t.id === trade.id)
                        fetch('/api/trades', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedTrade) })
                      }}
                      className="text-sm px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors"
                    >
                      + Nachkauf
                    </button>
                  </div>
                  {(trade.addOns||[]).length > 0 && (
                    <div className="space-y-2">
                      {(trade.addOns||[]).map((add) => (
                        <div key={add.id} className="flex gap-2 items-center bg-slate-900/50 p-3 rounded">
                          <input
                            type="date"
                            value={add.date}
                            onChange={(e) => {
                              const updated = trades.map(t => t.id === trade.id ? { ...t, addOns: t.addOns.map(a => a.id === add.id ? { ...a, date: e.target.value } : a) } : t)
                              setTrades(updated)
                              const updatedTrade = updated.find(t => t.id === trade.id)
                              fetch('/api/trades', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedTrade) })
                            }}
                            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:border-blue-500 focus:outline-none"
                          />
                          <input
                            type="number"
                            value={add.amount || ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0
                              const updated = trades.map(t => t.id === trade.id ? { ...t, addOns: t.addOns.map(a => a.id === add.id ? { ...a, amount: val } : a) } : t)
                              setTrades(updated)
                              const updatedTrade = updated.find(t => t.id === trade.id)
                              fetch('/api/trades', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedTrade) })
                            }}
                            className="w-36 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:border-blue-500 focus:outline-none"
                            placeholder="Amount"
                          />
                          <button
                            onClick={() => {
                              const updated = trades.map(t => t.id === trade.id ? { ...t, addOns: t.addOns.filter(a => a.id !== add.id) } : t)
                              setTrades(updated)
                              const updatedTrade = updated.find(t => t.id === trade.id)
                              fetch('/api/trades', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedTrade) })
                            }}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Close Trade Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="text-slate-400 text-sm block mb-1">Status</label>
                    <select
                      value={trade.status}
                      onChange={(e) => updateTrade(trade.id, 'status', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white focus:border-blue-500 focus:outline-none"
                    >
                      <option value="open">Offen</option>
                      <option value="closed">Geschlossen</option>
                    </select>
                  </div>
                  {trade.status === 'closed' && (
                    <>
                      <div>
                        <label className="text-slate-400 text-sm block mb-1">Exit Date</label>
                        <input
                          type="date"
                          value={trade.exitDate || ''}
                          onChange={(e) => updateTrade(trade.id, 'exitDate', e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 text-sm block mb-1">Exit Price (Rest)</label>
                        <input
                          type="number"
                          value={trade.exitPrice || ''}
                          onChange={(e) => updateTrade(trade.id, 'exitPrice', parseFloat(e.target.value))}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white focus:border-blue-500 focus:outline-none"
                          placeholder="0.00"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Setup and Comments */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-slate-400 text-sm block mb-1">Setup</label>
                    <input
                      type="text"
                      value={trade.setup}
                      onChange={(e) => updateTrade(trade.id, 'setup', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white focus:border-blue-500 focus:outline-none"
                      placeholder="z.B. Breakout, Support/Resistance..."
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-sm block mb-1">Kommentar</label>
                    <input
                      type="text"
                      value={trade.kommentar}
                      onChange={(e) => updateTrade(trade.id, 'kommentar', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white focus:border-blue-500 focus:outline-none"
                      placeholder="Notizen zum Trade..."
                    />
                  </div>
                </div>

                {/* Trade Stats */}
                <div className="flex gap-6 pt-4 border-t border-slate-700">
                  <div>
                    <span className="text-slate-400 text-sm">PNL: </span>
                    <span className={`font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${pnl.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-sm">RRR: </span>
                    <span className="text-white font-bold">{rrr}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-sm">Dauer: </span>
                    <span className="text-white font-bold">{duration}</span>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        )}

        {compactView && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <table className="w-full text-sm text-left text-white">
              <thead>
                <tr className="text-slate-400">
                  <th className="py-2 px-3">Datum</th>
                  <th className="py-2 px-3">Coin</th>
                  <th className="py-2 px-3">Side</th>
                  <th className="py-2 px-3">Entry</th>
                  <th className="py-2 px-3">SL</th>
                  <th className="py-2 px-3">TP</th>
                  <th className="py-2 px-3">Position</th>
                  <th className="py-2 px-3">PNL</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {trades.map(trade => {
                  const pnl = calculatePNL(trade)
                  return (
                    <tr key={trade.id} className="border-t border-slate-700">
                      <td className="py-2 px-3">{trade.datum}</td>
                      <td className="py-2 px-3">{trade.coin}</td>
                      <td className="py-2 px-3">{trade.side || 'long'}</td>
                      <td className="py-2 px-3">{trade.entryPrice}</td>
                      <td className="py-2 px-3">{trade.stopLoss}</td>
                      <td className="py-2 px-3">{trade.takeProfit}</td>
                      <td className="py-2 px-3">{trade.position}</td>
                      <td className={`py-2 px-3 ${pnl>=0 ? 'text-green-400' : 'text-red-400'}`}>${pnl.toFixed(2)}</td>
                      <td className="py-2 px-3">{trade.status}</td>
                      <td className="py-2 px-3">
                        <button onClick={() => {
                          // focus the trade by scrolling to its card if visible
                          const el = document.querySelector(`[data-trade-id="${trade.id}"]`)
                          if (el) (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' })
                        }} className="text-sm px-2 py-1 bg-slate-700 rounded">Anzeigen</button>
                        <button onClick={() => deleteTrade(trade.id)} className="ml-2 text-sm px-2 py-1 bg-red-600 rounded">Löschen</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {trades.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            Noch keine Trades vorhanden. Klicke auf "Neuer Trade" um zu starten.
          </div>
        )}
      </div>
    </div>
  );
}