function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function validateQuery(q) {
  if (!q || typeof q !== 'string') return '';
  return q.replace(/[<>&'";]/g, '').trim().slice(0, 200);
}

module.exports = { asyncHandler, validateQuery };
