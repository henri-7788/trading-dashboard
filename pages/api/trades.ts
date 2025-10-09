import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../lib/supabaseServer'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // keep simple cookie-based auth
  const auth = req.cookies?.trading_auth
  if (!auth || auth !== '1') {
    return res.status(401).json({ error: 'unauthorized' })
  }

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('trades')
        .select('*')
        .order('datum', { ascending: false })

      if (error) throw error
      const mapped = (data || []).map(mapDbToTrade)
      return res.status(200).json(mapped)
    }

    if (req.method === 'POST') {
      const newItem = req.body
  const { data, error } = await supabaseAdmin.from('trades').insert([mapTradeToDb(newItem)])
  if (error) throw error
  const rows = data as any[]
  if (!rows || rows.length === 0) return res.status(500).json({ error: 'insert failed' })
  return res.status(201).json(mapDbToTrade(rows[0]))
    }

    if (req.method === 'PUT') {
      const updated = req.body
      const { data, error } = await supabaseAdmin
        .from('trades')
        .update(mapTradeToDb(updated))
        .eq('id', updated.id)
      if (error) throw error
  const rows = data as any[]
  if (!rows || rows.length === 0) return res.status(404).json({ error: 'not found' })
  return res.status(200).json(mapDbToTrade(rows[0]))
    }

    if (req.method === 'DELETE') {
      const { id } = req.query
      const { error } = await supabaseAdmin.from('trades').delete().eq('id', id)
      if (error) throw error
      return res.status(200).json({ success: true })
    }

    res.setHeader('Allow', 'GET,POST,PUT,DELETE')
    res.status(405).end('Method Not Allowed')
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || String(err) })
  }
}

function mapTradeToDb(t: any) {
  return {
    id: t.id,
    datum: t.datum,
    coin: t.coin,
    side: t.side,
    entry_price: t.entryPrice,
    stop_loss: t.stopLoss,
    take_profit: t.takeProfit,
    setup: t.setup,
    kommentar: t.kommentar,
    position: t.position,
    partial_exits: t.partialExits || [],
    add_ons: t.addOns || [],
    exit_price: t.exitPrice,
    exit_date: t.exitDate,
    status: t.status,
    created_at: t.created_at || new Date().toISOString()
  }
}

function mapDbToTrade(r: any) {
  return {
    id: r.id,
    datum: r.datum,
    coin: r.coin,
    side: r.side,
    entryPrice: r.entry_price,
    stopLoss: r.stop_loss,
    takeProfit: r.take_profit,
    setup: r.setup,
    kommentar: r.kommentar,
    position: r.position,
    partialExits: r.partial_exits || [],
    addOns: r.add_ons || [],
    exitPrice: r.exit_price,
    exitDate: r.exit_date,
    status: r.status,
    created_at: r.created_at
  }
}
