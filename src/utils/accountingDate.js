export function getAccountingDate(order) {
  return order?.date_livraison_reelle
    || order?.date_livraison_souhaitee
    || order?.date_commande
    || null;
}

export function isInAccountingMonth(order, monthDate) {
  const accountingDate = getAccountingDate(order);
  if (!accountingDate) return false;

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  if (/^\d{4}-\d{2}-\d{2}$/.test(accountingDate)) {
    const [accountingYear, accountingMonth] = accountingDate.split('-').map(Number);
    return accountingYear === year && accountingMonth === month + 1;
  }

  const parsedDate = new Date(accountingDate);
  return !Number.isNaN(parsedDate.getTime())
    && parsedDate.getFullYear() === year
    && parsedDate.getMonth() === month;
}

export function filterOrdersByAccountingMonth(orders, monthDate) {
  return orders.filter(order => isInAccountingMonth(order, monthDate));
}

export function applyAccountingMonthFilter(query, monthDate) {
  const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const startOfNextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
  const startDate = toLocalIsoDate(startOfMonth);
  const nextMonthDate = toLocalIsoDate(startOfNextMonth);

  return query
    .or(`and(date_livraison_reelle.gte.${startDate},date_livraison_reelle.lt.${nextMonthDate}),and(date_livraison_souhaitee.gte.${startDate},date_livraison_souhaitee.lt.${nextMonthDate}),and(date_commande.gte.${startOfMonth.toISOString()},date_commande.lt.${startOfNextMonth.toISOString()})`);
}

export function toLocalIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
