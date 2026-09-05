export function sortData<T>(data: T[], key: string, dir: 'asc' | 'desc', valueGetter?: (row: T, key: string) => any): T[] {
  if (!key) return data;

  return [...data].sort((a: any, b: any) => {
    // Helper to get nested value (e.g. 'plan.company.name')
    const getDefaultValue = (obj: any, path: string) => {
      return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : null), obj);
    };

    let valA = valueGetter ? valueGetter(a, key) : getDefaultValue(a, key);
    let valB = valueGetter ? valueGetter(b, key) : getDefaultValue(b, key);

    // Normalize empty values for comparison
    if (valA === null || valA === undefined) valA = '';
    if (valB === null || valB === undefined) valB = '';

    // Handle string comparison
    if (typeof valA === 'string' && typeof valB === 'string') {
      // Check if it's a date string (basic heuristic: minimum length for date and contains hyphen/slash)
      if (valA.length >= 8 && valB.length >= 8 && (valA.includes('-') || valA.includes('/'))) {
        const dateA = Date.parse(valA);
        const dateB = Date.parse(valB);
        if (!isNaN(dateA) && !isNaN(dateB)) {
          return dir === 'asc' ? dateA - dateB : dateB - dateA;
        }
      }
      
      // Use localeCompare with numeric sorting so "Item 2" comes before "Item 10"
      const comp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
      return dir === 'asc' ? comp : -comp;
    }

    // Handle number comparison
    if (typeof valA === 'number' && typeof valB === 'number') {
      return dir === 'asc' ? valA - valB : valB - valA;
    }
    
    // Handle booleans
    if (typeof valA === 'boolean' && typeof valB === 'boolean') {
      const comp = valA === valB ? 0 : valA ? 1 : -1;
      return dir === 'asc' ? comp : -comp;
    }

    // Fallback comparison
    if (valA < valB) return dir === 'asc' ? -1 : 1;
    if (valA > valB) return dir === 'asc' ? 1 : -1;
    return 0;
  });
}
