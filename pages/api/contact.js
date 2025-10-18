// ...existing code...
export default function handler(req, res) {
  if (req.method === 'POST') {
    const data = req.body;
    // handle contact (validate, send email, save, etc.)
    return res.status(200).json({ ok: true });
  }
  // reject other methods
  res.setHeader('Allow', 'POST');
  res.status(405).end('Method Not Allowed');
}