import { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

const DATA_PATH = path.join(process.cwd(), 'data', 'trades.json')

function readData() {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf-8')
    return JSON.parse(raw || '[]')
  } catch (e) {
    return []
  }
}

function writeData(data: any) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // simple auth: check for cookie
  const auth = req.cookies?.trading_auth
  if (!auth || auth !== '1') {
    return res.status(401).json({ error: 'unauthorized' })
  }

  if (req.method === 'GET') {
    const data = readData()
    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    const data = readData()
    const newItem = req.body
    data.push(newItem)
    writeData(data)
    return res.status(201).json(newItem)
  }

  if (req.method === 'PUT') {
    const data = readData()
    const updated = req.body
    const idx = data.findIndex((t: any) => t.id === updated.id)
    if (idx === -1) return res.status(404).json({ error: 'not found' })
    data[idx] = updated
    writeData(data)
    return res.status(200).json(updated)
  }

  if (req.method === 'DELETE') {
    const data = readData()
    const { id } = req.query
    const filtered = data.filter((t: any) => String(t.id) !== String(id))
    writeData(filtered)
    return res.status(200).json({ success: true })
  }

  res.setHeader('Allow', 'GET,POST,PUT,DELETE')
  res.status(405).end('Method Not Allowed')
}
