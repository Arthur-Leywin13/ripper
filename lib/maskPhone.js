function maskPhone(rawNumber) {
  if (!rawNumber) return '+???????????'
  const digits = String(rawNumber).replace(/\D/g, '')
  if (digits.length <= 6) return `+${digits}`
  const start = digits.slice(0, 5)
  const end = digits.slice(-1)
  const midLen = digits.length - start.length - end.length
  return `+${start}${'*'.repeat(midLen)}${end}`
}

module.exports = { maskPhone }
