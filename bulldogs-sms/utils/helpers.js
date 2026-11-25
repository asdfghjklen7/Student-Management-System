// Pull the grade-point equivalent out of strings such as "96 (4.0)"
const equiv = (str) => {
  const m = /\((\d+(?:\.\d+)?)\)\s*$/.exec(String(str || ''));
  return m ? parseFloat(m[1]) : null;
};

// Unit-weighted GPA based on final grades. Returns '—' when nothing can be computed.
exports.computeGpa = (grades) => {
  let pts = 0, units = 0;
  for (const g of grades) {
    const e = equiv(g.final);
    if (e === null) continue;
    const u = g.units || 3;
    pts += e * u; units += u;
  }
  return units ? (pts / units).toFixed(2) : '—';
};

exports.str = (v) => (v === undefined || v === null ? '' : String(v).trim());
