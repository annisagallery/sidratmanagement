// How a zone's areas read on screen. "ALL" is the stored value for "any".

export const areaLabel = ({ district, upazila }) => {
  if (district === 'ALL') return 'Any district';
  if (upazila === 'ALL') return `${district} (whole district)`;
  return `${upazila}, ${district}`;
};

// A zone's coverage in one line: the first few areas, then a count.
export const coverageSummary = (areas = [], shown = 3) => {
  if (!areas.length) return 'No areas';
  const head = areas.slice(0, shown).map(areaLabel).join(' · ');
  return areas.length > shown ? `${head} · +${areas.length - shown} more` : head;
};
