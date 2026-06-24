function csvEscape(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function passFail(value) {
  return value ? 'Pass' : 'Fail';
}

export function downloadResultsCsv(results) {
  const today = new Date();
  const date =
    today.getFullYear().toString() +
    (today.getMonth() + 1).toString().padStart(2, '0') +
    today.getDate().toString().padStart(2, '0');
  const suffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const fileName = `adafontcheck-${date}-${suffix}.csv`;
  const rows = [
    ['', '', '', '', 'FEDERAL CHARACTER TESTS', '', 'CALIFORNIA CHARACTER TESTS', ''],
    [
      'Font Name',
      'Body Width',
      'Stroke Width',
      'Federal Tactile',
      'Federal Visual',
      'California Tactile',
      'California Visual'
    ],
    ...results
      .filter((result) => !result.error)
      .map((result) => [
        result.name,
        `${result.body.ratio}%`,
        `${result.stroke.ratio}%`,
        passFail(result.test.federal.tactile),
        passFail(result.test.federal.visual),
        passFail(result.test.california.tactile),
        passFail(result.test.california.visual)
      ])
  ];

  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
