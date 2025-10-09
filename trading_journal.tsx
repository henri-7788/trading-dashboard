import React, { useState } from 'react';
import { Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react';

export default function TradingJournal() {
  const [trades, setTrades] = useState([
    {
      id: 1,
      datum: '2025-10-09',
      coin: 'BTC/USDT',
      entryPrice: 100000,
      stopLoss: 90000,
      takeProfit: 110000,
      setup: '',
      kommentar: '',
      position: 1000, // Position size in USD
      partialExits: [],
      exitPrice: null,
      exitDate: null,
      status: 'open' // open, closed
    }
  ]);

  const addTrade = () => {
    setTrades([...trades, {
      id: Date.now(),
      datum: new Date().toISOString().split('T')[0],
      coin: '',
      entryPrice: 0,
      stopLoss: 0,
      takeProfit: 0,
      setup: '',
      kommentar: '',
      position: 0,
      partialExits: [],
      exitPrice: null,
      exitDate: null,
      status: 'open'
    }]);
  };

  const deleteTrade = (id) => {
    setTrades(trades.filter(t => t.id !== id));
  };

  const updateTrade = (id, field, value) => {
    setTrades(trades.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const addPartialExit = (tradeId) => {
    setTrades(trades.map(t => {
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
    }));
  };

  const updatePartialExit = (tradeId, exitId, field, value) => {
    setTrades(trades.map(t => {
      if (t.id === tradeId) {
        return {
          ...t,
          partialExits: t.partialExits.map(e => 
            e.id === exitId ? { ...e, [field]: value } : e
          )
        };
      }
      return t;
    }));
  };

  const deletePartialExit = (tradeId, exitId) => {
    setTrades(trades.map(t => {
      if (t.id === tradeId) {
        return {
          ...t,
          partialExits: t.partialExits.filter(e => e.id !== exitId)
        };
      }
      return t;
    }));
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
    const start = new Date(trade.datum);
    const end = new Date(trade.exitDate);
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
        <button
          onClick={addTrade}
          className="mb-6 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus size={20} />
          Neuer Trade
        </button>

        {/* Trades */}
        <div className="space-y-6">
          {trades.map((trade) => {
            const pnl = calculatePNL(trade);
            const duration = calculateDuration(trade);
            const rrr = getRRR(trade);

            return (
              <div key={trade.id} className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    {trade.status === 'open' ? (
                      <TrendingUp className="text-blue-400" size={24} />
                    ) : (
                      <TrendingDown className={pnl >= 0 ? 'text-green-400' : 'text-red-400'} size={24} />
                    )}
                    <div>
                      <h3 className="text-xl font-semibold text-white">
                        {trade.coin || 'Neuer Trade'}
                      </h3>
                      <span className={`text-sm px-2 py-1 rounded ${
                        trade.status === 'open' 
                          ? 'bg-blue-500/20 text-blue-400' 
                          : 'bg-slate-700 text-slate-300'
                      }`}>
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

        {trades.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            Noch keine Trades vorhanden. Klicke auf "Neuer Trade" um zu starten.
          </div>
        )}
      </div>
    </div>
  );
}